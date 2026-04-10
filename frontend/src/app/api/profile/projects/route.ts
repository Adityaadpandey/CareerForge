import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const projects = await prisma.project.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json();
  const { name, description, techStack, liveUrl, repoUrl } = body;

  if (!name?.trim() || !description?.trim())
    return NextResponse.json({ error: "Name and description are required" }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      studentProfileId: profile.id,
      name: name.trim(),
      description: description.trim(),
      techStack: Array.isArray(techStack) ? techStack : [],
      liveUrl: liveUrl?.trim() || null,
      repoUrl: repoUrl?.trim() || null,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
