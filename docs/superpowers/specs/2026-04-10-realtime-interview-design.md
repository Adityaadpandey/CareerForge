# Real-Time AI Interview System — Design Spec
**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

Upgrade CareerForge's text-based mock interview into a real-time voice+video interview room. The AI interviewer joins the call as a live voice participant via Stream Video SDK's built-in OpenAI Realtime API bridge. After the interview ends, Stream delivers a transcript and recording; the recording is analyzed for facial emotion data using face-api.js (client-side, free). A comprehensive scorecard is generated combining transcript analysis, per-question scores, emotion timeline, and communication metrics.

---

## User Flow

```
1. Interview page → click interview type OR schedule for later
2. POST /api/interviews → creates InterviewSession + Stream call (recording + transcription auto-on)
3. Redirect to /interview/[id]/call
4. Lobby: camera/mic preview → join
5. Stream webhook: call.session_started → server calls connectOpenAi with interview instructions
6. AI joins as voice participant — real-time conversation
7. face-api.js samples camera feed every 2s → builds emotion timeline locally
8. User clicks Leave → POST /api/interviews/[id]/end with emotion data → call.end()
9. Stream webhooks arrive: call.transcription_ready + call.recording_ready
10. Server triggers debrief generation from transcript
11. User views /interview/[id]/debrief — enhanced scorecard
```

---

## Architecture

### Frontend (Next.js)

**New pages:**
- `/interview/[id]/call/page.tsx` — video call room

**New components** (adapted from saasai-master):
- `InterviewCallProvider` — auth wrapper, passes userId/userName/userImage
- `InterviewCallConnect` — initializes StreamVideoClient, creates Call object, fetches token from `/api/interviews/token`
- `InterviewCallUI` — state machine: `lobby | call | ended`
- `InterviewCallLobby` — camera/mic preview, join button (from saasai call-lobby.tsx)
- `InterviewCallActive` — SpeakerLayout + CallControls + face-api.js emotion sampling
- `InterviewCallEnded` — redirects to `/interview/[id]/debrief`

**Existing pages updated:**
- `/interview/page.tsx` — add scheduling UI (date/time picker for "schedule later"), keep instant start
- `/interview/[id]/debrief/page.tsx` — add emotion timeline chart + communication metrics panel

### Backend (Next.js API routes)

**New routes:**
- `GET /api/interviews/token` — generates Stream user token (server-side, uses StreamClient)
- `POST /api/stream/webhook` — handles Stream events:
  - `call.session_started` → `connectOpenAi` with interview-type instructions + upsert AI user
  - `call.session_participant_left` → `call.end()`
  - `call.session_ended` → mark InterviewSession status = `PROCESSING`
  - `call.transcription_ready` → save transcriptUrl, trigger Python AI debrief generation
  - `call.recording_ready` → save recordingUrl

**Modified routes:**
- `POST /api/interviews` — also creates Stream call with recording + transcription auto-on, saves `streamCallId`
- `POST /api/interviews/[id]/end` — accepts `{ emotionData, communicationMetrics }`, saves to DB, calls `call.end()`

### AI Service (Python/FastAPI)

**Modified:**
- `interview_agent.py` — `generate_debrief()` accepts emotion data + communication metrics, incorporates into debrief JSON output

**New debrief fields:**
```json
{
  "strong_zones": [],
  "weak_zones": [],
  "key_phrase_to_practice": "",
  "one_insight": "",
  "scores": { "accuracy": 0, "depth": 0, "clarity": 0, "overall": 0 },
  "emotion_summary": {
    "dominant_emotion": "neutral",
    "confidence_score": 7.2,
    "nervousness_score": 4.1,
    "timeline": [{ "phase": "TECHNICAL", "emotions": { "neutral": 0.6, "fearful": 0.2, "happy": 0.2 } }]
  },
  "communication": {
    "filler_word_count": 12,
    "filler_words_detected": ["um", "uh", "like"],
    "estimated_wpm": 140,
    "eye_contact_score": 6.5
  }
}
```

---

## Database (Prisma)

