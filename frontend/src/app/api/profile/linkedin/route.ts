import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueIngestion } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { aiClient } from "@/lib/ai-client";
const DIRECT_IN_DEV = process.env.NODE_ENV !== "production";

/**
 * POST /api/profile/linkedin
 * Save LinkedIn URL and kick off LinkedIn ingestion pipeline.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { linkedinUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const linkedinUrl = body.linkedinUrl?.trim();
  if (!linkedinUrl) {
    return NextResponse.json({ error: "Missing linkedinUrl" }, { status: 400 });
  }

  if (!linkedinUrl.includes("linkedin.com/in/")) {
    return NextResponse.json(
      { error: "Please provide a valid LinkedIn profile URL (e.g. linkedin.com/in/username)" },
      { status: 400 }
    );
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found — complete onboarding first" }, { status: 404 });
  }

  // Save URL to student profile
  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: { linkedinUrl },
  });

  // Upsert LINKEDIN platform connection
  await prisma.platformConnection.upsert({
    where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "LINKEDIN" } },
    create: { studentProfileId: profile.id, platform: "LINKEDIN", syncStatus: "PENDING" },
    update: { syncStatus: "PENDING", errorMessage: null },
  });

  // Try BullMQ worker path
  try {
    await enqueueIngestion({ type: "LINKEDIN", studentProfileId: profile.id, linkedinUrl });
    const key = `pending_ingestion:${profile.id}`;
    await redis.incr(key);
    await redis.expire(key, 3600);

    if (DIRECT_IN_DEV) {
      void aiClient
        .post(
          "/ingest/linkedin",
          { student_profile_id: profile.id, linkedin_url: linkedinUrl },
          { timeout: 180_000 },
        )
        .catch((err: unknown) => {
          console.warn("[linkedin-connect] direct ingest failed:", err);
        });
    }

    return NextResponse.json({ status: "queued" });
  } catch (queueErr) {
    console.warn("[linkedin-connect] BullMQ queue failed, falling back to direct AI call:", queueErr);
  }

  // Fallback: call AI service directly
  try {
    await aiClient.post("/ingest/linkedin", {
      student_profile_id: profile.id,
      linkedin_url: linkedinUrl,
    });
    return NextResponse.json({ status: "done" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "LinkedIn ingestion failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
