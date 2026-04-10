# CV & Cover Letter PDF Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four AI service endpoints for CV/cover letter generation, job description extraction, and skill analysis — then wire up ATS-friendly PDF preview + one-click download in the frontend using `@react-pdf/renderer`.

**Architecture:** AI service returns structured JSON (not markdown) for CV and cover letter. Frontend types match that JSON exactly. PDF documents are React components using `@react-pdf/renderer` primitives (Helvetica, real text — ATS-safe). PDFs generated client-side via dynamic import in event handlers to avoid SSR issues. Legacy markdown stored in DB falls back gracefully.

**Tech Stack:** Python FastAPI (AI service), OpenAI JSON mode, `@react-pdf/renderer`, Next.js 16 App Router, Prisma, TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `ai-service/app/models/schemas.py` | Add 4 new request schemas |
| Modify | `ai-service/app/api/jobs.py` | Add 4 new endpoints |
| Install | `frontend/` | `@react-pdf/renderer` package |
| Create | `frontend/src/components/pdf/types.ts` | Shared `CvData` + `CoverLetterData` types |
| Create | `frontend/src/components/pdf/cv-document.tsx` | React PDF CV template |
| Create | `frontend/src/components/pdf/cover-letter-document.tsx` | React PDF cover letter template |
| Modify | `frontend/src/app/api/jobs/[id]/generate-cv/route.ts` | Return JSON, store JSON string |
| Modify | `frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts` | Return JSON, store JSON string |
| Modify | `frontend/src/app/jobs/[id]/page.tsx` | Structured HTML preview + PDF download |

---

## Task 1: Add Pydantic schemas for new AI endpoints

**Files:**
- Modify: `ai-service/app/models/schemas.py`

- [ ] **Step 1: Add 4 new schemas at the bottom of the file**

```python
class JobsGenerateCvRequest(BaseModel):
    student_profile_id: str
    job_id: str


class JobsGenerateCoverLetterRequest(BaseModel):
    student_profile_id: str
    job_id: str


class JobsDescribeRequest(BaseModel):
    html: str
    job_id: str


class JobsSkillAnalysisRequest(BaseModel):
    requirement_tags: list[str]
    platform_data: list[dict]
    gap_analysis: Optional[dict] = None
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/app/models/schemas.py
git commit -m "feat: add schemas for generate-cv, generate-cover-letter, describe, skill-analysis"
```

---

## Task 2: Add `POST /jobs/generate-cv` AI endpoint

**Files:**
- Modify: `ai-service/app/api/jobs.py`

- [ ] **Step 1: Add import for new schema at top of `jobs.py`**

The existing import line is:
```python
from app.models.schemas import JobsFetchRequest, JobsApplyRequest, JobsMatchRequest
```

Replace with:
```python
from app.models.schemas import (
    JobsFetchRequest,
    JobsApplyRequest,
    JobsMatchRequest,
    JobsGenerateCvRequest,
    JobsGenerateCoverLetterRequest,
    JobsDescribeRequest,
    JobsSkillAnalysisRequest,
)
```

- [ ] **Step 2: Add the `generate-cv` endpoint after the existing `/match` endpoint**

