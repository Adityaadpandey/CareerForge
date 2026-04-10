# Job Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/jobs/[id]` detail page that live-fetches the job description, runs AI skill-gap analysis, lets students generate CV and cover letter separately, and launches a company-persona mock interview.

**Architecture:** Single scrollable Next.js client-component page at `/jobs/[id]`. All three data fetches (job, description, skill analysis) fire in parallel on mount. CV, cover letter, and interview are triggered on demand. Six new API routes handle the data; the existing interviews and jobs routes are minimally extended.

**Tech Stack:** Next.js 16 (App Router), React Query (`@tanstack/react-query`), Prisma, Axios, Sonner toasts, Lucide icons, Tailwind CSS, Stream Video SDK

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/app/api/jobs/[id]/route.ts` | GET single job + student application state |
| Create | `frontend/src/app/api/jobs/[id]/description/route.ts` | POST: live-fetch job URL, AI-parse description |
| Create | `frontend/src/app/api/jobs/[id]/skill-analysis/route.ts` | POST: AI skill gap analysis |
| Create | `frontend/src/app/api/jobs/[id]/generate-cv/route.ts` | POST: generate CV only |
| Create | `frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts` | POST: generate cover letter only |
| Create | `frontend/src/app/jobs/[id]/page.tsx` | Full job detail UI |
| Modify | `frontend/src/app/jobs/page.tsx` | Make job cards navigate to `/jobs/[id]` |
| Modify | `frontend/src/app/api/interviews/route.ts` | Accept `jobId`, `company`, `role` for persona context |

> **Note:** The existing `POST /api/jobs/[id]/apply` route (generates both CV+cover letter together) is **not touched**. The new generate-cv and generate-cover-letter routes are separate endpoints calling new AI service endpoints `/jobs/generate-cv` and `/jobs/generate-cover-letter`. The AI service must implement these endpoints.

---

## Task 1: GET /api/jobs/[id] — single job with application state

**Files:**
- Create: `frontend/src/app/api/jobs/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// frontend/src/app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const application = await prisma.application.findUnique({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    select: { matchScore: true, status: true, cvGenerated: true, coverLetter: true },
  });

  const savedJob = await prisma.savedJob.findUnique({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    select: { id: true },
  });

  return NextResponse.json({
    ...job,
    matchScore: application?.matchScore ?? null,
    applicationStatus: application?.status ?? null,
    cvGenerated: application?.cvGenerated ?? null,
    coverLetter: application?.coverLetter ?? null,
    isSaved: !!savedJob,
  });
}
```

- [ ] **Step 2: Verify manually**

Start the dev server (`cd frontend && npm run dev`) and hit the endpoint with your browser or curl. Replace `JOB_ID` with a real job id from your DB:

```bash
curl -s http://localhost:3000/api/jobs/JOB_ID \
  -H "Cookie: <your session cookie>" | jq .
```

Expected: JSON with `id`, `title`, `company`, `requirementsTags`, `cvGenerated`, `isSaved`, etc.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/jobs/[id]/route.ts
git commit -m "feat: add GET /api/jobs/[id] route"
```

---

## Task 2: POST /api/jobs/[id]/description — live-fetch + AI parse

**Files:**
- Create: `frontend/src/app/api/jobs/[id]/description/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// frontend/src/app/api/jobs/[id]/description/route.ts
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
    select: { applyUrl: true, requirementsText: true },
  });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const pageRes = await fetch(job.applyUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await pageRes.text();

    const aiRes = await aiClient.post("/jobs/describe", { html, job_id: jobId });
    return NextResponse.json({ description: aiRes.data.description, fallback: false });
  } catch {
    // Fallback to stored text if fetch or AI fails
    return NextResponse.json({ description: job.requirementsText, fallback: true });
  }
}
```

- [ ] **Step 2: Verify manually**

```bash
curl -s -X POST http://localhost:3000/api/jobs/JOB_ID/description \
  -H "Cookie: <your session cookie>" | jq .
```