**Additions to `InterviewSession` model:**
```prisma
streamCallId      String?
scheduledAt       DateTime?
recordingUrl      String?
transcriptUrl     String?
emotionData       Json?
communicationData Json?
```

**Also add two new status values to `InterviewSession.status` enum (currently has `IN_PROGRESS`, `COMPLETED`):**
- `UPCOMING` — scheduled but not yet started
- `PROCESSING` — call ended, awaiting transcript/recording from Stream

**No new tables needed.**

---

## Emotion Analysis (face-api.js)

- Loaded client-side in `InterviewCallActive` using CDN or npm package
- Models: `tinyFaceDetector` + `faceExpressionNet` (small, fast)
- Samples video element every 2000ms during active call
- Stores array: `{ timestamp: number, expressions: FaceExpressions }[]`
- On leave: aggregates by interview phase → sends with end request
- **100% free — runs in browser, no API calls**

---

## Communication Metrics

Extracted from the Stream transcript (JSONL) after call ends:
- **Filler words**: count occurrences of "um", "uh", "like", "you know", "basically", "literally" in student turns
- **Speaking pace (WPM)**: total student words / total student speaking time
- **Eye contact score**: derived from face-api.js — frames where face detected looking forward vs. looking away

---

## Interview Type → AI Instructions Mapping

Each type produces a different system prompt passed to `connectOpenAi`:

| Type | Focus |
|------|-------|
| TECHNICAL | DSA, algorithms, code walkthroughs, debugging |
| BEHAVIORAL | STAR format, leadership, conflict resolution, teamwork |
| HR | Culture fit, salary expectations, career goals, strengths/weaknesses |
| SYSTEM_DESIGN | Architecture, scalability, tradeoffs, capacity estimation |
| MIXED | Blend: 2 technical + 1 behavioral + 1 situational |

---

## Scheduling

- Interview page gains a "Schedule" button → opens a date/time picker (react-day-picker, already installed)
- Creates `InterviewSession` with `scheduledAt` set, `status = UPCOMING`
- Scheduled interviews shown in a separate "Upcoming" section on the interview page
- Joining a scheduled interview before its time shows a countdown; after the time, shows "Join Now"
- No cron needed — join button simply navigates to `/interview/[id]/call`

---

## Environment Variables Required

```env
NEXT_PUBLIC_STREAM_VIDEO_API_KEY=...
STREAM_VIDEO_SECRET_KEY=...
OPENAI_API_KEY=...          # already exists
```
Note: webhook signature verification uses `streamVideo.verifyWebhook(body, signature)` — no separate webhook secret needed, the SDK uses `STREAM_VIDEO_SECRET_KEY`.

---

## What Stays Unchanged

- Python AI interview agent (`interview_agent.py`) core logic — only `generate_debrief` extended
- Existing `/api/interviews/[id]/message` route (text fallback, unused in video mode)
- Existing debrief page structure — only new sections added
- All other CareerForge features

---

## Files to Create / Modify

### Create
- `frontend/src/app/interview/[id]/call/page.tsx`
- `frontend/src/components/interview/call-provider.tsx`
- `frontend/src/components/interview/call-connect.tsx`
- `frontend/src/components/interview/call-lobby.tsx`
- `frontend/src/components/interview/call-active.tsx`
- `frontend/src/components/interview/call-ui.tsx`
- `frontend/src/components/interview/call-ended.tsx`
- `frontend/src/app/api/interviews/token/route.ts`
- `frontend/src/app/api/stream/webhook/route.ts`
- `frontend/src/lib/stream-video.ts`

### Modify
- `frontend/prisma/schema.prisma` — add 6 fields to InterviewSession
- `frontend/src/app/api/interviews/route.ts` — create Stream call on POST
- `frontend/src/app/api/interviews/[id]/end/route.ts` — accept emotion + comm data
- `frontend/src/app/interview/page.tsx` — add scheduling UI + upcoming section
- `frontend/src/app/interview/[id]/debrief/page.tsx` — add emotion + comm panels
- `ai-service/app/agents/interview_agent.py` — extend generate_debrief
- `ai-service/app/api/interview.py` — accept emotion + comm data in end endpoint
- `ai-service/app/models/schemas.py` — add fields to InterviewEndRequest
