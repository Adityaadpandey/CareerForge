# Real-Time AI Interview System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-based mock interview with a real-time voice+video interview room powered by Stream Video SDK + OpenAI Realtime API, with post-call emotion analysis and an enhanced scorecard.

**Architecture:** Stream Video SDK hosts the video room; when the call starts, a Stream webhook fires `connectOpenAi` server-side so the AI joins as a voice participant. face-api.js runs client-side during the call to collect facial emotion data every 2s. When the call ends, Stream delivers a transcript via webhook which is fed to the Python AI service to generate the enhanced debrief.

**Tech Stack:** `@stream-io/video-react-sdk`, `@stream-io/node-sdk`, `face-api.js`, Next.js 16 API routes, Prisma, next-auth, Python FastAPI AI service.

**Reference:** All call components are adapted from `saasai-master/src/modules/call/ui/components/`. Read those files when implementing each component.

---

## Task 1: Prisma Schema — Add Interview Fields

**Files:**
- Modify: `frontend/prisma/schema.prisma`

- [ ] **Step 1: Open schema and add 6 fields + 2 new enum values**

In `frontend/prisma/schema.prisma`, find `model InterviewSession` and replace with:

```prisma
model InterviewSession {
  id               String          @id @default(cuid())
  studentProfileId String
  missionId        String?
  interviewType    InterviewType
  status           InterviewStatus @default(IN_PROGRESS)
  transcript       Json
  debrief          Json?
  sentimentScores  Json?
  overallScore     Float?
  createdAt        DateTime        @default(now())
  completedAt      DateTime?

  // Stream Video fields
  streamCallId     String?
  scheduledAt      DateTime?
  recordingUrl     String?
  transcriptUrl    String?
  emotionData      Json?
  communicationData Json?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id])
  mission        Mission?       @relation(fields: [missionId], references: [id])
}
```

Find `enum InterviewStatus` and replace with:

```prisma
enum InterviewStatus {
  UPCOMING
  IN_PROGRESS
  PROCESSING
  COMPLETED
  ABANDONED
}
```

- [ ] **Step 2: Run migration**

```bash
cd frontend && npx prisma migrate dev --name add_stream_interview_fields
```

Expected: Migration created and applied. `npx prisma generate` runs automatically.

- [ ] **Step 3: Commit**

```bash
git add frontend/prisma/schema.prisma frontend/prisma/migrations/
git commit -m "feat(db): add stream call fields and UPCOMING/PROCESSING statuses to InterviewSession"
```

---

## Task 2: Install Packages + Create Stream Server Client

**Files:**
- Create: `frontend/src/lib/stream-video.ts`
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1: Install Stream SDK packages**

```bash
cd frontend && npm install @stream-io/video-react-sdk @stream-io/node-sdk face-api.js
```

Expected: packages appear in `node_modules/`, `package.json` updated.

- [ ] **Step 2: Create the server-side Stream client**

Create `frontend/src/lib/stream-video.ts`:

```typescript
import "server-only";
import { StreamClient } from "@stream-io/node-sdk";

export const streamVideo = new StreamClient(
  process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
  process.env.STREAM_VIDEO_SECRET_KEY!,
);
```

- [ ] **Step 3: Add env vars to .env.local (user action)**

The user must add to `frontend/.env.local`:
```
NEXT_PUBLIC_STREAM_VIDEO_API_KEY=your_stream_api_key
STREAM_VIDEO_SECRET_KEY=your_stream_secret_key
```

Get these from https://dashboard.getstream.io → create a Video project.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/stream-video.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: install stream SDK packages and create server stream client"
```

---

## Task 3: Stream Token API Route

**Files:**
- Create: `frontend/src/app/api/interviews/token/route.ts`

- [ ] **Step 1: Create the token route**

Create `frontend/src/app/api/interviews/token/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamVideo } from "@/lib/stream-video";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await streamVideo.upsertUsers([
    {
      id: session.user.id,
      name: session.user.name ?? "Student",
      role: "admin",
      image: session.user.image ?? undefined,
    },
  ]);

  const expirationTime = Math.floor(Date.now() / 1000) + 3600;
  const issuedAt = Math.floor(Date.now() / 1000) - 60;

  const token = streamVideo.generateUserToken({
    user_id: session.user.id,
    exp: expirationTime,
    validity_in_seconds: issuedAt,
  });

  return NextResponse.json({ token });
}
```

- [ ] **Step 2: Verify it returns a token**

Start the dev server and run:
```bash
curl http://localhost:3000/api/interviews/token
```
Expected (when logged in via browser cookie): `{"token": "eyJ..."}`. Without auth: `{"error":"Unauthorized"}`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/interviews/token/route.ts
git commit -m "feat: add Stream token API route for interview video calls"
```

---

## Task 4: Update POST /api/interviews to Create a Stream Call

**Files:**
- Modify: `frontend/src/app/api/interviews/route.ts`

- [ ] **Step 1: Update the POST handler**

