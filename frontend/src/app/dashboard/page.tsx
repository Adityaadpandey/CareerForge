import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

function formatRelativeTime(date: Date | string | null) {
  if (!date) return "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (hours < 1)  return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      user:               { select: { name: true, image: true } },
      platformConnections:{ select: { platform: true, syncStatus: true, lastSyncedAt: true, parsedData: true } },
      readinessScores:    { orderBy: { createdAt: "desc" }, take: 2 },
      missions:           { orderBy: { orderIndex: "asc" }, take: 5 },
    },
  });

  if (!profile) redirect("/onboarding");

  /* ── job matches from applications ─────────────────────────────────────── */
  const applications = await prisma.application.findMany({
    where:   { studentProfileId: profile.id },
    orderBy: { matchScore: "desc" },
    take:    5,
    include: { job: { select: { id: true, title: true, company: true, applyUrl: true, location: true, isRemote: true } } },
  });

  /* ── counts ─────────────────────────────────────────────────────────────── */
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [interviewCount, applicationCount, notificationCount] = await Promise.all([
    prisma.interviewSession.count({
      where: { studentProfileId: profile.id, status: "COMPLETED", completedAt: { gte: weekAgo } },
    }),
    prisma.application.count({
      where: { studentProfileId: profile.id, status: { in: ["APPLIED", "VIEWED", "INTERVIEWING", "OFFERED"] } },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  /* ── recent activity feed ────────────────────────────────────────────────── */
  const [completedMissions, completedInterviews, recentApps] = await Promise.all([
    prisma.mission.findMany({
      where:   { studentProfileId: profile.id, status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take:    4,
      select:  { title: true, completedAt: true },
    }),
    prisma.interviewSession.findMany({
      where:   { studentProfileId: profile.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take:    3,
      select:  { completedAt: true, interviewType: true, overallScore: true },
    }),
    prisma.application.findMany({
      where:   { studentProfileId: profile.id, status: { not: "DRAFT" } },
      orderBy: { appliedAt: "desc" },
      take:    3,
      include: { job: { select: { title: true, company: true } } },
    }),
  ]);

  type RawEvent = { dot: string; html: string; ts: Date | null };
  const raw: RawEvent[] = [
    ...completedMissions.map((m) => ({
      dot: "#22c55e", html: `Mission <b>${m.title}</b> completed`, ts: m.completedAt,
    })),
    ...completedInterviews.map((i) => ({
      dot: "#a855f7",
      html: `${i.interviewType.charAt(0) + i.interviewType.slice(1).toLowerCase()} interview completed` +
            (i.overallScore ? ` · <b>${Math.round(i.overallScore)}%</b>` : ""),
      ts: i.completedAt,
    })),
    ...recentApps.map((a) => ({
      dot: "#f97316", html: `Applied to <b>${a.job.title}</b> at ${a.job.company}`, ts: a.appliedAt,
    })),
  ];
  const recentActivity = raw
    .filter((e) => e.ts !== null)
    .sort((a, b) => b.ts!.getTime() - a.ts!.getTime())
    .slice(0, 5)
    .map((e) => ({ dot: e.dot, html: e.html, time: formatRelativeTime(e.ts) }));

  /* ── readiness ───────────────────────────────────────────────────────────── */
  const latest = profile.readinessScores[0] ?? null;
  const prev   = profile.readinessScores[1] ?? null;
  const delta  = latest && prev ? latest.totalScore - prev.totalScore : null;

  return (
    <DashboardClient
      user={{ name: profile.user.name, image: profile.user.image }}
      profile={{
        targetRole:     profile.targetRole,
        streakDays:     profile.streakDays,
        segment:        profile.segment,
        dreamCompanies: profile.dreamCompanies,
      }}
      readiness={
        latest ? {
          total:       latest.totalScore,
          dsa:         latest.dsaScore,
          dev:         latest.devScore,
          comm:        latest.commScore,
          consistency: latest.consistencyScore,
          weakTopics:  latest.weakTopics,
          delta,
        } : null
      }
      missions={profile.missions.map((m) => ({
        id:             m.id,
        title:          m.title,
        type:           m.type,
        status:         m.status,
        estimatedHours: m.estimatedHours,
        deadline:       m.deadline?.toISOString() ?? null,
      }))}
      connections={profile.platformConnections.map((c) => ({
        platform:     c.platform,
        syncStatus:   c.syncStatus,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        parsedData:   c.parsedData as Record<string, unknown> | null,
      }))}
      jobMatches={applications.map((a) => ({
        id:        a.job.id,
        company:   a.job.company,
        title:     a.job.title,
        matchScore:a.matchScore,
        applyUrl:  a.job.applyUrl,
        location:  a.job.location,
        isRemote:  a.job.isRemote,
      }))}
      interviewCount={interviewCount}
      applicationCount={applicationCount}
      notificationCount={notificationCount}
      recentActivity={recentActivity}
    />
  );
}
