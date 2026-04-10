// ─── STREAM WEBHOOK ───────────────────────────────────────────
// TODO: Register this URL in the Stream dashboard so events reach your app:
//   1. Go to https://dashboard.getstream.io → your project → "Webhooks" tab
//   2. Click "Add Endpoint"
//   3. URL: https://<your-ngrok-url>/api/stream/webhook
//      (for local dev: run `ngrok http 3000` to get the URL)
//   4. Select these events:
//        • call.session_started
//        • call.session_participant_left
//        • call.session_ended
//        • call.transcription_ready
//        • call.recording_ready
//   5. Save — Stream will now send signed POST requests here
// ──────────────────────────────────────────────────────────────

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
import { submitHumeBatchJob } from "@/lib/hume";

// Interview type → AI system instructions
const WAIT_RULE = `
CRITICAL RULES — follow these without exception:
1. Ask ONE question, then STOP SPEAKING and wait silently for the candidate to answer.
2. Never answer your own question. Never continue talking after asking a question.
3. Only speak again after the candidate has finished their response.
4. Do not fill silence — silence means the candidate is thinking. Wait.
5. Keep each of your turns under 60 words.`;

const INTERVIEW_INSTRUCTIONS: Record<string, string> = {
  TECHNICAL: `You are a rigorous technical interviewer at a top-tier tech company (Google, Meta, Amazon level).
Conduct a structured technical interview. Start with a brief warm-up question, then ask 2-3 focused technical questions covering data structures, algorithms, or system concepts relevant to a software engineering role.
Probe deeper on weak answers. Evaluate problem-solving approach, code quality thinking, and communication.
Be professional but not cold. Do not reveal your internal scoring.
${WAIT_RULE}`,

  BEHAVIORAL: `You are an experienced HR interviewer conducting a behavioral interview.
Use the STAR format (Situation, Task, Action, Result) to elicit detailed answers. Ask 3-4 questions covering leadership, teamwork, handling failure, and conflict resolution.
Follow up on vague answers. Be warm and encouraging but thorough.
${WAIT_RULE}`,

  HR: `You are a friendly HR representative conducting a culture-fit and career-goals interview.
Ask about the candidate's career goals, strengths and weaknesses, why they want this role, salary expectations, and cultural alignment.
Be conversational and make the candidate feel at ease. Ask 4-5 questions total.
${WAIT_RULE}`,

  SYSTEM_DESIGN: `You are a senior staff engineer conducting a system design interview.
Ask the candidate to design a large-scale distributed system (e.g., URL shortener, social media feed, or ride-sharing backend). Guide them through requirements clarification, high-level design, component deep-dives, and tradeoff discussion.
Probe on scalability, database choices, caching, and failure handling.
${WAIT_RULE}`,

  MIXED: `You are a comprehensive interviewer covering multiple areas.
Conduct an interview with: 2 technical questions (data structures or concepts), 1 behavioral question using STAR format, and 1 situational question.
Adapt your follow-ups based on the candidate's answers. Transition naturally between areas.
${WAIT_RULE}`,
};

function verifyWebhook(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

// Prevent duplicate AI connections when Stream fires session_started multiple times
const aiConnectedCalls = new Set<string>();

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
  console.log(`[stream-webhook] Received event: ${eventType}`);

  if (eventType === "call.session_started") {
    const event = payload as unknown as CallSessionStartedEvent;
    const interviewId = event.call.custom?.interviewId as string;
    const interviewType = (event.call.custom?.interviewType as string) ?? "TECHNICAL";

    console.log(`[stream-webhook] session_started — interviewId=${interviewId} type=${interviewType}`);

    if (!interviewId) {
      console.error("[stream-webhook] Missing interviewId in call.custom");
      return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
    }

    if (aiConnectedCalls.has(interviewId)) {
      console.log(`[stream-webhook] AI already connected for ${interviewId}, skipping duplicate`);
      return NextResponse.json({ status: "ok" });
    }
    aiConnectedCalls.add(interviewId);

    await prisma.interviewSession.updateMany({
      where: { id: interviewId, status: { in: ["UPCOMING", "IN_PROGRESS"] } },
      data: { status: "IN_PROGRESS" },
    });

    const call = streamVideo.video.call("default", interviewId);
    const instructions = INTERVIEW_INSTRUCTIONS[interviewType] ?? INTERVIEW_INSTRUCTIONS.TECHNICAL;

    try {
      console.log(`[stream-webhook] Connecting OpenAI Realtime to call ${interviewId}…`);
      const realtimeClient = await streamVideo.video.connectOpenAi({
        call,
        openAiApiKey: process.env.OPENAI_API_KEY!,
        agentUserId: "ai-interviewer",
        model: "gpt-4o-realtime-preview-2024-12-17",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (realtimeClient.updateSession as any)({
        instructions,
        voice: "alloy",
        // semantic_vad uses Whisper-based understanding of speaker turns —
        // prevents the agent from responding to its own audio echo or silence.
        turn_detection: {
          type: "semantic_vad",
          eagerness: "low",
          create_response: true,
          interrupt_response: false,
        },
        input_audio_noise_reduction: { type: "near_field" },
      });
      console.log(`[stream-webhook] AI agent connected successfully for interview ${interviewId}`);
    } catch (err) {
      console.error(`[stream-webhook] connectOpenAi FAILED for interview ${interviewId}:`, err);
      // Return 200 so Stream doesn't retry — log the error for debugging
    }

  } else if (eventType === "call.session_participant_left") {
    const event = payload as unknown as CallSessionParticipantLeftEvent;
    const interviewId = event.call_cid.split(":")[1];

    if (!interviewId) {
      return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
    }

    const call = streamVideo.video.call("default", interviewId);
    await call.end();

  } else if (eventType === "call.session_ended") {
    const event = payload as unknown as CallEndedEvent;
    const interviewId = event.call.custom?.interviewId as string;

    if (!interviewId) {
      return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
    }

    aiConnectedCalls.delete(interviewId);

    await prisma.interviewSession.updateMany({
      where: { id: interviewId, status: "IN_PROGRESS" },
      data: { status: "PROCESSING", completedAt: new Date() },
    });

  } else if (eventType === "call.transcription_ready") {
    const event = payload as unknown as CallTranscriptionReadyEvent;
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
    const event = payload as unknown as CallRecordingReadyEvent;
    const interviewId = event.call_cid.split(":")[1];

    const saved = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: { recordingUrl: event.call_recording.url },
    });

    // Submit recording to Hume for emotion analysis
    if (process.env.HUME_API_KEY && saved.recordingUrl) {
      try {
        const humeJobId = await submitHumeBatchJob(saved.recordingUrl);
        await prisma.interviewSession.update({
          where: { id: interviewId },
          data: { humeJobId },
        });
        console.log(`[stream-webhook] Hume job submitted: ${humeJobId}`);
      } catch (err) {
        console.error("[stream-webhook] Hume submit failed:", err);
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