Open `frontend/src/app/api/interviews/route.ts`. Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamVideo } from "@/lib/stream-video";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { missionId, type, scheduledAt } = await req.json();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const status = scheduledAt ? "UPCOMING" : "IN_PROGRESS";

  const interview = await prisma.interviewSession.create({
    data: {
      studentProfileId: profile.id,
      missionId: missionId ?? undefined,
      interviewType: type ?? "TECHNICAL",
      status,
      transcript: [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
  });

  // Create Stream call with recording + transcription auto-on
  const call = streamVideo.video.call("default", interview.id);
  await call.create({
    data: {
      created_by_id: session.user.id,
      custom: {
        interviewId: interview.id,
        interviewType: type ?? "TECHNICAL",
      },
      settings_override: {
        transcription: {
          language: "en",
          mode: "auto-on",
          closed_caption_mode: "auto-on",
        },
        recording: {
          mode: "auto-on",
          quality: "1080p",
        },
      },
    },
  });

  // Upsert the AI interviewer as a Stream user
  await streamVideo.upsertUsers([
    {
      id: "ai-interviewer",
      name: "AI Interviewer",
      role: "user",
    },
  ]);

  const updated = await prisma.interviewSession.update({
    where: { id: interview.id },
    data: { streamCallId: interview.id },
  });

  return NextResponse.json(updated);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const sessions = await prisma.interviewSession.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { mission: { select: { title: true } } },
  });

  return NextResponse.json(sessions);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/interviews/route.ts
git commit -m "feat: create Stream call with recording+transcription when interview starts"
```

---

## Task 5: Stream Webhook Handler

**Files:**
- Create: `frontend/src/app/api/stream/webhook/route.ts`

This is the most critical file. It handles 5 events from Stream. When `call.session_started` fires, it connects the OpenAI Realtime API so the AI joins as a voice participant.

- [ ] **Step 1: Create the webhook route**

Create `frontend/src/app/api/stream/webhook/route.ts`:

```typescript
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
  TECHNICAL: `You are a rigorous technical interviewer at a top-tier tech company (think Google, Meta, Amazon level).
Conduct a structured technical interview. Start with a brief warm-up question, then ask 2-3 focused technical questions covering data structures, algorithms, or system concepts relevant to a software engineering role.
Probe deeper on weak answers. Evaluate problem-solving approach, code quality thinking, and communication.
Keep each response under 60 words. Be professional but not cold. Do not reveal your internal phase or scoring.`,

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
```

- [ ] **Step 2: Register webhook in Stream dashboard (user action)**

In the Stream dashboard → your project → Webhooks → add:
- URL: `https://your-ngrok-url/api/stream/webhook` (use ngrok for local dev)
- Events: `call.session_started`, `call.session_participant_left`, `call.session_ended`, `call.transcription_ready`, `call.recording_ready`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/stream/webhook/route.ts
git commit -m "feat: add Stream webhook handler with OpenAI Realtime API integration"
```

---

## Task 6: Interview Call Components

**Files:**
- Create: `frontend/src/components/interview/call-provider.tsx`
- Create: `frontend/src/components/interview/call-connect.tsx`
- Create: `frontend/src/components/interview/call-lobby.tsx`
- Create: `frontend/src/components/interview/call-active.tsx`
- Create: `frontend/src/components/interview/call-ui.tsx`
- Create: `frontend/src/components/interview/call-ended.tsx`

Reference: `saasai-master/src/modules/call/ui/components/` for all 6 files. CareerForge differences: uses next-auth (not better-auth), REST token endpoint (not tRPC), Prisma models.

- [ ] **Step 1: Create call-provider.tsx**

Create `frontend/src/components/interview/call-provider.tsx`:

```tsx
"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { CallConnect } from "./call-connect";

interface Props {
  interviewId: string;
  interviewType: string;
}

export const CallProvider = ({ interviewId, interviewType }: Props) => {
  const { data: session, status } = useSession();

  if (status === "loading" || !session?.user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <CallConnect
      interviewId={interviewId}
      interviewType={interviewType}
      userId={session.user.id!}
      userName={session.user.name ?? "Student"}
      userImage={session.user.image ?? ""}
    />
  );
};
```

- [ ] **Step 2: Create call-connect.tsx**

Create `frontend/src/components/interview/call-connect.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Call,
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Loader2 } from "lucide-react";
import { CallUI } from "./call-ui";

interface Props {
  interviewId: string;
  interviewType: string;
  userId: string;
  userName: string;
  userImage: string;
}

export const CallConnect = ({
  interviewId,
  interviewType,
  userId,
  userName,
  userImage,
}: Props) => {
  const generateToken = useCallback(async () => {
    const res = await fetch("/api/interviews/token");
    const data = await res.json() as { token: string };
    return data.token;
  }, []);

  const [client, setClient] = useState<StreamVideoClient>();
  useEffect(() => {
    const _client = new StreamVideoClient({
      apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
      user: { id: userId, name: userName, image: userImage },
      tokenProvider: generateToken,
    });
    setClient(_client);
    return () => {
      _client.disconnectUser();
      setClient(undefined);
    };
  }, [generateToken, userId, userName, userImage]);

  const [call, setCall] = useState<Call>();
  useEffect(() => {
    if (!client) return;
    const _call = client.call("default", interviewId);
    _call.camera.disable();
    _call.microphone.disable();
    setCall(_call);
    return () => {
      if (_call.state.callingState !== CallingState.LEFT) {
        _call.leave();
      }
      setCall(undefined);
    };
  }, [client, interviewId]);

  if (!client || !call) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI interviewId={interviewId} interviewType={interviewType} />
      </StreamCall>
    </StreamVideo>
  );
};
```

- [ ] **Step 3: Create call-lobby.tsx**

Create `frontend/src/components/interview/call-lobby.tsx`:

```tsx
"use client";

