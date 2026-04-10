# CV & Cover Letter PDF Generation — Design Spec

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

Implement CV and cover letter generation with in-browser preview and one-click ATS-friendly PDF download. The AI service returns structured JSON (not markdown). The frontend renders that JSON as a styled HTML preview and as a proper text-based PDF using `@react-pdf/renderer` — ensuring ATS scanners can read every word.

---

## Architecture

### New / Modified Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `ai-service/app/api/jobs.py` | Add 4 new endpoints: generate-cv, generate-cover-letter, describe, skill-analysis |
| Modify | `ai-service/app/models/schemas.py` | Add request schemas for 4 new endpoints |
| Create | `frontend/src/components/pdf/cv-document.tsx` | React PDF CV template |
| Create | `frontend/src/components/pdf/cover-letter-document.tsx` | React PDF cover letter template |
| Modify | `frontend/src/app/jobs/[id]/page.tsx` | Upgrade modal: structured preview + PDF download |
| Modify | `frontend/src/app/api/jobs/[id]/generate-cv/route.ts` | Store JSON string, return JSON object |
| Modify | `frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts` | Store JSON string, return JSON object |

### New Dependency

```
frontend: @react-pdf/renderer  (generates real text-based PDFs, ATS-safe)
```

No new Python packages needed — the AI service uses only OpenAI and existing asyncpg.

---

## AI Service Endpoints

### `POST /jobs/generate-cv`

**Request:**
```json
{ "student_profile_id": "string", "job_id": "string" }
```

**Response (CvData):**
```json
{
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "phone": "+91 9876543210",
  "linkedin": "linkedin.com/in/arjun",
  "github": "github.com/arjun",
  "summary": "Two-sentence ATS-optimized summary that mirrors the job description language.",
  "skills": {
    "languages": ["Python", "TypeScript", "Java"],
    "frameworks": ["React", "FastAPI", "Node.js"],
    "tools": ["Docker", "PostgreSQL", "Git"]
  },
  "projects": [
    {
      "name": "Project Name",
      "tech": ["Python", "FastAPI"],
      "bullets": [
        "Built X achieving Y outcome",
        "Reduced latency by Z% using W approach"
      ]
    }
  ],
  "education": {
    "degree": "B.Tech Computer Science",
    "institution": "IIT Delhi",
    "year": "2026"
  }
}
```

The AI prompt instructs GPT to: use ATS-friendly language mirroring the JD, avoid tables/special chars, keep bullets to 1–2 lines with measurable outcomes, group skills by category.

### `POST /jobs/generate-cover-letter`

**Request:**
```json
{ "student_profile_id": "string", "job_id": "string" }
```

**Response (CoverLetterData):**
```json
{
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "phone": "+91 9876543210",
  "company": "Google",
  "role": "Software Engineer",
  "greeting": "Dear Hiring Manager,",
  "paragraphs": [
    "Hook paragraph — specific to company and why this role excites the candidate.",
    "Experience paragraph — references 2 specific projects with measurable outcomes.",
    "Why company paragraph — research-backed reason, under 60 words."
  ],
  "closing": "Sincerely,"
}
```

### `POST /jobs/describe`

**Request:**
```json
{ "html": "<raw page HTML>", "job_id": "string" }
```

**Response:**
```json
{ "description": "Cleaned job description text extracted from the HTML." }
```

The AI strips navigation, footers, ads, and boilerplate. Returns only the job description as plain text.

### `POST /jobs/skill-analysis`

**Request:**
```json
{
  "requirement_tags": ["React", "TypeScript", "System Design"],
  "platform_data": [{ "platform": "GITHUB", "data": { ... } }],
  "gap_analysis": { ... }
}
```

**Response:**
```json
{
  "matched": ["React", "TypeScript"],
  "gaps": ["System Design", "Redis"],
  "suggestions": ["Build a caching layer project to demonstrate Redis knowledge."]
}
```

---

## PDF Templates (`@react-pdf/renderer`)

Both templates use only Helvetica (built-in PDF font — no embedding needed, maximum ATS compatibility). All content is real vector text.

