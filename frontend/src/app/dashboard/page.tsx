import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, image: true } },
      platformConnections: { select: { platform: true, syncStatus: true } },
      readinessScores: { orderBy: { createdAt: "desc" }, take: 2 },
      missions: { orderBy: { orderIndex: "asc" }, take: 5 },
    },
  });

  // Only redirect to onboarding if there's genuinely no profile yet.
  // Once onboardingDone=true, always show dashboard (never redirect back).
  if (!profile) redirect("/onboarding");

  const latest = profile.readinessScores[0] ?? null;
  const prev = profile.readinessScores[1] ?? null;
  const delta = latest && prev ? latest.totalScore - prev.totalScore : null;

  return (
    <DashboardClient
      user={{ name: profile.user.name, image: profile.user.image }}
      profile={{
        targetRole: profile.targetRole,
        streakDays: profile.streakDays,
        segment: profile.segment,
        dreamCompanies: profile.dreamCompanies,
      }}
      readiness={
        latest
          ? {
              total: latest.totalScore,
              dsa: latest.dsaScore,
              dev: latest.devScore,
              comm: latest.commScore,
              consistency: latest.consistencyScore,
              weakTopics: latest.weakTopics,
              delta,
            }
          : null
      }
      missions={profile.missions.map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        status: m.status,
        estimatedHours: m.estimatedHours,
        deadline: m.deadline?.toISOString() ?? null,
      }))}
      connections={profile.platformConnections}
    />
  );
}
