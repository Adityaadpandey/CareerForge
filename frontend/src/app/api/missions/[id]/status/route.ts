import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueNotify } from "@/lib/queue";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const mission = await prisma.mission.update({
    where: { id, studentProfileId: profile.id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });

  if (status === "COMPLETED") {
    // Create interview session and notify
    const session_interview = await prisma.interviewSession.create({
      data: {
        studentProfileId: profile.id,
        missionId: mission.id,
        interviewType: "TECHNICAL",
        status: "IN_PROGRESS",
        transcript: [],
      },
    });

    await enqueueNotify({
      userId: session.user.id,
      type: "INTERVIEW_READY",
      title: `Interview ready: ${mission.title}`,
      body: "You've completed a mission. Start your mock interview now.",
      actionUrl: `/interview/${session_interview.id}`,
    });

    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "INTERVIEW_READY",
        title: `Interview ready: ${mission.title}`,
        body: "You've completed a mission. Start your mock interview now.",
        actionUrl: `/interview/${session_interview.id}`,
      },
    });
  }

  return NextResponse.json(mission);
}
