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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uniId = await getAdminUniversityId(session.user.id);
  if (!uniId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const drives = await prisma.companyDrive.findMany({
    where: { universityId: uniId },
    orderBy: { driveDate: "desc" },
  });

  return NextResponse.json(drives);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uniId = await getAdminUniversityId(session.user.id);
  if (!uniId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { companyName, roles, driveDate, eligibility } = body;

  if (!companyName || !driveDate) {
    return NextResponse.json({ error: "companyName and driveDate are required" }, { status: 400 });
  }

  const drive = await prisma.companyDrive.create({
    data: {
      universityId: uniId,
      companyName,
      roles: Array.isArray(roles) ? roles : [],
      driveDate: new Date(driveDate),
      eligibility: eligibility ?? {},
    },
  });

  return NextResponse.json(drive, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uniId = await getAdminUniversityId(session.user.id);
  if (!uniId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.companyDrive.deleteMany({ where: { id, universityId: uniId } });
  return NextResponse.json({ deleted: true });
}
