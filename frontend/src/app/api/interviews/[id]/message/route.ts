import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message } = await req.json();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const interviewSession = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
  });
  if (!interviewSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Call Python AI service
  const aiRes = await aiClient.post("/interview/message", {
    session_id: id,
    message,
    student_profile_id: profile.id,
  });

  const { message: aiMessage, state, done } = aiRes.data;

  // Append to transcript
  const currentTranscript = Array.isArray(interviewSession.transcript)
    ? interviewSession.transcript
    : [];

  const updatedTranscript = [
    ...currentTranscript,
    { role: "student", content: message, timestamp: new Date().toISOString() },
    { role: "ai", content: aiMessage, timestamp: new Date().toISOString() },
  ];

  await prisma.interviewSession.update({
    where: { id },
    data: { transcript: updatedTranscript },
  });

  return NextResponse.json({ message: aiMessage, state, done });
}
