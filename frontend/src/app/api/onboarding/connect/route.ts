import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueIngestion } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { aiClient } from "@/lib/ai-client";

const DIRECT_IN_DEV = process.env.NODE_ENV !== "production";

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse JSON body
  let body: {
    leetcodeHandle?: string | null;
    codeforcesHandle?: string | null;
    linkedinUrl?: string | null;
    targetRole?: string;
    dreamCompanies?: string[];
    timelineWeeks?: number;
    hoursPerWeek?: number;
  };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[connect] JSON parse failed:", err);
    return NextResponse.json({ error: "Bad request — expected JSON" }, { status: 400 });
  }

  const leetcodeHandle = body.leetcodeHandle || null;
  const codeforcesHandle = body.codeforcesHandle || null;
  const linkedinUrl = body.linkedinUrl || null;
  const targetRole = body.targetRole || "SDE";
  const timelineWeeks = Number(body.timelineWeeks) || 12;
  const hoursPerWeek = Number(body.hoursPerWeek) || 10;
  const dreamCompanies = Array.isArray(body.dreamCompanies) ? body.dreamCompanies : [];

  // 3. GitHub login — use session name (now set to login via profile() callback),
  //    fall back to looking up from account table if that's stale.
  let githubLogin = session.user.name ?? "";
  try {
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "github" },
      select: { providerAccountId: true },
    });
    if (account?.providerAccountId && process.env.GITHUB_TOKEN) {
      const ghRes = await fetch(
        `https://api.github.com/user/${account.providerAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (ghRes.ok) {
        const ghUser = (await ghRes.json()) as { login: string };
        githubLogin = ghUser.login;
      }
    }
  } catch {
    // Non-fatal — use session name
  }

  // 4. Upsert student profile
  let profile: { id: string };
  try {
    profile = await prisma.studentProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        githubUsername: githubLogin || undefined,
        leetcodeHandle: leetcodeHandle || undefined,
        codeforcesHandle: codeforcesHandle || undefined,
        targetRole,
        dreamCompanies,
        timelineWeeks,
        hoursPerWeek,
        onboardingDone: true,
      },
      update: {
        githubUsername: githubLogin || undefined,
        leetcodeHandle: leetcodeHandle || undefined,
        codeforcesHandle: codeforcesHandle || undefined,
        targetRole,
        dreamCompanies,
        timelineWeeks,
        hoursPerWeek,
        onboardingDone: true,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[connect] profile upsert failed:", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  // 5. Platform connections + queue (best-effort — failures must not block response)
  try {
    await prisma.platformConnection.upsert({
      where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "GITHUB" } },
      create: { studentProfileId: profile.id, platform: "GITHUB", syncStatus: "PENDING" },
      update: { syncStatus: "PENDING", errorMessage: null },
    });

    if (leetcodeHandle) {
      await prisma.platformConnection.upsert({
        where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "LEETCODE" } },
        create: { studentProfileId: profile.id, platform: "LEETCODE", syncStatus: "PENDING" },
        update: { syncStatus: "PENDING", errorMessage: null },
      });
    }

    const ingestionJobs = [
      enqueueIngestion({ type: "GITHUB", studentProfileId: profile.id, username: githubLogin }),
    ];
    const directIngestionCalls: Array<() => Promise<unknown>> = [
      () => aiClient.post(
        "/ingest/github",
        { student_profile_id: profile.id, username: githubLogin },
        { timeout: 600_000 },
      ),
    ];
    if (leetcodeHandle) {
      ingestionJobs.push(
        enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: leetcodeHandle })
      );
      directIngestionCalls.push(
        () => aiClient.post(
          "/ingest/leetcode",
          { student_profile_id: profile.id, handle: leetcodeHandle },
          { timeout: 120_000 },
        )
      );
    }

    // LinkedIn: URL fallback path
    if (linkedinUrl) {
      await prisma.studentProfile.update({
        where: { id: profile.id },
        data: { linkedinUrl },
      });
      await prisma.platformConnection.upsert({
        where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "LINKEDIN" } },
        create: { studentProfileId: profile.id, platform: "LINKEDIN", syncStatus: "PENDING" },
        update: { syncStatus: "PENDING", errorMessage: null },
      });
      ingestionJobs.push(
        enqueueIngestion({ type: "LINKEDIN", studentProfileId: profile.id, linkedinUrl })
      );
      directIngestionCalls.push(
        () => aiClient.post(
          "/ingest/linkedin",
          { student_profile_id: profile.id, linkedin_url: linkedinUrl },
          { timeout: 180_000 },
        )
      );
    } else {
      // LinkedIn: OAuth path — check if user linked LinkedIn account during onboarding
      const linkedinAccount = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "linkedin" },
        select: { access_token: true, providerAccountId: true },
      });
      if (linkedinAccount?.access_token) {
        await prisma.platformConnection.upsert({
          where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "LINKEDIN" } },
          create: { studentProfileId: profile.id, platform: "LINKEDIN", syncStatus: "PENDING" },
          update: { syncStatus: "PENDING", errorMessage: null },
        });
        ingestionJobs.push(
          enqueueIngestion({
            type: "LINKEDIN",
            studentProfileId: profile.id,
            oauth_data: {
              access_token: linkedinAccount.access_token,
              provider_account_id: linkedinAccount.providerAccountId,
            },
          })
        );
        directIngestionCalls.push(
          () => aiClient.post(
            "/ingest/linkedin",
            {
              student_profile_id: profile.id,
              oauth_data: {
                access_token: linkedinAccount.access_token,
                provider_account_id: linkedinAccount.providerAccountId,
              },
            },
            { timeout: 180_000 },
          )
        );
      }
    }

    // Set Redis counter so the worker knows how many ingestion jobs to wait for
    await redis.set(`pending_ingestion:${profile.id}`, ingestionJobs.length, "EX", 3600);
    await Promise.allSettled(ingestionJobs);

    if (DIRECT_IN_DEV) {
      for (const run of directIngestionCalls) {
        void run().catch((err: unknown) => {
          console.warn("[connect] direct ingest failed (non-fatal):", err);
        });
      }
    }
  } catch (err) {
    console.warn("[connect] queue/connections error (non-fatal):", err);
  }

  return NextResponse.json({ profileId: profile.id, status: "queued" });
}
