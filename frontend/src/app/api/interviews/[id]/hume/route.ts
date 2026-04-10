import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHumeJobPredictions } from "@/lib/hume";

// Poll for Hume results — called from the debrief page
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const interview = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
    select: { id: true, humeJobId: true, humeAnalysis: true },
  });
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already have results
  if (interview.humeAnalysis) {
    return NextResponse.json({ status: "completed", analysis: interview.humeAnalysis });
  }

  // No job submitted yet
  if (!interview.humeJobId) {
    return NextResponse.json({ status: "pending" });
  }

  // Fetch from Hume
  try {
    const predictions = await getHumeJobPredictions(interview.humeJobId);
    if (!predictions) {
      return NextResponse.json({ status: "processing" });
    }

    await prisma.interviewSession.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { humeAnalysis: predictions as any },
    });

    return NextResponse.json({ status: "completed", analysis: predictions });
  } catch (err) {
    console.error("[hume-poll]", err);
    return NextResponse.json({ status: "error" });
  }
}