```python
@router.post("/generate-cv")
async def generate_cv(req: JobsGenerateCvRequest):
    """Generate a structured ATS-friendly CV as JSON."""
    pool = await get_pool()

    profile = await pool.fetchrow(
        """
        SELECT sp."targetRole", sp."githubUsername", sp."linkedinUrl",
               sp."graduationYear", sp."department",
               u.name AS student_name, u.email AS student_email,
               pc."parsedData" AS github_data,
               lc."parsedData" AS lc_data,
               uni.name AS university_name
        FROM "StudentProfile" sp
        LEFT JOIN "User" u ON u.id = sp."userId"
        LEFT JOIN "PlatformConnection" pc
               ON pc."studentProfileId" = sp.id AND pc.platform = 'GITHUB'
        LEFT JOIN "PlatformConnection" lc
               ON lc."studentProfileId" = sp.id AND lc.platform = 'LEETCODE'
        LEFT JOIN "University" uni ON uni.id = sp."universityId"
        WHERE sp.id = $1
        """,
        req.student_profile_id,
    )

    job = await pool.fetchrow(
        'SELECT title, company, "requirementsText", "requirementsTags" FROM "Job" WHERE id = $1',
        req.job_id,
    )

    if not profile or not job:
        return {"status": "error", "message": "Not found"}

    gh = json.loads(profile["github_data"] or "{}")
    lc = json.loads(profile["lc_data"] or "{}")
    projects = gh.get("top_projects", [])
    languages = list(gh.get("primary_languages", {}).keys())
    lc_solved = lc.get("total_solved", 0)

    prompt = f"""
You are generating a structured CV for a student. Return ONLY valid JSON with no extra text.

Required JSON schema:
{{
  "name": "student full name (use '{profile['student_name'] or 'Your Name'}' if known)",
  "email": "student email (use '{profile['student_email'] or 'email@example.com'}' if known)",
  "phone": "+91 XXXXXXXXXX",
  "linkedin": "{profile['linkedinUrl'] or 'linkedin.com/in/username'}",
  "github": "github.com/{profile['githubUsername'] or 'username'}",
  "summary": "exactly 2 sentences, ATS-optimized, mirror job description language",
  "skills": {{
    "languages": ["list of programming languages"],
    "frameworks": ["list of frameworks/libraries"],
    "tools": ["list of tools, databases, platforms"]
  }},
  "projects": [
    {{
      "name": "project name",
      "tech": ["tech1", "tech2"],
      "bullets": ["action verb + specific achievement + measurable outcome", "..."]
    }}
  ],
  "education": {{
    "degree": "{profile['department'] or 'B.Tech Computer Science'}",
    "institution": "{profile['university_name'] or 'University Name'}",
    "year": "{profile['graduationYear'] or '2026'}"
  }}
}}

Job: {job['title']} at {job['company']}
Job requirements: {job['requirementsText'][:800]}
Required skills: {job['requirementsTags']}
Student top projects: {json.dumps(projects[:3])}
Known languages: {languages}
LeetCode solved: {lc_solved}

Rules:
- Include 3 projects maximum, rewrite bullets to match JD keywords
- Each project needs 2-3 bullet points starting with strong action verbs
- Skills must be grouped by category (languages/frameworks/tools), no duplicates
- Summary must mention the target role and mirror JD language
- Return ONLY the JSON object, no markdown, no explanation
"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    import json as _json
    cv_data = _json.loads(res.choices[0].message.content)
    return cv_data
```

- [ ] **Step 3: Verify the endpoint is reachable**

Start the AI service (`uvicorn app.main:app --reload --port 8000`) and check docs:

```bash
curl http://localhost:8000/docs | grep generate-cv
```

Expected: `generate-cv` appears in the docs output.

- [ ] **Step 4: Commit**

```bash
git add ai-service/app/api/jobs.py
git commit -m "feat: add POST /jobs/generate-cv endpoint returning structured JSON"
```

---

## Task 3: Add `POST /jobs/generate-cover-letter` AI endpoint

**Files:**
- Modify: `ai-service/app/api/jobs.py`

- [ ] **Step 1: Add the `generate-cover-letter` endpoint after `generate-cv`**

