import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, adminProfile: { select: { universityId: true } } },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const uniId = user.adminProfile?.universityId;
  if (!uniId) return NextResponse.json({ error: "No admin profile" }, { status: 404 });

  const [profiles, allScores, missions] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { universityId: uniId },
      select: {
        id: true,
        segment: true,
        targetRole: true,
        department: true,
        graduationYear: true,
        streakDays: true,
        readinessScores: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { totalScore: true, dsaScore: true, devScore: true, commScore: true, consistencyScore: true, weakTopics: true },
        },
      },
    }),
    // Last 30 days of scores for trend
    prisma.readinessScore.findMany({
      where: {
        studentProfile: { universityId: uniId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "asc" },
      select: { totalScore: true, createdAt: true },
    }),
    prisma.mission.groupBy({
      by: ["status"],
      where: { studentProfile: { universityId: uniId } },
      _count: true,
    }),
  ]);

  // Pillar averages
  const scored = profiles.filter((p) => p.readinessScores.length > 0);
  const avg = (key: "totalScore" | "dsaScore" | "devScore" | "commScore" | "consistencyScore") =>
    scored.length === 0
      ? 0
      : Math.round(scored.reduce((s, p) => s + (p.readinessScores[0]?.[key] ?? 0), 0) / scored.length);

  // Bucket scores into ranges for distribution
  const distribution = [0, 20, 40, 60, 80, 100].slice(0, -1).map((lo, i, arr) => {
    const hi = [20, 40, 60, 80, 100][i];
    return {
      range: `${lo}–${hi}`,
      count: scored.filter((p) => {
        const s = p.readinessScores[0]?.totalScore ?? 0;
        return s >= lo && s < hi;
      }).length,
    };
  });

  // Daily trend (group by date)
  const trendMap = new Map<string, { sum: number; count: number }>();
  for (const s of allScores) {
    const day = s.createdAt.toISOString().slice(0, 10);
    const existing = trendMap.get(day) ?? { sum: 0, count: 0 };
    trendMap.set(day, { sum: existing.sum + s.totalScore, count: existing.count + 1 });
  }
  const trend = Array.from(trendMap.entries())
    .map(([date, { sum, count }]) => ({ date, avg: Math.round(sum / count) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top weak topics across all students
  const topicFreq = new Map<string, number>();
  for (const p of scored) {
    for (const t of p.readinessScores[0]?.weakTopics ?? []) {
      topicFreq.set(t, (topicFreq.get(t) ?? 0) + 1);
    }
  }
  const weakTopics = Array.from(topicFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // Role distribution
  const roleFreq = new Map<string, number>();
  for (const p of profiles) {
    if (p.targetRole) roleFreq.set(p.targetRole, (roleFreq.get(p.targetRole) ?? 0) + 1);
  }
  const roles = Array.from(roleFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([role, count]) => ({ role, count }));

  // Mission status breakdown
  const missionStats = Object.fromEntries(missions.map((m) => [m.status, m._count]));

  return NextResponse.json({
    pillars: {
      total: avg("totalScore"),
      dsa: avg("dsaScore"),
      dev: avg("devScore"),
      comm: avg("commScore"),
      consistency: avg("consistencyScore"),
    },
    distribution,
    trend,
    weakTopics,
    roles,
    missionStats,
    totalAssessed: scored.length,
    totalStudents: profiles.length,
  });
}
