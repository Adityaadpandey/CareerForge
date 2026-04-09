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

  const { platform } = await req.json() as { platform?: string };
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

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

  // Check existing connection and cooldown
  const conn = await prisma.platformConnection.findUnique({
    where: { studentProfileId_platform: { studentProfileId: profile.id, platform: platform as P } },
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
    where: { studentProfileId_platform: { studentProfileId: profile.id, platform: platform as P } },
    create: { studentProfileId: profile.id, platform: platform as P, syncStatus: "PENDING" },
    update: { syncStatus: "PENDING", errorMessage: null },
  });

  // Queue the appropriate ingestion job
  let queued = false;
  let directPath: string | null = null;
  let directPayload: Record<string, unknown> | null = null;
  let directTimeout = 120_000;
  if (platform === "GITHUB" && profile.githubUsername) {
    await enqueueIngestion({ type: "GITHUB", studentProfileId: profile.id, username: profile.githubUsername });
    directPath = "/ingest/github";
    directPayload = { student_profile_id: profile.id, username: profile.githubUsername };
    directTimeout = 600_000;
    queued = true;
  } else if (platform === "LEETCODE" && profile.leetcodeHandle) {
    await enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: profile.leetcodeHandle });
    directPath = "/ingest/leetcode";
    directPayload = { student_profile_id: profile.id, handle: profile.leetcodeHandle };
    queued = true;
  } else if (platform === "CODEFORCES" && profile.codeforcesHandle) {
    // Codeforces is handled under LEETCODE type in the worker for now
    await enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: profile.codeforcesHandle });
    directPath = "/ingest/leetcode";
    directPayload = { student_profile_id: profile.id, handle: profile.codeforcesHandle };
    queued = true;
  } else if (platform === "LINKEDIN") {
    // Try OAuth account first
    const linkedinAccount = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "linkedin" },
      select: { access_token: true, providerAccountId: true },
    });
    if (linkedinAccount?.access_token) {
      await enqueueIngestion({
        type: "LINKEDIN",
        studentProfileId: profile.id,
        oauth_data: { access_token: linkedinAccount.access_token, provider_account_id: linkedinAccount.providerAccountId },
      });
      directPath = "/ingest/linkedin";
      directPayload = {
        student_profile_id: profile.id,
        oauth_data: {
          access_token: linkedinAccount.access_token,
          provider_account_id: linkedinAccount.providerAccountId,
        },
      };
      queued = true;
    } else if (profile.linkedinUrl) {
      await enqueueIngestion({ type: "LINKEDIN", studentProfileId: profile.id, linkedinUrl: profile.linkedinUrl });
      directPath = "/ingest/linkedin";
      directPayload = { student_profile_id: profile.id, linkedin_url: profile.linkedinUrl };
      queued = true;
    }
  }

  if (!queued) {
    // Revert — nothing to sync
    await prisma.platformConnection.update({
      where: { studentProfileId_platform: { studentProfileId: profile.id, platform: platform as P } },
      data: { syncStatus: "FAILED", errorMessage: "No credentials configured for this platform" },
    });
    return NextResponse.json({ error: "No credentials configured for this platform" }, { status: 400 });
  }

  // Increment pending counter for pipeline trigger
  await redis.incr(`pending_ingestion:${profile.id}`);
  await redis.expire(`pending_ingestion:${profile.id}`, 3600);

  // Local-dev reliability: process ingestion even when BullMQ workers are not running.
  if (DIRECT_IN_DEV && directPath && directPayload) {
    void aiClient.post(directPath, directPayload, { timeout: directTimeout }).catch((err: unknown) => {
      console.warn(`[profile/sync] direct ${platform} ingest failed:`, err);
    });
  }

  return NextResponse.json({ queued: true });
}
