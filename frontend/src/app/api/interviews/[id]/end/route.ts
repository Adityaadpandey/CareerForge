import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { emotionData, communicationData } = body;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const updated = await prisma.interviewSession.updateMany({
    where: { id, studentProfileId: profile.id },
    data: {
      ...(emotionData !== undefined && { emotionData }),
      ...(communicationData !== undefined && { communicationData }),
    },
  });

  return NextResponse.json({ saved: updated.count > 0 });
}