Expected: `{ "description": "...", "fallback": false }` (or `fallback: true` if the AI service isn't running yet — that's fine, shows the stored text).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/jobs/[id]/description/route.ts
git commit -m "feat: add POST /api/jobs/[id]/description route with fallback"
```

---

## Task 3: POST /api/jobs/[id]/skill-analysis — AI skill gap

**Files:**
- Create: `frontend/src/app/api/jobs/[id]/skill-analysis/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// frontend/src/app/api/jobs/[id]/skill-analysis/route.ts
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

  // AI service must return { matched: string[], gaps: string[], suggestions: string[] }
  return NextResponse.json(aiRes.data);
}
```

- [ ] **Step 2: Verify manually**

```bash
curl -s -X POST http://localhost:3000/api/jobs/JOB_ID/skill-analysis \
  -H "Cookie: <your session cookie>" | jq .
```

Expected: `{ "matched": [...], "gaps": [...], "suggestions": [...] }` (or an AI service error if not implemented yet — acceptable for now).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/jobs/[id]/skill-analysis/route.ts
git commit -m "feat: add POST /api/jobs/[id]/skill-analysis route"
```

---

## Task 4: POST /api/jobs/[id]/generate-cv — CV only

**Files:**
- Create: `frontend/src/app/api/jobs/[id]/generate-cv/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// frontend/src/app/api/jobs/[id]/generate-cv/route.ts
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

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const aiRes = await aiClient.post("/jobs/generate-cv", {
    student_profile_id: profile.id,
    job_id: jobId,
  });

  const { cv_markdown } = aiRes.data;

  await prisma.application.upsert({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    create: {
      studentProfileId: profile.id,
      jobId,
      matchScore: 0,
      cvGenerated: cv_markdown,
    },
    update: { cvGenerated: cv_markdown },
  });

  return NextResponse.json({ cv_markdown });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/jobs/[id]/generate-cv/route.ts
git commit -m "feat: add POST /api/jobs/[id]/generate-cv route"
```

---

## Task 5: POST /api/jobs/[id]/generate-cover-letter — cover letter only

**Files:**
- Create: `frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts
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

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const aiRes = await aiClient.post("/jobs/generate-cover-letter", {
    student_profile_id: profile.id,
    job_id: jobId,
  });

  const { cover_letter } = aiRes.data;

  await prisma.application.upsert({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    create: {
      studentProfileId: profile.id,
      jobId,
      matchScore: 0,
      coverLetter: cover_letter,
    },
    update: { coverLetter: cover_letter },
  });

  return NextResponse.json({ cover_letter });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts
git commit -m "feat: add POST /api/jobs/[id]/generate-cover-letter route"
```

---

## Task 6: Extend POST /api/interviews with job persona context

**Files:**
- Modify: `frontend/src/app/api/interviews/route.ts` (lines 10, 36-51)

The current POST handler destructures `{ missionId, type, scheduledAt }`. Extend it to also accept `jobId`, `company`, `role` and pass them into the Stream call's `custom` object so the AI service can use them for persona context.

- [ ] **Step 1: Update the POST handler**

Replace the body destructure line (line 10) and the Stream call creation block in `frontend/src/app/api/interviews/route.ts`:

```typescript
// Line 10 — replace:
const { missionId, type, scheduledAt } = await req.json();
// with:
const { missionId, type, scheduledAt, jobId, company, role } = await req.json();
```

Then update the Stream call `custom` block (inside `call.create({ data: { ... } })`):

```typescript
custom: {
  interviewId: interview.id,
  interviewType: type ?? "TECHNICAL",
  jobId: jobId ?? null,
  company: company ?? null,
  role: role ?? null,
},
```

And update the AI interviewer upsert to reflect the company name when available:

```typescript
await streamVideo.upsertUsers([
  {
    id: "ai-interviewer",
    name: company ? `${company} Interviewer` : "AI Interviewer",
    role: "user",
  },
]);
```

- [ ] **Step 2: Verify existing interview flow still works**

Go to `/interview` in the browser and start a new TECHNICAL interview (no job context). It should still work exactly as before — the new fields are optional.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/interviews/route.ts
git commit -m "feat: pass job persona context (company, role, jobId) to interview stream call"
```

---

## Task 7: Make job cards clickable on /jobs page

**Files:**
- Modify: `frontend/src/app/jobs/page.tsx`

Currently the job card is a plain `<div>`. Wrap it so clicking navigates to `/jobs/${job.id}`. Keep the save/apply buttons working (stop propagation).

- [ ] **Step 1: Add router and update the card**

Add `useRouter` import (it's already available via `next/navigation`). Replace the outer card `<div>` (line 100–103) with a clickable version:

```tsx
// At the top of the file, add to imports:
import { useRouter } from "next/navigation";

