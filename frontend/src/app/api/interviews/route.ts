import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamVideo } from "@/lib/stream-video";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { missionId, type, scheduledAt, jobId, company, role } = await req.json();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const status = scheduledAt ? "UPCOMING" : "IN_PROGRESS";

  const interview = await prisma.interviewSession.create({
    data: {
      studentProfileId: profile.id,
      missionId: missionId ?? undefined,
      interviewType: type ?? "TECHNICAL",
      status,
      transcript: [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
  });

  // Create Stream call with recording + transcription auto-on
  const call = streamVideo.video.call("default", interview.id);
  await call.create({
    data: {
      created_by_id: session.user.id,
      custom: {
        interviewId: interview.id,
        interviewType: type ?? "TECHNICAL",
        jobId: jobId ?? null,
        company: company ?? null,
        role: role ?? null,
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

  // Upsert AI interviewer as a Stream user
  await streamVideo.upsertUsers([
    {
      id: "ai-interviewer",
      name: company ? `${company} Interviewer` : "AI Interviewer",
      role: "user",
    },
  ]);

  const updated = await prisma.interviewSession.update({
    where: { id: interview.id },
    data: { streamCallId: interview.id },
  });

  return NextResponse.json(updated);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    // Use raw SQL with enum casts to text to avoid runtime crashes when generated
    // Prisma enums lag behind database enum values.
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      interviewType: string;
      status: string;
      overallScore: number | null;
      createdAt: Date;
      completedAt: Date | null;
      scheduledAt: Date | null;
      missionTitle: string | null;
    }>>`
      SELECT
        i.id,
        i."interviewType"::text AS "interviewType",
        i.status::text AS status,
        i."overallScore",
        i."createdAt",
        i."completedAt",
        i."scheduledAt",
        m.title AS "missionTitle"
      FROM "InterviewSession" i
      LEFT JOIN "Mission" m ON m.id = i."missionId"
      WHERE i."studentProfileId" = ${profile.id}
      ORDER BY i."createdAt" DESC
    `;

    const sessions = rows.map((r) => ({
      id: r.id,
      interviewType: r.interviewType,
      status: r.status,
      overallScore: r.overallScore,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      scheduledAt: r.scheduledAt,
      mission: r.missionTitle ? { title: r.missionTitle } : null,
    }));

    return NextResponse.json(sessions);
  } catch (err) {
    console.error("[interviews] GET failed:", err);
    return NextResponse.json({ error: "Failed to load interviews" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const deleted = await prisma.interviewSession.deleteMany({
    where: { studentProfileId: profile.id },
  });

  return NextResponse.json({ deleted: deleted.count });
}