import { LogIn } from "lucide-react";
import {
  DefaultVideoPlaceholder,
  StreamVideoParticipant,
  ToggleAudioPreviewButton,
  ToggleVideoPreviewButton,
  useCallStateHooks,
  VideoPreview,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useSession } from "next-auth/react";

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical Interview",
  SYSTEM_DESIGN: "System Design Interview",
  BEHAVIORAL: "Behavioral Interview",
  HR: "HR Interview",
  MIXED: "Mixed Interview",
};

interface Props {
  onJoin: () => void;
  interviewType: string;
}

const DisabledPlaceholder = () => {
  const { data: session } = useSession();
  return (
    <DefaultVideoPlaceholder
      participant={
        { name: session?.user?.name ?? "You", image: session?.user?.image ?? "" } as StreamVideoParticipant
      }
    />
  );
};

const PermissionWarning = () => (
  <p className="text-sm text-zinc-400 text-center px-4">
    Please grant your browser permission to access your microphone and camera.
  </p>
);

export const CallLobby = ({ onJoin, interviewType }: Props) => {
  const { useCameraState, useMicrophoneState } = useCallStateHooks();
  const { hasBrowserPermission: hasMicPermission } = useMicrophoneState();
  const { hasBrowserPermission: hasCameraPermission } = useCameraState();
  const hasPermissions = hasCameraPermission && hasMicPermission;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-1">Ready to start?</p>
          <h2 className="text-lg text-white font-light">{TYPE_LABELS[interviewType] ?? "Mock Interview"}</h2>
          <p className="text-sm text-zinc-500 mt-1">Set up your camera and mic before joining</p>
        </div>
        <VideoPreview
          DisabledVideoPreview={hasPermissions ? DisabledPlaceholder : PermissionWarning}
        />
        <div className="flex gap-3">
          <ToggleAudioPreviewButton />
          <ToggleVideoPreviewButton />
        </div>
        <button
          onClick={onJoin}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Join Interview
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Create call-active.tsx (with face-api.js emotion sampling)**

Create `frontend/src/components/interview/call-active.tsx`:

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { CallControls, SpeakerLayout } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Zap } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical Interview",
  SYSTEM_DESIGN: "System Design Interview",
  BEHAVIORAL: "Behavioral Interview",
  HR: "HR Interview",
  MIXED: "Mixed Interview",
};

export type EmotionSample = {
  timestamp: number;
  expressions: {
    neutral: number;
    happy: number;
    sad: number;
    angry: number;
    fearful: number;
    disgusted: number;
    surprised: number;
  };
};

interface Props {
  onLeave: (emotionSamples: EmotionSample[]) => void;
  interviewType: string;
}

export const CallActive = ({ onLeave, interviewType }: Props) => {
  const emotionSamplesRef = useRef<EmotionSample[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceapiRef = useRef<typeof import("face-api.js") | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load face-api.js models and start sampling
  useEffect(() => {
    let cancelled = false;

    const initFaceApi = async () => {
      try {
        const faceapi = await import("face-api.js");
        faceapiRef.current = faceapi;

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(
            "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights"
          ),
          faceapi.nets.faceExpressionNet.loadFromUri(
            "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights"
          ),
        ]);

        if (cancelled) return;

        // Get camera stream for emotion analysis (separate from Stream's stream)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Sample every 2 seconds
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current || !faceapiRef.current) return;
          try {
            const detections = await faceapiRef.current
              .detectSingleFace(videoRef.current, new faceapiRef.current.TinyFaceDetectorOptions())
              .withFaceExpressions();

            if (detections) {
              emotionSamplesRef.current.push({
                timestamp: Date.now(),
                expressions: detections.expressions as EmotionSample["expressions"],
              });
            }
          } catch {
            // Silent — face not detected this frame
          }
        }, 2000);
      } catch (err) {
        console.warn("[face-api] Could not initialize emotion detection:", err);
      }
    };

    initFaceApi();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleLeave = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onLeave(emotionSamplesRef.current);
  }, [onLeave]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm text-white font-medium">
            {TYPE_LABELS[interviewType] ?? "Mock Interview"}
          </p>
          <p className="text-xs text-zinc-500 font-mono">Live · Recording</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-zinc-500 font-mono">REC</span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 overflow-hidden">
        <SpeakerLayout />
      </div>

      {/* Controls */}
      <div className="border-t border-zinc-800/60 px-4 py-3 flex justify-center">
        <CallControls onLeave={handleLeave} />
      </div>

      {/* Hidden video + canvas for face-api.js */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
```

- [ ] **Step 5: Create call-ui.tsx**

Create `frontend/src/components/interview/call-ui.tsx`:

```tsx
"use client";

import { StreamTheme, useCall } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CallLobby } from "./call-lobby";
import { CallActive, EmotionSample } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  interviewId: string;
  interviewType: string;
}

