import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { requirementsTags: true },
  });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      platformConnections: { select: { platform: true, parsedData: true } },
      readinessScores: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { gapAnalysis: true },
      },
    },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const aiRes = await aiClient.post("/jobs/skill-analysis", {
    requirement_tags: job.requirementsTags,
    platform_data: profile.platformConnections.map((c) => ({
      platform: c.platform,
      data: c.parsedData,
    })),
    gap_analysis: profile.readinessScores[0]?.gapAnalysis ?? null,
  });

  // AI service returns { matched: string[], gaps: string[], suggestions: string[] }
  return NextResponse.json(aiRes.data);
}
