import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  const validStatuses = ["DRAFT", "APPLIED", "VIEWED", "INTERVIEWING", "OFFERED", "REJECTED", "WITHDRAWN"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const application = await prisma.application.updateMany({
    where: { id, studentProfileId: profile.id },
    data: {
      status,
      appliedAt: status === "APPLIED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ updated: application.count });
}