export const CallUI = ({ interviewId, interviewType }: Props) => {
  const call = useCall();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");

  const handleJoin = async () => {
    if (!call) return;
    await call.join();
    setShow("call");
  };

  const handleLeave = useCallback(
    async (emotionSamples: EmotionSample[]) => {
      if (!call) return;

      // Aggregate emotion data before ending
      const emotionData =
        emotionSamples.length > 0
          ? {
              sampleCount: emotionSamples.length,
              samples: emotionSamples,
              averages: Object.fromEntries(
                (
                  ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"] as const
                ).map((emotion) => [
                  emotion,
                  parseFloat(
                    (
                      emotionSamples.reduce((sum, s) => sum + (s.expressions[emotion] ?? 0), 0) /
                      emotionSamples.length
                    ).toFixed(3)
                  ),
                ])
              ),
            }
          : null;

      try {
        await fetch(`/api/interviews/${interviewId}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emotionData }),
        });
      } catch {
        console.error("Failed to save emotion data");
      }

      call.endCall();
      setShow("ended");
      toast.success("Interview complete! Your scorecard is being generated...");
    },
    [call, interviewId]
  );

  return (
    <StreamTheme className="h-full">
      {show === "lobby" && <CallLobby onJoin={handleJoin} interviewType={interviewType} />}
      {show === "call" && <CallActive onLeave={handleLeave} interviewType={interviewType} />}
      {show === "ended" && <CallEnded interviewId={interviewId} />}
    </StreamTheme>
  );
};
```

- [ ] **Step 6: Create call-ended.tsx**

Create `frontend/src/components/interview/call-ended.tsx`:

```tsx
"use client";

import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";

interface Props {
  interviewId: string;
}

export const CallEnded = ({ interviewId }: Props) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg text-white font-light">Interview Complete</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Your scorecard is being generated. This usually takes 1-2 minutes.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
          <Clock className="w-3.5 h-3.5" />
          Processing transcript + emotion data…
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Link
            href={`/interview/${interviewId}/debrief`}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors text-center"
          >
            View Scorecard
          </Link>
          <Link
            href="/interview"
            className="w-full py-2.5 border border-zinc-800 text-zinc-400 hover:text-white text-sm rounded-xl transition-colors text-center"
          >
            Back to Interviews
          </Link>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 7: Commit all components**

```bash
git add frontend/src/components/interview/
git commit -m "feat: add interview call components (provider, connect, lobby, active, ui, ended)"
```

---

## Task 7: Interview Call Page

**Files:**
- Create: `frontend/src/app/interview/[id]/call/page.tsx`

- [ ] **Step 1: Create the call page**

Create `frontend/src/app/interview/[id]/call/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { CallProvider } from "@/components/interview/call-provider";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InterviewCallPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) redirect("/dashboard");

  const interview = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
    select: { id: true, interviewType: true, status: true },
  });

  if (!interview) notFound();

  if (interview.status === "COMPLETED" || interview.status === "PROCESSING") {
    redirect(`/interview/${id}/debrief`);
  }

  return (
    <div className="h-screen overflow-hidden">
      <CallProvider
        interviewId={interview.id}
        interviewType={interview.interviewType}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/interview/\[id\]/call/page.tsx
git commit -m "feat: add interview call page routing to Stream video room"
```

---

## Task 8: Update /api/interviews/[id]/end to Save Emotion Data

**Files:**
- Modify: `frontend/src/app/api/interviews/[id]/end/route.ts`

- [ ] **Step 1: Update the end route**

Replace `frontend/src/app/api/interviews/[id]/end/route.ts` entirely with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { emotionData, communicationData } = body;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const updated = await prisma.interviewSession.updateMany({
    where: { id, studentProfileId: profile.id },
    data: {
      emotionData: emotionData ?? undefined,
      communicationData: communicationData ?? undefined,
    },
  });

  return NextResponse.json({ saved: updated.count > 0 });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/interviews/\[id\]/end/route.ts
git commit -m "feat: save emotion and communication data on interview end"
```

---

## Task 9: Update Interview List Page — Add Scheduling + Upcoming Section

**Files:**
- Modify: `frontend/src/app/interview/page.tsx`

- [ ] **Step 1: Replace the interview page**

Replace `frontend/src/app/interview/page.tsx` entirely with:

```tsx
"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import { Mic, Play, Clock, CheckCircle2, Loader2, Video, Calendar, Hourglass } from "lucide-react";
import { useState } from "react";

type InterviewSession = {
  id: string;
  interviewType: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
  completedAt: string | null;
  scheduledAt: string | null;
  mission: { title: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  SYSTEM_DESIGN: "System Design",
  BEHAVIORAL: "Behavioral",
  MIXED: "Mixed",
  HR: "HR",
};

const INTERVIEW_TYPES = ["TECHNICAL", "SYSTEM_DESIGN", "BEHAVIORAL", "HR", "MIXED"] as const;

export default function InterviewPage() {
  const router = useRouter();
  const [scheduleType, setScheduleType] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  const { data: sessions, isLoading } = useQuery<InterviewSession[]>({
    queryKey: ["interviews"],
    queryFn: () => axios.get<InterviewSession[]>("/api/interviews").then((r) => r.data),
  });

  const startMutation = useMutation({
    mutationFn: ({ type, scheduledAt }: { type: string; scheduledAt?: string }) =>
      axios.post<InterviewSession>("/api/interviews", { type, scheduledAt }).then((r) => r.data),
    onSuccess: (session) => {
      if (session.status === "UPCOMING") {
        toast.success("Interview scheduled!");
        setScheduleType(null);
        setScheduledAt("");
      } else {
        router.push(`/interview/${session.id}/call`);
      }
    },
    onError: () => toast.error("Failed to create interview"),
  });

  const upcoming = sessions?.filter((s) => s.status === "UPCOMING") ?? [];
  const inProgress = sessions?.filter((s) => s.status === "IN_PROGRESS") ?? [];
  const processing = sessions?.filter((s) => s.status === "PROCESSING") ?? [];
  const completed = sessions?.filter((s) => s.status === "COMPLETED") ?? [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Practice</p>
          <h1 className="text-2xl text-white font-light">Mock Interviews</h1>
        </div>

        {/* Start / Schedule */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-medium text-white mb-1">Start a session</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Real-time AI interviewer with voice + video. Get a full scorecard with emotion analysis.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {INTERVIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => startMutation.mutate({ type })}
                disabled={startMutation.isPending}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/60 hover:border-amber-500/30 rounded-xl transition-colors disabled:opacity-50"
              >
                {startMutation.isPending && startMutation.variables?.type === type && !scheduleType ? (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                ) : (
                  <Video className="w-5 h-5 text-zinc-400" />
                )}
                <span className="text-xs text-zinc-400 font-mono">{TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>

          {/* Schedule section */}
          <div className="mt-4 pt-4 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500 mb-3 font-mono">— or schedule for later —</p>
            {scheduleType ? (
              <div className="flex items-center gap-3">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={() => {
                    if (!scheduledAt) return toast.error("Pick a date/time");
                    startMutation.mutate({ type: scheduleType, scheduledAt });
                  }}
                  disabled={startMutation.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule"}
                </button>
                <button
                  onClick={() => setScheduleType(null)}
                  className="text-xs text-zinc-500 hover:text-white px-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {INTERVIEW_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setScheduleType(type)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-xs rounded-lg transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-3">
              Scheduled ({upcoming.length})
            </p>
            <div className="space-y-2">
              {upcoming.map((s) => {
                const isReady = s.scheduledAt ? new Date(s.scheduledAt) <= new Date() : true;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                        {s.scheduledAt && (
                          <p className="text-xs text-zinc-500 font-mono">
                            {new Date(s.scheduledAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {isReady ? (
                      <button
                        onClick={() => router.push(`/interview/${s.id}/call`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Now
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500 font-mono">
                        {s.scheduledAt
                          ? `in ${Math.ceil((new Date(s.scheduledAt).getTime() - Date.now()) / 60000)}m`
                          : "Upcoming"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* In-progress */}
        {inProgress.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-3">
              Resume ({inProgress.length})
            </p>
            <div className="space-y-2">
              {inProgress.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/interview/${s.id}/call`)}
                  className="w-full flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Play className="w-4 h-4 text-amber-400" />
                    <div className="text-left">
                      <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                      {s.mission && <p className="text-xs text-zinc-500">{s.mission.title}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Processing */}
        {processing.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
              Processing ({processing.length})
            </p>
            <div className="space-y-2">
              {processing.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Hourglass className="w-4 h-4 text-zinc-500 animate-pulse" />
                    <div>
                      <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                      <p className="text-xs text-zinc-500">Generating scorecard…</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/interview/${s.id}/debrief`)}
                    className="text-xs text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1 rounded-lg transition-colors"
                  >
                    Check →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">History</p>

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          )}

          {!isLoading && completed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Mic className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">No completed sessions yet</p>
            </div>
          )}

          <div className="space-y-2">
            {completed.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm text-white">{TYPE_LABELS[s.interviewType]}</p>
                    {s.mission && <p className="text-xs text-zinc-500">{s.mission.title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {s.overallScore !== null && (
                    <span
                      className={`text-sm font-mono font-medium ${
                        s.overallScore >= 70
                          ? "text-green-400"
                          : s.overallScore >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {s.overallScore.toFixed(0)}/100
                    </span>
                  )}
                  <button
                    onClick={() => router.push(`/interview/${s.id}/debrief`)}
                    className="text-xs text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1 rounded-lg transition-colors"
                  >
                    Scorecard →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/interview/page.tsx
git commit -m "feat: update interview page with scheduling, upcoming section, and video call routing"
```

---

## Task 10: AI Service — Generate Debrief from Stream Transcript

**Files:**
- Modify: `ai-service/app/models/schemas.py`
- Modify: `ai-service/app/agents/interview_agent.py`
- Modify: `ai-service/app/api/interview.py`

- [ ] **Step 1: Update schemas.py**

Open `ai-service/app/models/schemas.py`. Add the new request model at the end:

```python
class InterviewGenerateDebriefRequest(BaseModel):
    session_id: str
    student_profile_id: str
    transcript_url: str
    emotion_data: Optional[dict] = None
    communication_data: Optional[dict] = None
```

- [ ] **Step 2: Add generate_debrief_from_transcript to interview_agent.py**

Open `ai-service/app/agents/interview_agent.py`. Add these two functions after the existing `_generate_debrief` function:

```python
import httpx

async def _parse_stream_transcript(transcript_url: str) -> list[dict]:
    """Download and parse Stream JSONL transcript into list of {role, content} dicts."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(transcript_url, timeout=30)
        resp.raise_for_status()

    lines = resp.text.strip().splitlines()
    items = []
    for line in lines:
        if not line.strip():
            continue
        try:
            item = json.loads(line)
            # Stream transcript items: {"type": "speech", "speaker_id": "...", "text": "..."}
            if item.get("type") == "speech" and item.get("text"):
                # ai-interviewer is the agent user ID
                role = "ai" if item.get("speaker_id") == "ai-interviewer" else "student"
                items.append({"role": role, "content": item["text"]})
        except (json.JSONDecodeError, KeyError):
            continue
    return items


async def generate_debrief_from_transcript(
    session_id: str,
    student_profile_id: str,
    transcript_url: str,
    emotion_data: dict | None,
    communication_data: dict | None,
) -> dict:
    """Generate debrief from a Stream transcript URL + optional emotion/communication data."""
    pool = await get_pool()

    transcript = await _parse_stream_transcript(transcript_url)

    if not transcript:
        logger.warning(f"[interview] Empty transcript for session {session_id}")
        return {}

    transcript_text = "\n".join(
        f"{t['role'].upper()}: {t['content']}" for t in transcript[-30:]
    )

    emotion_section = ""
    if emotion_data and emotion_data.get("averages"):
        avgs = emotion_data["averages"]
        dominant = max(avgs, key=lambda k: avgs[k])
        confidence = round((avgs.get("happy", 0) + avgs.get("neutral", 0)) * 10, 1)
        nervousness = round((avgs.get("fearful", 0) + avgs.get("sad", 0)) * 10, 1)
        emotion_section = f"""
Emotion data (from facial analysis):
- Dominant emotion: {dominant}
- Confidence proxy score: {confidence}/10
- Nervousness proxy score: {nervousness}/10
- Averages: {json.dumps(avgs)}
"""

    comm_section = ""
    if communication_data:
        comm_section = f"\nCommunication metrics: {json.dumps(communication_data)}"

    debrief = await llm_json(
        prompt=f"""Generate a comprehensive interview debrief.

Transcript (last 30 turns):
{transcript_text}
{emotion_section}
{comm_section}

Return JSON with EXACTLY these fields:
{{
  "strong_zones": ["2-4 specific areas the candidate did well"],
  "weak_zones": ["2-4 specific areas needing improvement"],
  "key_phrase_to_practice": "one specific phrase or answer structure to practice",
  "one_insight": "the single most important actionable takeaway",
  "scores": {{
    "accuracy": <0-10 float>,
    "depth": <0-10 float>,
    "clarity": <0-10 float>,
    "overall": <0-10 float>
  }},
  "emotion_summary": {{
    "dominant_emotion": "<emotion name>",
    "confidence_score": <0-10 float>,
    "nervousness_score": <0-10 float>,
    "insight": "<one sentence about emotional presence during the interview>"
  }},
  "communication": {{
    "filler_word_count": <int>,
    "filler_words_detected": ["list of filler words used"],
    "estimated_wpm": <int or null>,
    "eye_contact_score": <0-10 float or null>,
    "tip": "<one concrete communication improvement tip>"
  }}
}}""",
        model="gpt-4o-mini",
        temperature=0.4,
        fallback={
            "strong_zones": [],
            "weak_zones": [],
            "key_phrase_to_practice": "",
            "one_insight": "",
            "scores": {"accuracy": 5, "depth": 5, "clarity": 5, "overall": 5},
            "emotion_summary": {"dominant_emotion": "neutral", "confidence_score": 5, "nervousness_score": 5, "insight": ""},
            "communication": {"filler_word_count": 0, "filler_words_detected": [], "estimated_wpm": None, "eye_contact_score": None, "tip": ""},
        },
        label="interview/generate-debrief",
    )

    # Inject emotion + communication data from face-api.js
    if emotion_data and emotion_data.get("averages"):
        avgs = emotion_data["averages"]
        dominant = max(avgs, key=lambda k: avgs[k])
        debrief["emotion_summary"]["dominant_emotion"] = dominant
        debrief["emotion_summary"]["confidence_score"] = round(
            (avgs.get("happy", 0) + avgs.get("neutral", 0)) * 10, 1
        )
        debrief["emotion_summary"]["nervousness_score"] = round(
            (avgs.get("fearful", 0) + avgs.get("sad", 0)) * 10, 1
        )

    overall_score = debrief.get("scores", {}).get("overall", 5) * 10  # 0-100

    await pool.execute(
        """
        UPDATE "InterviewSession"
        SET status = 'COMPLETED', "completedAt" = NOW(),
            debrief = $2, "overallScore" = $3,
            transcript = $4
        WHERE id = $1
        """,
        session_id,
        json.dumps(debrief),
        overall_score,
        json.dumps(transcript),
    )

    logger.info(f"[interview] Debrief generated for {session_id[:8]}… score={overall_score}")
    return debrief
```

- [ ] **Step 3: Add the new endpoint to interview.py**

Open `ai-service/app/api/interview.py`. Add at the end:

```python
from app.models.schemas import InterviewGenerateDebriefRequest
from app.agents.interview_agent import generate_debrief_from_transcript

@router.post("/generate-debrief")
async def interview_generate_debrief(req: InterviewGenerateDebriefRequest):
    result = await generate_debrief_from_transcript(
        session_id=req.session_id,
        student_profile_id=req.student_profile_id,
        transcript_url=req.transcript_url,
        emotion_data=req.emotion_data,
        communication_data=req.communication_data,
    )
    return {"status": "ok", "debrief": result}
```

- [ ] **Step 4: Install httpx (if not already present)**

Check `ai-service/requirements.txt` — `httpx==0.28.1` is already listed. No action needed.

- [ ] **Step 5: Commit**

```bash
git add ai-service/app/models/schemas.py ai-service/app/agents/interview_agent.py ai-service/app/api/interview.py
git commit -m "feat(ai): add generate-debrief endpoint that processes Stream transcript + emotion data"
```

---

## Task 11: Enhanced Debrief Page

**Files:**
- Modify: `frontend/src/app/interview/[id]/debrief/page.tsx`

- [ ] **Step 1: Replace the debrief page**

Replace `frontend/src/app/interview/[id]/debrief/page.tsx` entirely with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Lightbulb,
  Smile,
  AlertCircle,
  Hourglass,
  Mic,
} from "lucide-react";

type Debrief = {
  strong_zones: string[];
  weak_zones: string[];
  key_phrase_to_practice: string;
  one_insight: string;
  scores: { accuracy: number; depth: number; clarity: number; overall: number };
  emotion_summary?: {
    dominant_emotion: string;
    confidence_score: number;
    nervousness_score: number;
    insight: string;
  };
  communication?: {
    filler_word_count: number;
    filler_words_detected: string[];
    estimated_wpm: number | null;
    eye_contact_score: number | null;
    tip: string;
  };
};

const EMOTION_EMOJI: Record<string, string> = {
  neutral: "😐",
  happy: "😊",
  sad: "😔",
  angry: "😠",
  fearful: "😨",
  disgusted: "😒",
  surprised: "😲",
};

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) redirect("/dashboard");

  const interview = await prisma.interviewSession.findFirst({
    where: { id, studentProfileId: profile.id },
    include: { mission: { select: { title: true } } },
  });

  if (!interview) notFound();

  // Show processing state
  if (interview.status === "PROCESSING" || (!interview.debrief && interview.status !== "COMPLETED")) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Hourglass className="w-10 h-10 text-amber-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-xl text-white font-light mb-2">Generating Your Scorecard</h1>
          <p className="text-sm text-zinc-500">
            We're analyzing your interview transcript and emotion data. This usually takes 1-2 minutes.
          </p>
          <Link
            href="/interview"
            className="inline-block mt-6 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            ← Back to Interviews
          </Link>
        </div>
      </div>
    );
  }

  if (!interview.debrief) notFound();

  const debrief = interview.debrief as unknown as Debrief;
  const score = interview.overallScore ?? debrief.scores?.overall * 10 ?? 0;

  const scoreColor =
    score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6 md:p-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/interview"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4 font-mono"
        >
          <ChevronLeft className="w-3 h-3" />
          Interviews
        </Link>
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">Interview Scorecard</p>
        <h1 className="text-2xl text-white font-light mt-1">
          {interview.mission?.title ?? "General Interview"}
        </h1>
      </div>

      {/* Overall score */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 mb-6 text-center">
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Overall Score</p>
        <div className={`text-6xl font-light ${scoreColor}`}>{score.toFixed(0)}</div>
        <div className="text-zinc-600 text-sm mt-1">/ 100</div>

        {debrief.scores && (
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-800/60">
            {[
              { label: "Accuracy", val: debrief.scores.accuracy },
              { label: "Depth", val: debrief.scores.depth },
              { label: "Clarity", val: debrief.scores.clarity },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="text-2xl font-light text-white">{val?.toFixed(1) ?? "—"}</div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">{label}</div>
                <div className="h-1 bg-zinc-800 rounded-full mt-2">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emotion Analysis */}
      {debrief.emotion_summary && (
        <div className="bg-zinc-900/60 border border-purple-500/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Smile className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-medium text-purple-400">Emotion Analysis</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl mb-1">
                {EMOTION_EMOJI[debrief.emotion_summary.dominant_emotion] ?? "😐"}
              </div>
              <div className="text-xs text-zinc-500 capitalize">
                {debrief.emotion_summary.dominant_emotion}
              </div>
              <div className="text-xs text-zinc-600 font-mono">dominant</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-green-400">
                {debrief.emotion_summary.confidence_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Confidence</div>
              <div className="h-1 bg-zinc-800 rounded-full mt-1">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${(debrief.emotion_summary.confidence_score / 10) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-amber-400">
                {debrief.emotion_summary.nervousness_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">Nervousness</div>
              <div className="h-1 bg-zinc-800 rounded-full mt-1">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(debrief.emotion_summary.nervousness_score / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
          {debrief.emotion_summary.insight && (
            <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3">
              {debrief.emotion_summary.insight}
            </p>
          )}
        </div>
      )}

      {/* Communication Metrics */}
      {debrief.communication && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-blue-400">Communication Metrics</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-zinc-800/40 rounded-xl p-3">
              <div className="text-lg font-light text-white">
                {debrief.communication.filler_word_count}
              </div>
              <div className="text-xs text-zinc-500 font-mono">Filler words</div>
              {debrief.communication.filler_words_detected.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {debrief.communication.filler_words_detected.slice(0, 5).map((w) => (
                    <span key={w} className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3">
              <div className="text-lg font-light text-white">
                {debrief.communication.estimated_wpm ?? "—"}
              </div>
              <div className="text-xs text-zinc-500 font-mono">Words / min</div>
              {debrief.communication.eye_contact_score !== null && (
                <div className="mt-2">
                  <div className="text-xs text-zinc-500 mb-1">Eye contact</div>
                  <div className="h-1 bg-zinc-800 rounded-full">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${((debrief.communication.eye_contact_score ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          {debrief.communication.tip && (
            <div className="flex items-start gap-2 text-xs text-zinc-400 border-t border-zinc-800/60 pt-3">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              {debrief.communication.tip}
            </div>
          )}
        </div>
      )}

      {/* Strong zones */}
      {debrief.strong_zones?.length > 0 && (
        <div className="bg-zinc-900/60 border border-green-500/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-sm font-medium text-green-400">Strong Zones</p>
          </div>
          <ul className="space-y-1.5">
            {debrief.strong_zones.map((z, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-green-500 mt-0.5">✓</span>
                {z}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weak zones */}
      {debrief.weak_zones?.length > 0 && (
        <div className="bg-zinc-900/60 border border-red-500/20 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-sm font-medium text-red-400">Areas to Improve</p>
          </div>
          <ul className="space-y-1.5">
            {debrief.weak_zones.map((z, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-red-400 mt-0.5">△</span>
                {z}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key phrase */}
      {debrief.key_phrase_to_practice && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">Practice This Phrase</p>
          </div>
          <p className="text-sm text-zinc-300 italic leading-relaxed">
            &ldquo;{debrief.key_phrase_to_practice}&rdquo;
          </p>
        </div>
      )}

      {/* One insight */}
      {debrief.one_insight && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">Key Insight</p>
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed">{debrief.one_insight}</p>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          href="/interview"
          className="flex-1 text-center py-2.5 border border-zinc-800 text-zinc-400 hover:text-white text-sm rounded-xl transition-colors"
        >
          More Interviews
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 text-center py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/interview/\[id\]/debrief/page.tsx
git commit -m "feat: enhance debrief page with emotion analysis and communication metrics panels"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Voice + video call room — Tasks 6 + 7
- ✅ AI speaks via OpenAI Realtime API — Task 5 (connectOpenAi in webhook)
- ✅ Stream Video SDK — Tasks 2, 3, 4, 5, 6
- ✅ Schedule ahead + instant start — Task 9
- ✅ Emotion analysis (face-api.js) — Task 6, step 4
- ✅ Post-call transcript debrief — Tasks 5 + 10
- ✅ Communication metrics — Task 10, Task 11
- ✅ Enhanced scorecard — Task 11
- ✅ DB schema additions — Task 1
- ✅ UPCOMING + PROCESSING statuses — Task 1

**Placeholder scan:** None found. All steps contain actual code.

**Type consistency:**
- `EmotionSample` defined in `call-active.tsx`, imported in `call-ui.tsx` ✅
- `interviewId` prop flows: `CallProvider → CallConnect → CallUI → CallActive/CallEnded` ✅
- `/api/interviews/[id]/end` expects `{ emotionData }` — `call-ui.tsx` sends `{ emotionData }` ✅
- Webhook reads `event.call.custom.interviewId` — set in Task 4 as `interviewId: interview.id` ✅
- `generate_debrief_from_transcript` signature matches `InterviewGenerateDebriefRequest` ✅
