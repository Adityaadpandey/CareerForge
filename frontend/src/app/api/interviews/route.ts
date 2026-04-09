import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { missionId, type } = await req.json();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const interview = await prisma.interviewSession.create({
    data: {
      studentProfileId: profile.id,
      missionId: missionId ?? undefined,
      interviewType: type ?? "TECHNICAL",
      status: "IN_PROGRESS",
      transcript: [],
    },
  });

  return NextResponse.json(interview);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const sessions = await prisma.interviewSession.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { mission: { select: { title: true } } },
  });

  return NextResponse.json(sessions);
}