```python
@router.post("/generate-cover-letter")
async def generate_cover_letter(req: JobsGenerateCoverLetterRequest):
    """Generate a structured cover letter as JSON."""
    pool = await get_pool()

    profile = await pool.fetchrow(
        """
        SELECT sp."targetRole",
               u.name AS student_name, u.email AS student_email
        FROM "StudentProfile" sp
        LEFT JOIN "User" u ON u.id = sp."userId"
        LEFT JOIN "PlatformConnection" pc
               ON pc."studentProfileId" = sp.id AND pc.platform = 'GITHUB'
        WHERE sp.id = $1
        """,
        req.student_profile_id,
    )

    job = await pool.fetchrow(
        'SELECT title, company, "requirementsText" FROM "Job" WHERE id = $1',
        req.job_id,
    )

    # Get GitHub projects for the experience paragraph
    profile_full = await pool.fetchrow(
        """SELECT pc."parsedData" AS github_data
           FROM "StudentProfile" sp
           LEFT JOIN "PlatformConnection" pc
                  ON pc."studentProfileId" = sp.id AND pc.platform = 'GITHUB'
           WHERE sp.id = $1""",
        req.student_profile_id,
    )

    if not profile or not job:
        return {"status": "error", "message": "Not found"}

    gh = json.loads((profile_full or {}).get("github_data") or "{}")
    projects = gh.get("top_projects", [])

    prompt = f"""
You are generating a cover letter for a student. Return ONLY valid JSON with no extra text.

Required JSON schema:
{{
  "name": "{profile['student_name'] or 'Your Name'}",
  "email": "{profile['student_email'] or 'email@example.com'}",
  "phone": "+91 XXXXXXXXXX",
  "company": "{job['company']}",
  "role": "{job['title']}",
  "greeting": "Dear Hiring Manager,",
  "paragraphs": [
    "Hook paragraph (2-3 sentences): why THIS company and THIS role excites the candidate. Be specific.",
    "Experience paragraph (3-4 sentences): reference 2 specific projects from the student's work with measurable outcomes. Match JD keywords.",
    "Why company paragraph (2-3 sentences): research-backed reason why this company specifically. Under 70 words."
  ],
  "closing": "Sincerely,"
}}

Job: {job['title']} at {job['company']}
Job requirements: {job['requirementsText'][:600]}
Student projects: {json.dumps(projects[:2])}

Rules:
- Total word count must be under 280 words (all 3 paragraphs combined)
- Professional but genuine tone — avoid clichés like "I am excited to apply"
- Each paragraph is a single string (no line breaks within)
- Return ONLY the JSON object, no markdown, no explanation
"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    import json as _json
    cl_data = _json.loads(res.choices[0].message.content)
    return cl_data
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/app/api/jobs.py
git commit -m "feat: add POST /jobs/generate-cover-letter endpoint returning structured JSON"
```

---

## Task 4: Add `POST /jobs/describe` and `POST /jobs/skill-analysis` AI endpoints

**Files:**
- Modify: `ai-service/app/api/jobs.py`

- [ ] **Step 1: Add both endpoints after `generate-cover-letter`**

```python
@router.post("/describe")
async def describe_job(req: JobsDescribeRequest):
    """Extract clean job description text from raw HTML."""
    # Truncate HTML to avoid token limits
    html_snippet = req.html[:8000]

    prompt = f"""
Extract only the job description text from the following HTML page.
Remove all navigation, headers, footers, ads, cookie notices, and boilerplate.
Return only the actual job posting content: role overview, responsibilities, requirements, and qualifications.
Keep the text clean and readable. Do not add any commentary or formatting — just the extracted text.

HTML:
{html_snippet}
"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
    )

    return {"description": res.choices[0].message.content.strip()}


@router.post("/skill-analysis")
async def skill_analysis(req: JobsSkillAnalysisRequest):
    """Analyse student skills against job requirements."""
    import json as _json

    # Extract skills from platform data
    student_skills: list[str] = []
    for conn in req.platform_data:
        data = conn.get("data") or {}
        if isinstance(data, str):
            try:
                data = _json.loads(data)
            except Exception:
                data = {}
        platform = conn.get("platform", "")
        if platform == "GITHUB":
            langs = list((data.get("primary_languages") or {}).keys())
            student_skills.extend(langs)
            for proj in (data.get("top_projects") or [])[:5]:
                student_skills.extend(proj.get("topics") or [])
        elif platform == "LEETCODE":
            if data.get("total_solved", 0) > 100:
                student_skills.append("Data Structures & Algorithms")
        elif platform == "LINKEDIN":
            student_skills.extend(data.get("skills") or [])

    # Remove duplicates, normalise case
    student_skills = list(dict.fromkeys(s.strip() for s in student_skills if s.strip()))

    # Gap analysis weak topics
    weak_topics: list[str] = []
    if req.gap_analysis:
        weak_topics = req.gap_analysis.get("weak_topics") or []

    prompt = f"""
You are a career advisor analysing a student's skills against a job's requirements.
Return ONLY valid JSON with no extra text.

Required JSON schema:
{{
  "matched": ["skills the student clearly has"],
  "gaps": ["required skills the student is missing"],
  "suggestions": ["1-2 sentence actionable suggestion for each gap skill"]
}}

Job required skills: {req.requirement_tags}
Student known skills: {student_skills}
Student weak topics: {weak_topics}

Rules:
- matched: only include skills that appear in BOTH the requirement_tags AND student skills (case-insensitive comparison)
- gaps: skills from requirement_tags that the student does not have
- suggestions: one suggestion per gap skill (same order as gaps list), 1-2 sentences each, concrete and actionable
- Return ONLY the JSON object
"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    return _json.loads(res.choices[0].message.content)
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/app/api/jobs.py
git commit -m "feat: add POST /jobs/describe and POST /jobs/skill-analysis endpoints"
```

