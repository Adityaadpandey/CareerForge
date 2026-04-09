import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

/**
 * POST /api/analyze/trigger
 * Manually re-runs the gap analysis + roadmap pipeline for the current user.
 * Useful when ingestion completed but the pipeline didn't trigger automatically.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      platformConnections: { select: { platform: true, syncStatus: true } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // PENDING = never started (user didn't connect that platform) — don't block on these.
  // Only SYNCING means ingestion is actively in progress.
  const syncing = profile.platformConnections.filter((c) => c.syncStatus === "SYNCING");
  if (syncing.length > 0) {
    return NextResponse.json({
      error: "Ingestion still in progress",
      syncing: syncing.map((c) => c.platform),
    }, { status: 409 });
  }

  // Fire gap analysis — AI service handles the chain (roadmap → jobs)
  try {
    await aiClient.post("/analyze/gap", { student_profile_id: profile.id });
    await aiClient.post("/analyze/roadmap", { student_profile_id: profile.id });
    return NextResponse.json({ status: "triggered", profileId: profile.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: "AI service error", detail: err?.message },
      { status: 502 }
    );
  }
}