### CV Template Layout

```
┌────────────────────────────────────────────┐
│  ARJUN SHARMA                              │
│  arjun@email.com · +91 xxx · linkedin · gh │
├── amber rule ──────────────────────────────┤
│  SUMMARY                                   │
│  Two-sentence professional summary...      │
│                                            │
│  SKILLS                                    │
│  Languages:   Python, TypeScript, Java     │
│  Frameworks:  React, FastAPI, Node.js      │
│  Tools:       Docker, PostgreSQL, Git      │
│                                            │
│  PROJECTS                                  │
│  Project Name  |  Python · FastAPI         │
│  • Built X achieving Y outcome             │
│  • Reduced latency by Z%                   │
│                                            │
│  EDUCATION                                 │
│  B.Tech Computer Science — IIT Delhi       │
│  Expected 2026                             │
└────────────────────────────────────────────┘
```

- Page: A4, margins 40pt all sides
- Name: 22pt, bold, `#111827`
- Contact line: 9pt, `#6B7280`
- Amber rule: 1.5pt line, `#F59E0B`
- Section labels: 8pt, bold, uppercase, `#F59E0B`, with 2pt amber left border accent
- Body text: 10pt, `#374151`
- Bullet points: `•` character, 10pt
- Line height: 1.4

### Cover Letter Template Layout

```
┌────────────────────────────────────────────┐
│  ARJUN SHARMA                              │
│  arjun@email.com · +91 xxx · [date]        │
├── amber rule ──────────────────────────────┤
│  Dear Hiring Manager,                      │
│                                            │
│  [Paragraph 1 — Hook]                      │
│                                            │
│  [Paragraph 2 — Experience]                │
│                                            │
│  [Paragraph 3 — Why Company]               │
│                                            │
│  Sincerely,                                │
│  Arjun Sharma                              │
└────────────────────────────────────────────┘
```

Same font, color, and margin spec as CV.

---

## Frontend Modal Upgrade

### Data Types

```typescript
type CvData = {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  summary: string;
  skills: { languages: string[]; frameworks: string[]; tools: string[] };
  projects: { name: string; tech: string[]; bullets: string[] }[];
  education: { degree: string; institution: string; year: string };
};

type CoverLetterData = {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
};
```

### Modal Behaviour

- Opening: shows a styled HTML div that mirrors the PDF layout (same sections, same order, same amber accents)
- Header row: document title on left, "Download PDF" button on right
- "Download PDF": calls `pdf(<CVDocument data={...} />).toBlob()` → creates object URL → triggers `<a>` click → file saved as `cv-[company].pdf` or `cover-letter-[company].pdf`
- No dialog, no tab switching — one click download
- Modal is scrollable for long documents

### Backward Compatibility

- If `job.cvGenerated` contains a legacy markdown string (from old `/jobs/apply` flow), detect with `JSON.parse` try/catch — if parse fails, render the string in a `<pre>` tag instead. No crash, no data loss.

---

## Updated Next.js API Routes

### `POST /api/jobs/[id]/generate-cv`

1. Call AI service `POST /jobs/generate-cv`
2. AI returns `CvData` object
3. Store `JSON.stringify(cvData)` in `Application.cvGenerated`
4. Return `{ cv: cvData }` to client

### `POST /api/jobs/[id]/generate-cover-letter`

1. Call AI service `POST /jobs/generate-cover-letter`
2. AI returns `CoverLetterData` object
3. Store `JSON.stringify(clData)` in `Application.coverLetter`
4. Return `{ cover_letter: clData }` to client

---

## Error Handling

| Failure | Behaviour |
|---------|-----------|
| AI service timeout / 500 | Next.js route returns 500 → frontend shows toast "Failed to generate CV" |
| `JSON.parse` fails on stored data | Falls back to `<pre>` rendering |
| PDF blob generation fails | Console error + toast "Failed to create PDF" |
| `/jobs/describe` fetch times out | Falls back to `job.requirementsText` (already implemented) |
