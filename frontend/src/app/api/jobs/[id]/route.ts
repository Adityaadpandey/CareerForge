import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const application = await prisma.application.findUnique({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    select: { matchScore: true, status: true, cvGenerated: true, coverLetter: true },
  });

  const savedJob = await prisma.savedJob.findUnique({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    select: { id: true },
  });

  return NextResponse.json({
    ...job,
    matchScore: application?.matchScore ?? null,
    applicationStatus: application?.status ?? null,
    cvGenerated: application?.cvGenerated ?? null,
    coverLetter: application?.coverLetter ?? null,
    isSaved: !!savedJob,
  });
}