---

## Task 5: Install `@react-pdf/renderer` in frontend

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1: Install the package**

```bash
cd frontend && npm install @react-pdf/renderer
```

Expected: package added to `node_modules`, `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install @react-pdf/renderer for ATS-friendly PDF generation"
```

---

## Task 6: Create shared PDF types and `CVDocument` component

**Files:**
- Create: `frontend/src/components/pdf/types.ts`
- Create: `frontend/src/components/pdf/cv-document.tsx`

- [ ] **Step 1: Create the types file**

```typescript
// frontend/src/components/pdf/types.ts

export type CvData = {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  summary: string;
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
  projects: {
    name: string;
    tech: string[];
    bullets: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  };
};

export type CoverLetterData = {
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

- [ ] **Step 2: Create the `CVDocument` component**

```tsx
// frontend/src/components/pdf/cv-document.tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "./types";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#374151",
    paddingHorizontal: 40,
    paddingVertical: 40,
    backgroundColor: "#FFFFFF",
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 10,
  },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#F59E0B",
    marginBottom: 14,
  },
  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#F59E0B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: "#F59E0B",
  },
  summaryText: { fontSize: 10, color: "#374151", lineHeight: 1.5 },
  skillRow: { flexDirection: "row", marginBottom: 3 },
  skillCategory: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    width: 90,
  },
  skillList: { fontSize: 9, color: "#374151", flex: 1 },
  projectBlock: { marginBottom: 8 },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  projectName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  projectTech: { fontSize: 9, color: "#6B7280" },
  bullet: {
    fontSize: 9.5,
    color: "#374151",
    lineHeight: 1.4,
    marginBottom: 2,
    paddingLeft: 10,
  },
  educationDegree: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  educationDetail: { fontSize: 9, color: "#6B7280" },
});

