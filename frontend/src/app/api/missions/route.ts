import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const missions = await prisma.mission.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json(missions);
}
