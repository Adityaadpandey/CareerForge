# Job Detail Page — Design Spec

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

Add a `/jobs/[id]` detail page that opens when a user clicks any job card on the jobs list. The page shows a live-fetched job description, AI-powered skill gap analysis, separate CV and cover letter generators with preview modals, an apply button, and a company-persona mock interview launcher.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/app/jobs/[id]/page.tsx` | Job detail page (client component) |
| `frontend/src/app/api/jobs/[id]/route.ts` | GET single job + application state for current user |
| `frontend/src/app/api/jobs/[id]/description/route.ts` | POST: live-fetch applyUrl → AI-parse clean description |
| `frontend/src/app/api/jobs/[id]/skill-analysis/route.ts` | POST: AI skill gap analysis (student profile vs job requirements) |
| `frontend/src/app/api/jobs/[id]/generate-cv/route.ts` | POST: generate CV only, store in Application.cvGenerated |
| `frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts` | POST: generate cover letter only, store in Application.coverLetter |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/app/jobs/page.tsx` | Make job cards clickable → navigate to `/jobs/[id]` |
| `frontend/src/app/api/interviews/route.ts` | Accept optional `jobId`, `company`, `role` fields for company-persona interview context |

---

## Data Flow

1. User clicks a job card → navigates to `/jobs/[id]`
2. Page immediately renders with cached job data (title, company, tags, match score from the list query)
3. On mount, two requests fire **in parallel**:
   - `POST /api/jobs/[id]/description` — live-fetches `job.applyUrl`, sends HTML to AI, returns clean description markdown
   - `POST /api/jobs/[id]/skill-analysis` — loads student platform data + readiness gap analysis, sends with `requirementsTags` to AI, returns `{ matched, gaps, suggestions }`
4. Skeletons shown for both sections until responses arrive
5. User clicks "Generate CV" → `POST /api/jobs/[id]/generate-cv` → response stored in Application, shown in preview modal
6. User clicks "Generate Cover Letter" → `POST /api/jobs/[id]/generate-cover-letter` → same pattern, separate modal
7. User clicks "Apply" → opens `job.applyUrl` in new tab, calls `POST /api/jobs/[id]/apply` to mark status as APPLIED
8. User clicks "Start Interview" → `POST /api/interviews` with `{ jobId, company, role }` → redirects to `/interview/[session-id]/call`

---

## UI Layout (single scrollable page)

### Job Header (instant)
- Back arrow → `/jobs`
- Job title, company name, location, remote badge, salary range
- Match score badge (green ≥70%, amber ≥50%, red <50%)
- Bookmark (save) button + Apply button (external link)

### Job Description (skeleton while loading)
- Live-fetched via server route from `job.applyUrl`
- AI strips boilerplate/navigation HTML, extracts only the job description
- Rendered as formatted markdown
- **Fallback:** if live-fetch fails (404, timeout, bot-block), display stored `job.requirementsText`

### Skills Analysis (skeleton while loading, parallel with description)
- **Matched skills** — green pills: overlap between `requirementsTags` and student's inferred skills
- **Skills to work on** — amber pills: `requirementsTags` the student lacks
- **Suggestions** — short AI-generated tips for each gap (e.g., "Build a REST API project on GitHub")
- If platform data is sparse: shows inline prompt to sync GitHub / LeetCode

### Actions Row
- **Generate CV** — button, triggers POST, shows spinner, then opens preview modal
  - Modal: full-screen dark overlay, markdown-rendered CV, Copy + Download buttons
  - If already generated (Application exists with cvGenerated): shows "Regenerate CV" + preview of existing
- **Generate Cover Letter** — same pattern as CV, separate modal
- **Apply** — opens `applyUrl` in new tab, marks Application status as APPLIED

### Mock Interview Section (bottom of page)
- Card: "Interview at [Company] for [Role]"
- Context line: "AI interviewer uses [Company]'s known style with questions from this JD"
- Interview type selector: Technical / Behavioral / HR / Mixed
- **Start Interview** button → POST `/api/interviews` with `{ jobId, company, role, type }` → navigate to `/interview/[id]/call`

---

## API Contracts

### `GET /api/jobs/[id]`
Returns:
```json
{
  "id": "string",
  "title": "string",
  "company": "string",
  "location": "string | null",
  "isRemote": "boolean",
  "applyUrl": "string",
  "requirementsTags": ["string"],
  "requirementsText": "string",
  "salaryMin": "number | null",
  "salaryMax": "number | null",
  "matchScore": "number | null",
  "applicationStatus": "string | null",
  "cvGenerated": "string | null",
  "coverLetter": "string | null",
  "isSaved": "boolean"
}
```

### `POST /api/jobs/[id]/description`
- Server-side fetches `job.applyUrl` using native `fetch` with a browser User-Agent header
- Sends raw HTML to AI service at `/jobs/describe`
- AI returns `{ description: string }` (clean markdown)
- Fallback: if fetch or AI fails, return `{ description: job.requirementsText, fallback: true }`

### `POST /api/jobs/[id]/skill-analysis`
- Loads student's `platformConnections` (all parsedData) + latest `readinessScore.gapAnalysis`
- Sends to AI at `/jobs/skill-analysis` along with `requirementsTags`
- AI returns:
```json
{
  "matched": ["React", "TypeScript"],
  "gaps": ["System Design", "Redis"],
  "suggestions": ["Build a caching layer project to demonstrate Redis usage"]
}
```

### `POST /api/jobs/[id]/generate-cv`
- Calls AI at `/jobs/generate-cv` with student profile + job context
- Upserts `Application` with `cvGenerated` field
- Returns `{ cv_markdown: string }`

### `POST /api/jobs/[id]/generate-cover-letter`
- Calls AI at `/jobs/generate-cover-letter` with student profile + job context
- Upserts `Application` with `coverLetter` field
- Returns `{ cover_letter: string }`

### `POST /api/interviews` (extended)
- New optional fields: `jobId: string`, `company: string`, `role: string`
- When present, AI system prompt includes: *"You are a [role] interviewer at [company]. Adopt [company]'s known interview format and culture. Base technical questions on these required skills: [requirementsTags]."*
- Existing interview flow (session creation, navigation to call page) unchanged

---

## Error Handling

- Live description fetch: graceful fallback to `requirementsText`, show "Using cached description" notice
- Skill analysis failure: show "Analysis unavailable — try again" with retry button
- CV/Cover letter generation failure: toast error, button returns to idle state
- Interview creation failure: toast error

---

## Design Constraints

- Match existing dark theme (`bg-[#0a0a0a]`, zinc palette, amber accents)
- Follow existing component patterns (sidebar layout, skeleton loaders, toast notifications)
- No new dependencies unless strictly necessary
- Mobile-first: actions stack vertically on small screens
