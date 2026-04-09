import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: session.user.id },
    select: { universityId: true },
  });
  if (!adminProfile) return NextResponse.json({ error: "Admin profile not found" }, { status: 404 });

  const universityId = adminProfile.universityId;

  // Aggregate stats
  const [students, segmentCounts, recentScores] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { universityId },
      select: {
        id: true,
        segment: true,
        streakDays: true,
        targetRole: true,
        onboardingDone: true,
        user: { select: { name: true, email: true, image: true } },
        readinessScores: { orderBy: { createdAt: "desc" }, take: 1 },
        missions: { where: { status: "COMPLETED" } },
      },
    }),
    prisma.studentProfile.groupBy({
      by: ["segment"],
      where: { universityId },
      _count: true,
    }),
    prisma.readinessScore.findMany({
      where: { studentProfile: { universityId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { totalScore: true, createdAt: true },
    }),
  ]);

  const avgScore =
    recentScores.length > 0
      ? recentScores.reduce((s, r) => s + r.totalScore, 0) / recentScores.length
      : 0;

  return NextResponse.json({
    universityId,
    totalStudents: students.length,
    onboarded: students.filter((s) => s.onboardingDone).length,
    avgReadiness: Math.round(avgScore),
    segments: Object.fromEntries(segmentCounts.map((s) => [s.segment, s._count])),
    students: students.map((s) => ({
      id: s.id,
      name: s.user.name,
      email: s.user.email,
      image: s.user.image,
      segment: s.segment,
      streak: s.streakDays,
      targetRole: s.targetRole,
      readiness: s.readinessScores[0]?.totalScore ?? null,
      missionsCompleted: s.missions.length,
      onboardingDone: s.onboardingDone,
    })),
  });
}
