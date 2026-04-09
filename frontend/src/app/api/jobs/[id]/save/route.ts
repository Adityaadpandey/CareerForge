import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const existing = await prisma.savedJob.findUnique({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
  });

  if (existing) {
    await prisma.savedJob.delete({
      where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedJob.create({
    data: { studentProfileId: profile.id, jobId },
  });
  return NextResponse.json({ saved: true });
}
