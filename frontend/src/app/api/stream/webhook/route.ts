import { NextRequest, NextResponse } from "next/server";
import {
  CallSessionStartedEvent,
  CallSessionParticipantLeftEvent,
  CallEndedEvent,
  CallTranscriptionReadyEvent,
  CallRecordingReadyEvent,
} from "@stream-io/node-sdk";
import { streamVideo } from "@/lib/stream-video";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";

// Interview type → AI system instructions
const INTERVIEW_INSTRUCTIONS: Record<string, string> = {
  TECHNICAL: `You are a rigorous technical interviewer at a top-tier tech company (Google, Meta, Amazon level).
Conduct a structured technical interview. Start with a brief warm-up question, then ask 2-3 focused technical questions covering data structures, algorithms, or system concepts relevant to a software engineering role.
Probe deeper on weak answers. Evaluate problem-solving approach, code quality thinking, and communication.
Keep each response under 60 words. Be professional but not cold. Do not reveal your internal scoring.`,

  BEHAVIORAL: `You are an experienced HR interviewer conducting a behavioral interview.
Use the STAR format (Situation, Task, Action, Result) to elicit detailed answers. Ask 3-4 questions covering leadership, teamwork, handling failure, and conflict resolution.
Follow up on vague answers. Be warm and encouraging but thorough.
Keep each response under 60 words.`,

  HR: `You are a friendly HR representative conducting a culture-fit and career-goals interview.
Ask about the candidate's career goals, strengths and weaknesses, why they want this role, salary expectations, and cultural alignment.
Be conversational and make the candidate feel at ease. Ask 4-5 questions total.
Keep each response under 60 words.`,

  SYSTEM_DESIGN: `You are a senior staff engineer conducting a system design interview.
Ask the candidate to design a large-scale distributed system (e.g., URL shortener, social media feed, or ride-sharing backend). Guide them through requirements clarification, high-level design, component deep-dives, and tradeoff discussion.
Probe on scalability, database choices, caching, and failure handling.
Keep each response under 80 words.`,

  MIXED: `You are a comprehensive interviewer covering multiple areas.
Conduct an interview with: 2 technical questions (data structures or concepts), 1 behavioral question using STAR format, and 1 situational question.
Adapt your follow-ups based on the candidate's answers. Transition naturally between areas.
Keep each response under 60 words.`,
};

function verifyWebhook(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature");
  const apiKey = req.headers.get("x-api-key");

  if (!signature || !apiKey) {
    return NextResponse.json({ error: "Missing signature or API key" }, { status: 400 });
  }

  const body = await req.text();

  if (!verifyWebhook(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload?.type as string;

  if (eventType === "call.session_started") {
    const event = payload as CallSessionStartedEvent;
    const interviewId = event.call.custom?.interviewId as string;
    const interviewType = (event.call.custom?.interviewType as string) ?? "TECHNICAL";

    if (!interviewId) {
      return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
    }

    // Mark as IN_PROGRESS
    await prisma.interviewSession.updateMany({
      where: { id: interviewId, status: { in: ["UPCOMING", "IN_PROGRESS"] } },
      data: { status: "IN_PROGRESS" },
    });

    const call = streamVideo.video.call("default", interviewId);
    const instructions = INTERVIEW_INSTRUCTIONS[interviewType] ?? INTERVIEW_INSTRUCTIONS.TECHNICAL;

    const realtimeClient = await streamVideo.video.connectOpenAi({
      call,
      openAiApiKey: process.env.OPENAI_API_KEY!,
      agentUserId: "ai-interviewer",
    });

    realtimeClient.updateSession({
      instructions,
      voice: "alloy",
      turn_detection: { type: "server_vad" },
    });

  } else if (eventType === "call.session_participant_left") {
    const event = payload as CallSessionParticipantLeftEvent;
    const interviewId = event.call_cid.split(":")[1];

    if (!interviewId) {
      return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
    }

    const call = streamVideo.video.call("default", interviewId);
    await call.end();

  } else if (eventType === "call.session_ended") {
    const event = payload as CallEndedEvent;
    const interviewId = event.call.custom?.interviewId as string;

    if (!interviewId) {
      return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
    }

    await prisma.interviewSession.updateMany({
      where: { id: interviewId, status: "IN_PROGRESS" },
      data: { status: "PROCESSING", completedAt: new Date() },
    });

  } else if (eventType === "call.transcription_ready") {
    const event = payload as CallTranscriptionReadyEvent;
    const interviewId = event.call_cid.split(":")[1];

    const interview = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: { transcriptUrl: event.call_transcription.url },
    });

    // Trigger AI debrief generation
    try {
      await aiClient.post("/interview/generate-debrief", {
        session_id: interviewId,
        student_profile_id: interview.studentProfileId,
        transcript_url: event.call_transcription.url,
        emotion_data: interview.emotionData ?? null,
        communication_data: interview.communicationData ?? null,
      });
    } catch (err) {
      console.error("[webhook] Debrief generation failed:", err);
    }

  } else if (eventType === "call.recording_ready") {
    const event = payload as CallRecordingReadyEvent;
    const interviewId = event.call_cid.split(":")[1];

    await prisma.interviewSession.update({
      where: { id: interviewId },
      data: { recordingUrl: event.call_recording.url },
    });
  }

  return NextResponse.json({ status: "ok" });
}
