import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueIngestion } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { aiClient } from "@/lib/ai-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any; // Prisma Platform enum — string-backed

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const DIRECT_IN_DEV = process.env.NODE_ENV !== "production";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    platform?: string;
    leetcodeHandle?: string;
    codeforcesHandle?: string;
  };
  const { platform } = body;
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });
  const requestedPlatform = platform.trim().toUpperCase();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      githubUsername: true,
      leetcodeHandle: true,
      codeforcesHandle: true,
      linkedinUrl: true,
    },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const requestLeetcode = body.leetcodeHandle?.trim() || null;
  const requestCodeforces = body.codeforcesHandle?.trim() || null;
  const effectiveLeetcode = requestLeetcode || profile.leetcodeHandle || null;
  const effectiveCodeforces = requestCodeforces || profile.codeforcesHandle || null;

  // Persist newly supplied handles so subsequent syncs work from DB state.
  if (
    (requestLeetcode && requestLeetcode !== profile.leetcodeHandle) ||
    (requestCodeforces && requestCodeforces !== profile.codeforcesHandle)
  ) {
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        leetcodeHandle: requestLeetcode ?? profile.leetcodeHandle ?? undefined,
        codeforcesHandle: requestCodeforces ?? profile.codeforcesHandle ?? undefined,
      },
    });
  }

  // Check existing connection and cooldown
  const conn = await prisma.platformConnection.findUnique({
    where: { studentProfileId_platform: { studentProfileId: profile.id, platform: requestedPlatform as P } },
    select: { syncStatus: true, lastSyncedAt: true },
  });

  if (conn?.lastSyncedAt) {
    const elapsed = Date.now() - conn.lastSyncedAt.getTime();
    if (elapsed < SYNC_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 3_600_000);
      return NextResponse.json(
        { error: `Already synced recently. Try again in ${hoursLeft}h.`, cooldown: true },
        { status: 429 }
      );
    }
  }

  // Also skip if currently syncing
  if (conn?.syncStatus === "SYNCING") {
    return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
  }

  // Upsert connection to PENDING
  await prisma.platformConnection.upsert({
    where: { studentProfileId_platform: { studentProfileId: profile.id, platform: requestedPlatform as P } },
    create: { studentProfileId: profile.id, platform: requestedPlatform as P, syncStatus: "PENDING" },
    update: { syncStatus: "PENDING", errorMessage: null },
  });

  // Queue the appropriate ingestion job
  let queued = false;
  let directPath: string | null = null;
  let directPayload: Record<string, unknown> | null = null;
  let directTimeout = 120_000;
  try {
    if (requestedPlatform === "GITHUB" && profile.githubUsername) {
      directPath = "/ingest/github";
      directPayload = { student_profile_id: profile.id, username: profile.githubUsername };
      directTimeout = 600_000;
      await enqueueIngestion({ type: "GITHUB", studentProfileId: profile.id, username: profile.githubUsername });
      queued = true;
    } else if (requestedPlatform === "LEETCODE" && effectiveLeetcode) {
      directPath = "/ingest/leetcode";
      directPayload = { student_profile_id: profile.id, handle: effectiveLeetcode };
      await enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: effectiveLeetcode });
      queued = true;
    } else if (requestedPlatform === "CODEFORCES" && effectiveCodeforces) {
      // Codeforces is handled under LEETCODE type in the worker for now
      directPath = "/ingest/leetcode";
      directPayload = { student_profile_id: profile.id, handle: effectiveCodeforces };
      await enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: effectiveCodeforces });
      queued = true;
    } else if (requestedPlatform === "LINKEDIN") {
      // Try OAuth account first
      const linkedinAccount = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "linkedin" },
        select: { access_token: true, providerAccountId: true },
      });
      if (linkedinAccount?.access_token) {
        directPath = "/ingest/linkedin";
        directPayload = {
          student_profile_id: profile.id,
          oauth_data: {
            access_token: linkedinAccount.access_token,
            provider_account_id: linkedinAccount.providerAccountId,
          },
        };
        await enqueueIngestion({
          type: "LINKEDIN",
          studentProfileId: profile.id,
          oauth_data: { access_token: linkedinAccount.access_token, provider_account_id: linkedinAccount.providerAccountId },
        });
        queued = true;
      } else if (profile.linkedinUrl) {
        directPath = "/ingest/linkedin";
        directPayload = { student_profile_id: profile.id, linkedin_url: profile.linkedinUrl };
        await enqueueIngestion({ type: "LINKEDIN", studentProfileId: profile.id, linkedinUrl: profile.linkedinUrl });
        queued = true;
      }
    }
  } catch (err) {
    console.warn(`[profile/sync] queue enqueue failed for ${requestedPlatform}:`, err);
  }

  const hasDirectFallback = !!(directPath && directPayload);

  if (!queued && !hasDirectFallback) {
    // Revert — nothing to sync
    await prisma.platformConnection.update({
      where: { studentProfileId_platform: { studentProfileId: profile.id, platform: requestedPlatform as P } },
      data: { syncStatus: "FAILED", errorMessage: "No credentials configured for this platform" },
    });
    return NextResponse.json({ error: "No credentials configured for this platform" }, { status: 400 });
  }

  // Increment pending counter for pipeline trigger (best-effort)
  try {
    await redis.incr(`pending_ingestion:${profile.id}`);
    await redis.expire(`pending_ingestion:${profile.id}`, 3600);
  } catch (err) {
    console.warn(`[profile/sync] redis counter update failed for ${requestedPlatform}:`, err);
  }

  // Local-dev reliability: process ingestion even when BullMQ workers are not running.
  if (DIRECT_IN_DEV && directPath && directPayload) {
    void aiClient.post(directPath, directPayload, { timeout: directTimeout }).catch((err: unknown) => {
      console.warn(`[profile/sync] direct ${requestedPlatform} ingest failed:`, err);
    });
  }

  return NextResponse.json({ queued: queued || hasDirectFallback });
}
