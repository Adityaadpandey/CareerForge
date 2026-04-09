import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Get jobs with match scores for this student
  const applications = await prisma.application.findMany({
    where: { studentProfileId: profile.id },
    select: { jobId: true, matchScore: true, status: true },
  });
  const matchMap = new Map(applications.map((a) => [a.jobId, a]));

  const jobs = await prisma.job.findMany({
    skip,
    take: limit,
    orderBy: { scrapedAt: "desc" },
  });

  const savedJobs = await prisma.savedJob.findMany({
    where: { studentProfileId: profile.id },
    select: { jobId: true },
  });
  const savedSet = new Set(savedJobs.map((s) => s.jobId));

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      matchScore: matchMap.get(j.id)?.matchScore ?? null,
      applicationStatus: matchMap.get(j.id)?.status ?? null,
      isSaved: savedSet.has(j.id),
    })),
    page,
    hasMore: jobs.length === limit,
  });
}
