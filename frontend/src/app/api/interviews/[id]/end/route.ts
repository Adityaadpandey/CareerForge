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

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Ask AI service to generate debrief
  const aiRes = await aiClient.post("/interview/end", {
    session_id: id,
    student_profile_id: profile.id,
  });

  const { debrief, overall_score } = aiRes.data;

  const updated = await prisma.interviewSession.update({
    where: { id, studentProfileId: profile.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      debrief,
      overallScore: overall_score,
    },
  });

  return NextResponse.json(updated);
}