// Inside JobsPage(), add:
const router = useRouter();

// Replace the outer card div opening tag (the one with key={job.id}):
<div
  key={job.id}
  onClick={() => router.push(`/jobs/${job.id}`)}
  className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 hover:border-zinc-700 transition-colors cursor-pointer"
>
```

Then wrap each action button with `onClick={(e) => e.stopPropagation()}` so clicks on Save/Apply don't also navigate:

```tsx
// Save button — add stopPropagation:
<button
  onClick={(e) => { e.stopPropagation(); saveMutation.mutate(job.id); }}
  ...
>

// Apply button (the Generate CV button) — add stopPropagation:
<button
  onClick={(e) => { e.stopPropagation(); setApplying(job.id); applyMutation.mutate(job.id); }}
  ...
>

// The <a> Apply link — add stopPropagation:
<a
  onClick={(e) => e.stopPropagation()}
  href={job.applyUrl}
  ...
>
```

- [ ] **Step 2: Verify in browser**

Open `/jobs`. Click on a job card body — should navigate to `/jobs/JOB_ID`. Click the bookmark or apply button — should NOT navigate (just save/apply as before).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/jobs/page.tsx
git commit -m "feat: make job cards navigate to /jobs/[id] detail page"
```

---

## Task 8: Build the job detail page

