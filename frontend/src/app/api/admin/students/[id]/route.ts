import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getAdminUniversityId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, adminProfile: { select: { universityId: true } } },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") return null;
  return user.adminProfile?.universityId ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uniId = await getAdminUniversityId(session.user.id);
  if (!uniId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const student = await prisma.studentProfile.findFirst({
    where: { id, universityId: uniId },
    include: {
      user: { select: { name: true, email: true, image: true, createdAt: true } },
      readinessScores: { orderBy: { createdAt: "desc" }, take: 10 },
      missions: { orderBy: { orderIndex: "asc" } },
      platformConnections: true,
      applications: {
        include: { job: { select: { title: true, company: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  return NextResponse.json(student);
}