export function CVDocument({ data }: { data: CvData }) {
  const contact = [data.email, data.phone, data.linkedin, data.github]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <Text style={S.name}>{data.name}</Text>
        <Text style={S.contact}>{contact}</Text>
        <View style={S.rule} />

        {/* Summary */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Summary</Text>
          <Text style={S.summaryText}>{data.summary}</Text>
        </View>

        {/* Skills */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Skills</Text>
          {data.skills.languages.length > 0 && (
            <View style={S.skillRow}>
              <Text style={S.skillCategory}>Languages</Text>
              <Text style={S.skillList}>{data.skills.languages.join(", ")}</Text>
            </View>
          )}
          {data.skills.frameworks.length > 0 && (
            <View style={S.skillRow}>
              <Text style={S.skillCategory}>Frameworks</Text>
              <Text style={S.skillList}>{data.skills.frameworks.join(", ")}</Text>
            </View>
          )}
          {data.skills.tools.length > 0 && (
            <View style={S.skillRow}>
              <Text style={S.skillCategory}>Tools</Text>
              <Text style={S.skillList}>{data.skills.tools.join(", ")}</Text>
            </View>
          )}
        </View>

        {/* Projects */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Projects</Text>
          {data.projects.map((project, i) => (
            <View key={i} style={S.projectBlock}>
              <View style={S.projectHeader}>
                <Text style={S.projectName}>{project.name}</Text>
                <Text style={S.projectTech}>{project.tech.join(" · ")}</Text>
              </View>
              {project.bullets.map((bullet, j) => (
                <Text key={j} style={S.bullet}>
                  {"• "}{bullet}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Education */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Education</Text>
          <Text style={S.educationDegree}>{data.education.degree}</Text>
          <Text style={S.educationDetail}>
            {data.education.institution}{"  ·  Expected "}{data.education.year}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pdf/types.ts frontend/src/components/pdf/cv-document.tsx
git commit -m "feat: add CVDocument React PDF component with ATS-friendly Helvetica layout"
```

---

## Task 7: Create `CoverLetterDocument` component

**Files:**
- Create: `frontend/src/components/pdf/cover-letter-document.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/pdf/cover-letter-document.tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CoverLetterData } from "./types";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#374151",
    paddingHorizontal: 50,
    paddingVertical: 45,
    backgroundColor: "#FFFFFF",
  },
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  contact: { fontSize: 9, color: "#6B7280", marginBottom: 10 },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#F59E0B",
    marginBottom: 20,
  },
  date: { fontSize: 9, color: "#6B7280", marginBottom: 16 },
  greeting: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 10.5,
    color: "#374151",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  closing: { fontSize: 10.5, color: "#374151", marginTop: 8, marginBottom: 24 },
  sigName: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
});

export function CoverLetterDocument({ data }: { data: CoverLetterData }) {
  const contact = [data.email, data.phone].filter(Boolean).join("  ·  ");
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Text style={S.name}>{data.name}</Text>
        <Text style={S.contact}>{contact}</Text>
        <View style={S.rule} />
        <Text style={S.date}>{today}</Text>
        <Text style={S.greeting}>{data.greeting}</Text>
        {data.paragraphs.map((p, i) => (
          <Text key={i} style={S.paragraph}>{p}</Text>
        ))}
        <Text style={S.closing}>{data.closing}</Text>
        <Text style={S.sigName}>{data.name}</Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/pdf/cover-letter-document.tsx
git commit -m "feat: add CoverLetterDocument React PDF component"
```

---

## Task 8: Update Next.js `generate-cv` and `generate-cover-letter` routes

**Files:**
- Modify: `frontend/src/app/api/jobs/[id]/generate-cv/route.ts`
- Modify: `frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts`

- [ ] **Step 1: Replace `generate-cv/route.ts` entirely**

```typescript
// frontend/src/app/api/jobs/[id]/generate-cv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";
import type { CvData } from "@/components/pdf/types";

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

  const aiRes = await aiClient.post<CvData>("/jobs/generate-cv", {
    student_profile_id: profile.id,
    job_id: jobId,
  });

  const cvData = aiRes.data;

  await prisma.application.upsert({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    create: {
      studentProfileId: profile.id,
      jobId,
      matchScore: 0,
      cvGenerated: JSON.stringify(cvData),
    },
    update: { cvGenerated: JSON.stringify(cvData) },
  });

  return NextResponse.json({ cv: cvData });
}
```

- [ ] **Step 2: Replace `generate-cover-letter/route.ts` entirely**

```typescript
// frontend/src/app/api/jobs/[id]/generate-cover-letter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiClient } from "@/lib/ai-client";
import type { CoverLetterData } from "@/components/pdf/types";

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

  const aiRes = await aiClient.post<CoverLetterData>("/jobs/generate-cover-letter", {
    student_profile_id: profile.id,
    job_id: jobId,
  });

  const clData = aiRes.data;

  await prisma.application.upsert({
    where: { studentProfileId_jobId: { studentProfileId: profile.id, jobId } },
    create: {
      studentProfileId: profile.id,
      jobId,
      matchScore: 0,
      coverLetter: JSON.stringify(clData),
    },
    update: { coverLetter: JSON.stringify(clData) },
  });

  return NextResponse.json({ cover_letter: clData });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/jobs/\[id\]/generate-cv/route.ts \
        frontend/src/app/api/jobs/\[id\]/generate-cover-letter/route.ts
git commit -m "feat: update generate-cv and generate-cover-letter routes to return/store JSON"
```

---

## Task 9: Upgrade the modal in `jobs/[id]/page.tsx`

**Files:**
- Modify: `frontend/src/app/jobs/[id]/page.tsx`

This is the largest change. The modal currently shows raw `<pre>` text. We upgrade it to:
1. A structured HTML preview that mirrors the PDF
2. A "Download PDF" button that generates and saves the file

- [ ] **Step 1: Update type imports and state types at the top of `page.tsx`**

Add this import after the existing lucide import line:
```tsx
import type { CvData, CoverLetterData } from "@/components/pdf/types";
```

- [ ] **Step 2: Replace the `DocumentModal` component inside `page.tsx`**

Find and delete the entire existing `DocumentModal` function (it takes `title`, `content: string`, `onClose`). Replace it with:

```tsx
function parseLegacy(raw: string): string | null {
  try { JSON.parse(raw); return null; } catch { return raw; }
}

function CvPreview({ data }: { data: CvData }) {
  const contact = [data.email, data.phone, data.linkedin, data.github]
    .filter(Boolean).join("  ·  ");
  return (
    <div className="font-mono text-zinc-200 space-y-5">
      <div>
        <p className="text-2xl font-bold text-white">{data.name}</p>
        <p className="text-xs text-zinc-400 mt-1">{contact}</p>
        <div className="border-b border-amber-500 mt-3" />
      </div>
      <Section label="Summary">
        <p className="text-sm text-zinc-300 leading-relaxed">{data.summary}</p>
      </Section>
      <Section label="Skills">
        {data.skills.languages.length > 0 && (
          <SkillRow label="Languages" value={data.skills.languages.join(", ")} />
        )}
        {data.skills.frameworks.length > 0 && (
          <SkillRow label="Frameworks" value={data.skills.frameworks.join(", ")} />
        )}
        {data.skills.tools.length > 0 && (
          <SkillRow label="Tools" value={data.skills.tools.join(", ")} />
        )}
      </Section>
      <Section label="Projects">
        {data.projects.map((p, i) => (
          <div key={i} className="mb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-white">{p.name}</span>
              <span className="text-xs text-zinc-400">{p.tech.join(" · ")}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {p.bullets.map((b, j) => (
                <li key={j} className="text-xs text-zinc-300 pl-3">• {b}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>
      <Section label="Education">
        <p className="text-sm font-bold text-white">{data.education.degree}</p>
        <p className="text-xs text-zinc-400">
          {data.education.institution} · Expected {data.education.year}
        </p>
      </Section>
    </div>
  );
}

function ClPreview({ data }: { data: CoverLetterData }) {
  const contact = [data.email, data.phone].filter(Boolean).join("  ·  ");
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="font-mono text-zinc-200 space-y-5">
      <div>
        <p className="text-xl font-bold text-white">{data.name}</p>
        <p className="text-xs text-zinc-400 mt-1">{contact}</p>
        <div className="border-b border-amber-500 mt-3" />
      </div>
      <p className="text-xs text-zinc-500">{today}</p>
      <p className="text-sm font-bold text-zinc-200">{data.greeting}</p>
      {data.paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-zinc-300 leading-relaxed">{p}</p>
      ))}
      <div>
        <p className="text-sm text-zinc-300">{data.closing}</p>
        <p className="text-sm font-bold text-white mt-4">{data.name}</p>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest pl-1.5 border-l-2 border-amber-400 mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function SkillRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs mb-1">
      <span className="font-bold text-zinc-200 w-24 shrink-0">{label}</span>
      <span className="text-zinc-400">{value}</span>
    </div>
  );
}

function DocumentModal({
  title,
  kind,
  cvData,
  clData,
  company,
  legacyText,
  onClose,
}: {
  title: string;
  kind: "cv" | "cl";
  cvData?: CvData;
  clData?: CoverLetterData;
  company: string;
  legacyText?: string;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const slug = company.toLowerCase().replace(/\s+/g, "-");
      if (kind === "cv" && cvData) {
        const { pdf } = await import("@react-pdf/renderer");
        const { CVDocument } = await import("@/components/pdf/cv-document");
        const blob = await pdf(<CVDocument data={cvData} />).toBlob();
        triggerDownload(blob, `cv-${slug}.pdf`);
      } else if (kind === "cl" && clData) {
        const { pdf } = await import("@react-pdf/renderer");
        const { CoverLetterDocument } = await import("@/components/pdf/cover-letter-document");
        const blob = await pdf(<CoverLetterDocument data={clData} />).toBlob();
        triggerDownload(blob, `cover-letter-${slug}.pdf`);
      }
    } catch {
      toast.error("Failed to create PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading || !!legacyText}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              {downloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {legacyText ? (
            <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
              {legacyText}
            </pre>
          ) : kind === "cv" && cvData ? (
            <CvPreview data={cvData} />
          ) : kind === "cl" && clData ? (
            <ClPreview data={clData} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Update state types and mutation return handling in `JobDetailPage`**

Find the existing state declarations for `cvModal` and `clModal` — they stay the same. But add state for legacy fallback:

```tsx
// Replace the existing cvContent / clContent lines:
const [cvData, setCvData] = useState<CvData | null>(null);
const [clData, setClData] = useState<CoverLetterData | null>(null);
```

Update `cvMutation` to use `setCvData`:
```tsx
const cvMutation = useMutation({
  mutationFn: () =>
    axios
      .post<{ cv: CvData }>(`/api/jobs/${jobId}/generate-cv`)
      .then((r) => r.data),
  onSuccess: (data) => {
    setCvData(data.cv);
    toast.success("CV generated!");
    setCvModal(true);
    qc.invalidateQueries({ queryKey: ["job", jobId] });
  },
  onError: () => toast.error("Failed to generate CV"),
});
```

Update `clMutation` to use `setClData`:
```tsx
const clMutation = useMutation({
  mutationFn: () =>
    axios
      .post<{ cover_letter: CoverLetterData }>(`/api/jobs/${jobId}/generate-cover-letter`)
      .then((r) => r.data),
  onSuccess: (data) => {
    setClData(data.cover_letter);
    toast.success("Cover letter generated!");
    setClModal(true);
    qc.invalidateQueries({ queryKey: ["job", jobId] });
  },
  onError: () => toast.error("Failed to generate cover letter"),
});
```

Parse stored data from the job query on mount (add after `job` is defined in the component body):
```tsx
// Parse stored CV/CL from DB when job loads (run once)
const storedCv = job?.cvGenerated
  ? (() => { try { return JSON.parse(job.cvGenerated) as CvData; } catch { return null; } })()
  : null;
const storedCl = job?.coverLetter
  ? (() => { try { return JSON.parse(job.coverLetter) as CoverLetterData; } catch { return null; } })()
  : null;

const effectiveCvData = cvData ?? storedCv;
const effectiveClData = clData ?? storedCl;

// Legacy markdown fallback
const legacyCvText = !effectiveCvData && job?.cvGenerated
  ? parseLegacy(job.cvGenerated) ?? undefined
  : undefined;
const legacyClText = !effectiveClData && job?.coverLetter
  ? parseLegacy(job.coverLetter) ?? undefined
  : undefined;
```

- [ ] **Step 4: Update the actions row buttons**

```tsx
<button
  onClick={() => {
    if (effectiveCvData || legacyCvText) { setCvModal(true); return; }
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
  {effectiveCvData || legacyCvText ? "Preview CV" : "Generate CV"}
</button>

<button
  onClick={() => {
    if (effectiveClData || legacyClText) { setClModal(true); return; }
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
  {effectiveClData || legacyClText ? "Preview Cover Letter" : "Generate Cover Letter"}
</button>
```

- [ ] **Step 5: Replace the modal JSX at the bottom of the return**

```tsx
{cvModal && (
  <DocumentModal
    title="Generated CV"
    kind="cv"
    cvData={effectiveCvData ?? undefined}
    company={job.company}
    legacyText={legacyCvText}
    onClose={() => setCvModal(false)}
  />
)}
{clModal && (
  <DocumentModal
    title="Cover Letter"
    kind="cl"
    clData={effectiveClData ?? undefined}
    company={job.company}
    legacyText={legacyClText}
    onClose={() => setClModal(false)}
  />
)}
```

- [ ] **Step 6: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "jobs/\[id\]|components/pdf"
```

Expected: no output (no errors in our files).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/jobs/\[id\]/page.tsx
git commit -m "feat: upgrade job detail modal with structured CV/CL preview and PDF download"
```

---

## Self-Review Checklist

- [x] `POST /jobs/generate-cv` → Task 2 (returns CvData JSON)
- [x] `POST /jobs/generate-cover-letter` → Task 3 (returns CoverLetterData JSON)
- [x] `POST /jobs/describe` → Task 4 (extracts clean text from HTML)
- [x] `POST /jobs/skill-analysis` → Task 4 (matched/gaps/suggestions)
- [x] All 4 schemas in `schemas.py` → Task 1
- [x] `@react-pdf/renderer` installed → Task 5
- [x] `CVDocument` with Helvetica, real PDF text, ATS-safe → Task 6
- [x] `CoverLetterDocument` same standards → Task 7
- [x] Next.js routes store JSON string, return JSON object → Task 8
- [x] Modal shows structured HTML preview matching PDF sections → Task 9
- [x] "Download PDF" dynamically imports renderer, no SSR crash → Task 9 (`handleDownload` uses `await import()`)
- [x] Backward compatibility: legacy markdown strings render in `<pre>` → Task 9 (`parseLegacy` + `legacyText` prop)
- [x] Type consistency: `CvData`/`CoverLetterData` defined once in `types.ts`, imported everywhere → Tasks 6, 7, 8, 9
- [x] `triggerDownload` helper defined once outside modal, used for both CV and CL → Task 9
- [x] No placeholders, all code complete
