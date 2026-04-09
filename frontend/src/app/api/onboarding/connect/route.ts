import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueIngestion, enqueueAnalysis } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();

  const leetcodeHandle = formData.get("leetcodeHandle") as string | null;
  const codeforcesHandle = formData.get("codeforcesHandle") as string | null;
  const targetRole = formData.get("targetRole") as string;
  const dreamCompaniesRaw = formData.get("dreamCompanies") as string;
  const timelineWeeks = parseInt(formData.get("timelineWeeks") as string, 10);
  const hoursPerWeek = parseInt(formData.get("hoursPerWeek") as string, 10);

  let dreamCompanies: string[] = [];
  try {
    dreamCompanies = JSON.parse(dreamCompaniesRaw);
  } catch {
    dreamCompanies = [];
  }

  // Get GitHub login from the Account table.
  // providerAccountId from GitHub OAuth is the numeric user ID.
  // We look up the login via GitHub API to ensure we have the actual username.
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  });

  let githubLogin = session.user.name ?? "";
  if (account?.providerAccountId) {
    try {
      const ghRes = await fetch(
        `https://api.github.com/user/${account.providerAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ""}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      if (ghRes.ok) {
        const ghUser = await ghRes.json() as { login: string };
        githubLogin = ghUser.login;
      }
    } catch {
      // Fall back to session name
    }
  }

  // Create or update student profile
  const profile = await prisma.studentProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      githubUsername: account?.providerAccountId ? undefined : undefined, // resolved below
      leetcodeHandle: leetcodeHandle || undefined,
      codeforcesHandle: codeforcesHandle || undefined,
      targetRole,
      dreamCompanies,
      timelineWeeks,
      hoursPerWeek,
      onboardingDone: false,
    },
    update: {
      leetcodeHandle: leetcodeHandle || undefined,
      codeforcesHandle: codeforcesHandle || undefined,
      targetRole,
      dreamCompanies,
      timelineWeeks,
      hoursPerWeek,
    },
  });

  // Update profile with GitHub login and mark onboarding done
  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: { githubUsername: githubLogin, onboardingDone: true },
  });

  // Create platform connection rows (best-effort — queue errors must not block the response)
  const resumeFile = formData.get("resume") as File | null;

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

    if (resumeFile && resumeFile.size > 0) {
      await prisma.platformConnection.upsert({
        where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "RESUME" } },
        create: { studentProfileId: profile.id, platform: "RESUME", syncStatus: "PENDING" },
        update: { syncStatus: "PENDING", errorMessage: null },
      });
    }

    // Queue ingestion + analysis (may fail if Redis is not running in dev)
    await Promise.allSettled([
      enqueueIngestion({ type: "GITHUB", studentProfileId: profile.id, username: githubLogin }),
      leetcodeHandle
        ? enqueueIngestion({ type: "LEETCODE", studentProfileId: profile.id, handle: leetcodeHandle })
        : Promise.resolve(),
      enqueueAnalysis({ type: "GAP_ANALYSIS", studentProfileId: profile.id }),
    ]);
  } catch (err) {
    // Non-fatal: platform connections and queue are best-effort
    console.warn("[onboarding/connect] queue/connection error (non-fatal):", err);
  }

  return NextResponse.json({ profileId: profile.id, status: "ingestion_queued" });
}
