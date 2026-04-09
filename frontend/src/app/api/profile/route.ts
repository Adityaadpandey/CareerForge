import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true, image: true } },
      platformConnections: { select: { platform: true, syncStatus: true, lastSyncedAt: true } },
      readinessScores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = [
    "targetRole", "dreamCompanies", "timelineWeeks", "hoursPerWeek", "linkedinUrl",
    "department", "graduationYear", "githubUsername", "leetcodeHandle", "codeforcesHandle",
  ];
  const data = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  const profile = await prisma.studentProfile.update({
    where: { userId: session.user.id },
    data,
  });

  return NextResponse.json(profile);
}
