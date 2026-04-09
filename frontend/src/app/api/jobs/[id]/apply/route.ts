import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Call AI service to generate CV + cover letter
  const aiRes = await aiClient.post("/jobs/apply", {
    student_profile_id: profile.id,
    job_id: jobId,
  });

  const { cv_markdown, cover_letter, match_score } = aiRes.data;

  // Create or update application
  const application = await prisma.application.upsert({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    create: {
      studentProfileId: profile.id,
      jobId,
      matchScore: match_score ?? 0,
      status: "DRAFT",
      cvGenerated: cv_markdown,
      coverLetter: cover_letter,
    },
    update: {
      cvGenerated: cv_markdown,
      coverLetter: cover_letter,
      status: "DRAFT",
    },
  });

  return NextResponse.json(application);
}