**Files:**
- Create: `frontend/src/app/jobs/[id]/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
// frontend/src/app/jobs/[id]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Zap,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Copy,
  Download,
  Code2,
  Users,
  Briefcase,
  LayoutGrid,
  Play,
  FileText,
  Mail,
  Mic,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

type JobDetail = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  applyUrl: string;
  requirementsTags: string[];
  requirementsText: string;
  salaryMin: number | null;
  salaryMax: number | null;
  matchScore: number | null;
  applicationStatus: string | null;
  cvGenerated: string | null;
  coverLetter: string | null;
  isSaved: boolean;
};

type SkillAnalysis = {
  matched: string[];
  gaps: string[];
  suggestions: string[];
};

type InterviewType = "TECHNICAL" | "SYSTEM_DESIGN" | "BEHAVIORAL" | "HR" | "MIXED";

const INTERVIEW_TYPES: { type: InterviewType; label: string; icon: React.ElementType }[] = [
  { type: "TECHNICAL", label: "Technical", icon: Code2 },
  { type: "SYSTEM_DESIGN", label: "System Design", icon: LayoutGrid },
  { type: "BEHAVIORAL", label: "Behavioral", icon: Users },
  { type: "HR", label: "HR", icon: Briefcase },
  { type: "MIXED", label: "Mixed", icon: Zap },
];

// ── Sub-components ───────────────────────────────────────────

function MatchBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const color =
    score >= 70
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : score >= 50
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-zinc-800 text-zinc-500 border-zinc-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${color}`}>
      {score.toFixed(0)}% match
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-zinc-800/60 rounded animate-pulse ${className ?? ""}`} />;
}

function DocumentModal({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(content)
                  .then(() => toast.success("Copied!"))
              }
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white text-xs rounded-lg transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={() => {
                const blob = new Blob([content], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${title.toLowerCase().replace(/ /g, "-")}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white text-xs rounded-lg transition-colors"
            >
              <Download className="w-3 h-3" /> Download
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [cvModal, setCvModal] = useState(false);
  const [clModal, setClModal] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>("TECHNICAL");

  // ── Job data ──────────────────────────────────────────────
  const { data: job, isLoading: jobLoading } = useQuery<JobDetail>({
    queryKey: ["job", jobId],
    queryFn: () =>
      axios.get<JobDetail>(`/api/jobs/${jobId}`).then((r) => r.data),
  });

  // ── Live description (parallel with job) ──────────────────
  const { data: descData, isLoading: descLoading } = useQuery<{
    description: string;
    fallback: boolean;
  }>({
    queryKey: ["job-description", jobId],
    queryFn: () =>
      axios.post(`/api/jobs/${jobId}/description`).then((r) => r.data),
    retry: false,
  });

  // ── Skill analysis (parallel with job) ───────────────────
  const { data: skillData, isLoading: skillLoading, refetch: refetchSkills } = useQuery<SkillAnalysis>({
    queryKey: ["job-skills", jobId],
    queryFn: () =>
      axios.post(`/api/jobs/${jobId}/skill-analysis`).then((r) => r.data),
    retry: false,
  });

  // ── Save ──────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${jobId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", jobId] }),
  });

  // ── Generate CV ───────────────────────────────────────────
  const cvMutation = useMutation({
    mutationFn: () =>
      axios
        .post<{ cv_markdown: string }>(`/api/jobs/${jobId}/generate-cv`)
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("CV generated!");
      setCvModal(true);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Failed to generate CV"),
  });

  // ── Generate Cover Letter ─────────────────────────────────
  const clMutation = useMutation({
    mutationFn: () =>
      axios
        .post<{ cover_letter: string }>(`/api/jobs/${jobId}/generate-cover-letter`)
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Cover letter generated!");
      setClModal(true);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Failed to generate cover letter"),
  });

  // ── Start interview ───────────────────────────────────────
  const interviewMutation = useMutation({
    mutationFn: () =>
      axios
        .post<{ id: string }>("/api/interviews", {
          type: interviewType,
          jobId,
          company: job?.company,
          role: job?.title,
        })
        .then((r) => r.data),
    onSuccess: (session) => router.push(`/interview/${session.id}/call`),
    onError: () => toast.error("Failed to start interview"),
  });

  // CV/CL content: prefer freshly generated, fall back to stored
  const cvContent = cvMutation.data?.cv_markdown ?? job?.cvGenerated ?? "";
  const clContent = clMutation.data?.cover_letter ?? job?.coverLetter ?? "";

  // ── Loading state ─────────────────────────────────────────
  if (jobLoading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 max-w-4xl space-y-8">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Job not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-4xl space-y-8">

        {/* ── Back ─────────────────────────────────────────── */}
        <Link
          href="/jobs"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to jobs
        </Link>

        {/* ── Header card ──────────────────────────────────── */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-xl text-white font-medium">{job.title}</h1>
                <MatchBadge score={job.matchScore} />
                {job.applicationStatus && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {job.applicationStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono flex-wrap mb-3">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                )}
                {job.isRemote && <span className="text-green-500">Remote</span>}
                {job.salaryMin && (
                  <span>
                    ${job.salaryMin.toLocaleString()}–$
                    {job.salaryMax?.toLocaleString() ?? "?"}
                  </span>
                )}
              </div>
              {job.requirementsTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.requirementsTags.slice(0, 10).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500 text-[10px] font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => saveMutation.mutate()}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
              >
                {job.isSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-400" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white text-xs rounded-lg transition-colors"
              >
                Apply <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* ── Actions row ──────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              if (cvContent) { setCvModal(true); return; }
              cvMutation.mutate();
            }}
            disabled={cvMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-zinc-300 hover:text-white text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {cvMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {cvContent ? "Preview CV" : "Generate CV"}
          </button>
          <button
            onClick={() => {
              if (clContent) { setClModal(true); return; }
              clMutation.mutate();
            }}
            disabled={clMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-zinc-300 hover:text-white text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {clMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {clContent ? "Preview Cover Letter" : "Generate Cover Letter"}
          </button>
        </div>

        {/* ── Job Description ───────────────────────────────── */}
        <section>
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Job Description
          </p>
          {descLoading ? (
            <div className="space-y-2.5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-4/6" : i % 2 === 0 ? "w-full" : "w-5/6"}`} />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
              {descData?.fallback && (
                <p className="text-[10px] text-zinc-600 font-mono mb-3 uppercase tracking-wider">
                  Using cached description
                </p>
              )}
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {descData?.description ?? job.requirementsText}
              </div>
            </div>
          )}
        </section>

        {/* ── Skills Analysis ───────────────────────────────── */}
        <section>
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Skills Analysis
          </p>
          {skillLoading ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 space-y-5">
              <div>
                <Skeleton className="h-3 w-28 mb-3" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-7 w-20 rounded-full" />
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-3 w-24 mb-3" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-7 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          ) : skillData ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 space-y-5">
              {skillData.matched.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <p className="text-xs font-mono text-green-400 uppercase tracking-wider">
                      You have ({skillData.matched.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skillData.matched.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skillData.gaps.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <XCircle className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                      Work on ({skillData.gaps.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skillData.gaps.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skillData.suggestions.length > 0 && (
                <div className="border-t border-zinc-800/60 pt-4">
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2.5">
                    Suggestions
                  </p>
                  <ul className="space-y-2">
                    {skillData.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex items-start gap-2 leading-relaxed">
                        <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 text-center">
              <p className="text-sm text-zinc-500 mb-2">Analysis unavailable.</p>
              <button
                onClick={() => refetchSkills()}
                className="text-xs text-amber-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </section>

        {/* ── Mock Interview ────────────────────────────────── */}
        <section className="pb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Mock Interview
          </p>
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Interview at {job.company}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  AI adopts {job.company}&apos;s interview style with questions
                  tailored to this role
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {INTERVIEW_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setInterviewType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    interviewType === type
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => interviewMutation.mutate()}
              disabled={interviewMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {interviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start Interview
            </button>
          </div>
        </section>

      </main>

      {/* ── Document modals ──────────────────────────────────── */}
      {cvModal && cvContent && (
        <DocumentModal
          title="Generated CV"
          content={cvContent}
          onClose={() => setCvModal(false)}
        />
      )}
      {clModal && clContent && (
        <DocumentModal
          title="Cover Letter"
          content={clContent}
          onClose={() => setClModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Navigate to `/jobs` in the browser. Click a job card. You should land on `/jobs/[id]` and see:
- Job header with title, company, tags, match badge
- "Back to jobs" link working
- Description section showing a skeleton, then loading the description (or fallback text)
- Skills analysis section showing a skeleton, then the analysis (or "Analysis unavailable")
- Actions row with "Generate CV" and "Generate Cover Letter" buttons
- Mock Interview section at the bottom with type selector and Start button

- [ ] **Step 3: Test CV generation**

Click "Generate CV". Spinner appears → modal opens with generated markdown content. Click "Copy" → clipboard gets the text. Click "Download" → `.md` file downloads. Click X to close. Button now reads "Preview CV" — clicking it re-opens modal without re-generating.

- [ ] **Step 4: Test Cover Letter generation**

Same flow as CV. Separate modal, separate button, independent of CV state.

- [ ] **Step 5: Test mock interview launch**

Select "Behavioral" type. Click "Start Interview". Should navigate to `/interview/[session-id]/call`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/jobs/[id]/page.tsx
git commit -m "feat: build /jobs/[id] detail page with description, skill analysis, CV/CL generation, and company-persona interview"
```

---

## Self-Review Checklist

- [x] **GET /api/jobs/[id]** → Task 1
- [x] **POST /api/jobs/[id]/description with fallback** → Task 2
- [x] **POST /api/jobs/[id]/skill-analysis** → Task 3
- [x] **POST /api/jobs/[id]/generate-cv (separate from cover letter)** → Task 4
- [x] **POST /api/jobs/[id]/generate-cover-letter (separate from CV)** → Task 5
- [x] **Extend POST /api/interviews with company/role/jobId** → Task 6
- [x] **Job cards clickable → /jobs/[id]** → Task 7
- [x] **Full detail page with all sections** → Task 8
- [x] **Parallel fetch: job + description + skill analysis** → Task 8 (all three useQuery calls, no `enabled` gate)
- [x] **"Preview CV" / "Preview Cover Letter" if already generated** → Task 8 (cvContent/clContent fallback logic)
- [x] **Fallback notice shown when description is cached** → Task 8 (descData.fallback banner)
- [x] **"Analysis unavailable" + retry button** → Task 8
- [x] **stopPropagation on save/apply buttons in job list** → Task 7
- [x] **DocumentModal copy + download** → Task 8
- [x] No placeholders, all code complete
- [x] Types used in Task 8 match the API shapes defined in Tasks 1–5

> **AI service note:** The AI service must implement four new endpoints: `POST /jobs/describe`, `POST /jobs/skill-analysis`, `POST /jobs/generate-cv`, `POST /jobs/generate-cover-letter`. The existing `POST /jobs/apply` is unchanged.
