import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";
import { enqueueIngestion } from "@/lib/queue";
import { redis } from "@/lib/redis";

/**
 * POST /api/profile/resume
 * Accept a multipart PDF upload, encode as base64, and kick off resume ingestion.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("resume");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'resume' file field" }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.type.includes("pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }

  // 10 MB limit
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large — max 10 MB" }, { status: 413 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found — complete onboarding first" }, { status: 404 });
  }

  // Encode PDF to base64 for transport to AI service
  const arrayBuffer = await file.arrayBuffer();
  const pdfB64 = Buffer.from(arrayBuffer).toString("base64");

  // Upsert RESUME platform connection to PENDING
  await prisma.platformConnection.upsert({
    where: { studentProfileId_platform: { studentProfileId: profile.id, platform: "RESUME" } },
    create: { studentProfileId: profile.id, platform: "RESUME", syncStatus: "PENDING" },
    update: { syncStatus: "PENDING", errorMessage: null },
  });

  // Try BullMQ worker path first (async, reliable)
  try {
    await enqueueIngestion({ type: "RESUME", studentProfileId: profile.id, fileKey: pdfB64 });
    // Increment Redis counter so worker knows to wait for 1 more job
    const key = `pending_ingestion:${profile.id}`;
    await redis.incr(key);
    await redis.expire(key, 3600);
    return NextResponse.json({ status: "queued" });
  } catch (queueErr) {
    console.warn("[resume-upload] BullMQ queue failed, falling back to direct AI call:", queueErr);
  }

  // Fallback: call AI service directly (synchronous — longer response time)
  try {
    await aiClient.post("/ingest/resume", {
      student_profile_id: profile.id,
      pdf_b64: pdfB64,
    });
    return NextResponse.json({ status: "done" });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Resume ingestion failed", detail: err?.message },
      { status: 502 }
    );
  }
}
