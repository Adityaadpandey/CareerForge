import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueNotify } from "@/lib/queue";
import { streamVideo } from "@/lib/stream-video";

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

    // Keep mission-completion interview flow aligned with /api/interviews.
    let interviewActionUrl = `/interview/${session_interview.id}`;
    try {
      const call = streamVideo.video.call("default", session_interview.id);
      await call.create({
        data: {
          created_by_id: session.user.id,
          custom: {
            interviewId: session_interview.id,
            interviewType: "TECHNICAL",
          },
          settings_override: {
            transcription: {
              language: "en",
              mode: "auto-on",
              closed_caption_mode: "auto-on",
            },
            recording: {
              mode: "auto-on",
              quality: "1080p",
            },
          },
        },
      });

      await streamVideo.upsertUsers([
        {
          id: "ai-interviewer",
          name: "AI Interviewer",
          role: "user",
        },
      ]);

      await prisma.interviewSession.update({
        where: { id: session_interview.id },
        data: { streamCallId: session_interview.id },
      });

      interviewActionUrl = `/interview/${session_interview.id}/call`;
    } catch (err) {
      console.error("[missions/status] Stream setup failed for mission interview:", err);
    }

    await enqueueNotify({
      userId: session.user.id,
      type: "INTERVIEW_READY",
      title: `Interview ready: ${mission.title}`,
      body: "You've completed a mission. Start your mock interview now.",
      actionUrl: interviewActionUrl,
    });

    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "INTERVIEW_READY",
        title: `Interview ready: ${mission.title}`,
        body: "You've completed a mission. Start your mock interview now.",
        actionUrl: interviewActionUrl,
      },
    });

    // Auto-unlock the next missions in the linear roadmap sequence
    const nextMissions = await prisma.mission.findMany({
      where: {
        studentProfileId: profile.id,
        prerequisiteIds: { has: id },
        status: "LOCKED",
      },
    });

    if (nextMissions.length > 0) {
      await prisma.mission.updateMany({
        where: { id: { in: nextMissions.map((m) => m.id) } },
        data: { status: "AVAILABLE" },
      });

      // Optionally notify them that new missions are unlocked
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: "MISSION_AVAILABLE",
          title: "New Mission Unlocked!",
          body: `You unlocked ${nextMissions.length} new mission(s). Keep up the momentum!`,
        },
      });
    }
  }

  return NextResponse.json(mission);
}
