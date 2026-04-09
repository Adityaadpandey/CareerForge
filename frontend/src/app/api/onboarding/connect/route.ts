import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueIngestion } from "@/lib/queue";
import { redis } from "@/lib/redis";

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
    if (leetcodeHandle) {
      ingestionJobs.push(
        enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: leetcodeHandle })
      );
    }
    // Set Redis counter so the worker knows how many ingestion jobs to wait for
    await redis.set(`pending_ingestion:${profile.id}`, ingestionJobs.length, "EX", 3600);
    await Promise.allSettled(ingestionJobs);
  } catch (err) {
    console.warn("[connect] queue/connections error (non-fatal):", err);
  }

  return NextResponse.json({ profileId: profile.id, status: "queued" });
}
