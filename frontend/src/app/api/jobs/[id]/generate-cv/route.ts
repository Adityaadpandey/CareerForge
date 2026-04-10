import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

export async function POST(
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

  const aiRes = await aiClient.post("/jobs/generate-cv", {
    student_profile_id: profile.id,
    job_id: jobId,
  });

  const { cv_markdown } = aiRes.data;

  await prisma.application.upsert({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    create: {
      studentProfileId: profile.id,
      jobId,
      matchScore: 0,
      cvGenerated: cv_markdown,
    },
    update: { cvGenerated: cv_markdown },
  });

  return NextResponse.json({ cv_markdown });
}
