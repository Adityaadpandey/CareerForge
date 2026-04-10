import asyncio
import json
import httpx
from fastapi import APIRouter
from openai import AsyncOpenAI
from app.models.schemas import (
    JobsFetchRequest,
    JobsApplyRequest,
    JobsMatchRequest,
    JobsGenerateCvRequest,
    JobsGenerateCoverLetterRequest,
    JobsDescribeRequest,
    JobsSkillAnalysisRequest,
)
from app.db.client import get_pool
from app.config import settings

router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0)


@router.post("/fetch")
async def fetch_jobs(req: JobsFetchRequest):
    """Fetch jobs from JSearch API and store in DB."""
    pool = await get_pool()

    profile = await pool.fetchrow(
        'SELECT "targetRole", "dreamCompanies" FROM "StudentProfile" WHERE id = $1',
        req.student_profile_id,
    )
    if not profile:
        return {"status": "error", "message": "Profile not found"}

    target_role = profile["targetRole"] or "Software Engineer"

    if not settings.JSEARCH_API_KEY:
        return {"status": "skipped", "message": "JSEARCH_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=30) as http:
        res = await http.get(
            "https://jsearch.p.rapidapi.com/search",
            params={"query": target_role, "num_pages": "2", "country": "in"},
            headers={
                "X-RapidAPI-Key": settings.JSEARCH_API_KEY,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
        )
        data = res.json()

    jobs_inserted = 0
    for job in data.get("data", []):
        try:
            await pool.execute(
                """
                INSERT INTO "Job"
                  (id, "externalId", title, company, location, "isRemote", source,
                   "requirementsText", "requirementsTags", "applyUrl", "scrapedAt")
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'JSEARCH', $6, $7, $8, NOW())
                ON CONFLICT DO NOTHING
                """,
                job.get("job_id"),
                job.get("job_title", ""),
                job.get("employer_name", ""),
                job.get("job_city") or job.get("job_country", ""),
                job.get("job_is_remote", False),
                job.get("job_description", "")[:5000],
                job.get("job_required_skills") or [],
                job.get("job_apply_link", ""),
            )
            jobs_inserted += 1
        except Exception:
            continue

    return {"status": "done", "jobs_inserted": jobs_inserted}


@router.post("/apply")
async def apply_to_job(req: JobsApplyRequest):
    """Generate CV and cover letter for a job."""
    pool = await get_pool()

    profile = await pool.fetchrow(
        """
        SELECT sp."targetRole", sp."dreamCompanies",
               pc."parsedData" as github_data,
               lc."parsedData" as lc_data
        FROM "StudentProfile" sp
        LEFT JOIN "PlatformConnection" pc ON pc."studentProfileId" = sp.id AND pc.platform = 'GITHUB'
        LEFT JOIN "PlatformConnection" lc ON lc."studentProfileId" = sp.id AND lc.platform = 'LEETCODE'
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
    projects = gh.get("top_projects", [])

    cv_prompt = f"""
Generate a tailored CV in Markdown for a student applying to {job['title']} at {job['company']}.

Job requirements: {job['requirementsText'][:1000]}
Required skills: {job['requirementsTags']}

Student's top projects: {json.dumps(projects[:3])}
Target role: {profile['targetRole']}

Write a concise, ATS-optimized CV with:
- Professional summary (2 sentences, mirror JD language)
- Skills section (lead with most relevant)
- Projects section (3 projects, rewrite bullets to match JD keywords)
- Education placeholder

Format as clean Markdown.
"""

    cl_prompt = f"""
Write a 3-paragraph cover letter for {job['title']} at {job['company']}.

Paragraph 1: Hook — specific to {job['company']} and why this role excites the candidate
Paragraph 2: Relevant experience — reference 2 specific projects from: {json.dumps(projects[:2])}
Paragraph 3: Why {job['company']} specifically — research-backed reason

Keep it under 250 words. Professional but genuine tone.
"""

    cv_res, cl_res = await asyncio.gather(
        get_client().chat.completions.create(
            model="gpt-5.4-mini-2026-03-17",
            messages=[{"role": "user", "content": cv_prompt}],
        ),
        get_client().chat.completions.create(
            model="gpt-5.4-mini-2026-03-17",
            messages=[{"role": "user", "content": cl_prompt}],
        ),
    )

    return {
        "cv_markdown": cv_res.choices[0].message.content,
        "cover_letter": cl_res.choices[0].message.content,
        "match_score": 70,  # Static for now; embedding-based matching in V2
    }


@router.post("/match")
async def match_jobs(req: JobsMatchRequest):
    """Compute match scores for a list of job IDs against a student profile."""
    pool = await get_pool()

    profile = await pool.fetchrow(
        """
        SELECT sp."targetRole",
               pc."parsedData" as github_data,
               rs."weakTopics"
        FROM "StudentProfile" sp
        LEFT JOIN "PlatformConnection" pc ON pc."studentProfileId" = sp.id AND pc.platform = 'GITHUB'
        LEFT JOIN "ReadinessScore" rs ON rs."studentProfileId" = sp.id
        WHERE sp.id = $1
        ORDER BY rs."createdAt" DESC
        LIMIT 1
        """,
        req.student_profile_id,
    )

    if not profile:
        return {"status": "error", "message": "Profile not found"}

    target_role = profile["targetRole"] or "Software Engineer"
    gh = json.loads(profile["github_data"] or "{}")
    skills = list(gh.get("primary_languages", {}).keys())[:10]

    for job_id in req.job_ids:
        job = await pool.fetchrow(
            'SELECT title, "requirementsTags" FROM "Job" WHERE id = $1',
            job_id,
        )
        if not job:
            continue

        req_tags = job["requirementsTags"] or []
        matched = [s for s in skills if any(s.lower() in t.lower() for t in req_tags)]
        score = min(100, int((len(matched) / max(len(req_tags), 1)) * 100) + 20)

        await pool.execute(
            'UPDATE "JobApplication" SET "matchScore" = $1 WHERE "jobId" = $2 AND "studentProfileId" = $3',
            float(score),
            job_id,
            req.student_profile_id,
        )

    return {"status": "done", "matched": len(req.job_ids)}


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
    github_projects = gh.get("top_projects", [])
    languages = list(gh.get("primary_languages", {}).keys())
    lc_solved = lc.get("total_solved", 0)

    # Fetch manually added projects from Project table
    manual_projects = await pool.fetch(
        'SELECT name, description, "techStack", "liveUrl", "repoUrl" FROM "Project" WHERE "studentProfileId" = $1 ORDER BY "createdAt" DESC',
        req.student_profile_id,
    )
    manual_projects_list = [
        {
            "name": p["name"],
            "description": p["description"],
            "tech": p["techStack"] or [],
            "liveUrl": p["liveUrl"],
            "repoUrl": p["repoUrl"],
        }
        for p in manual_projects
    ]

    # Merge: manual projects take priority, then GitHub projects as fallback
    all_projects_for_ai = manual_projects_list if manual_projects_list else [
        {"name": p.get("name", ""), "description": p.get("description", ""), "tech": p.get("languages", [])}
        for p in github_projects[:5]
    ]

    prompt = f"""
You are generating a structured CV for a student. Return ONLY valid JSON with no extra text.

Required JSON schema:
{{
  "name": "student full name",
  "email": "student email",
  "phone": "+91 XXXXXXXXXX",
  "linkedin": "linkedin profile url",
  "github": "github profile url",
  "summary": "exactly 2 sentences, ATS-optimized, mirror job description language",
  "skills": {{
    "languages": ["list of programming languages"],
    "frameworks": ["list of frameworks and libraries"],
    "tools": ["list of tools, databases, and platforms"]
  }},
  "projects": [
    {{
      "name": "project name",
      "tech": ["tech1", "tech2"],
      "bullets": ["action verb + specific achievement + measurable outcome"]
    }}
  ],
  "education": {{
    "degree": "degree name",
    "institution": "university name",
    "year": "graduation year"
  }}
}}

Fill in known values:
- name: {profile['student_name'] or 'Your Name'}
- email: {profile['student_email'] or 'email@example.com'}
- linkedin: {profile['linkedinUrl'] or 'linkedin.com/in/username'}
- github: github.com/{profile['githubUsername'] or 'username'}
- degree: {profile['department'] or 'B.Tech Computer Science'}
- institution: {profile['university_name'] or 'University Name'}
- graduation year: {profile['graduationYear'] or '2026'}

Job: {job['title']} at {job['company']}
Job requirements: {job['requirementsText'][:800]}
Required skills: {job['requirementsTags']}

Student's project pool (select the 3 most relevant to this job):
{json.dumps(all_projects_for_ai, indent=2)}

Known programming languages: {languages}
LeetCode problems solved: {lc_solved}

Rules:
- SELECT exactly 3 projects from the pool above that best match the job requirements and tech stack
- Rewrite project bullets to use JD keywords and strong action verbs
- Each project needs 2-3 bullets starting with strong action verbs
- Skills grouped by category, no duplicates across groups
- Summary must mirror JD language and mention the target role
- Return ONLY the JSON object, no markdown fences, no explanation
"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    cv_data = json.loads(res.choices[0].message.content)
    return cv_data


@router.post("/generate-cover-letter")
async def generate_cover_letter(req: JobsGenerateCoverLetterRequest):
    """Generate a structured cover letter as JSON."""
    pool = await get_pool()

    profile = await pool.fetchrow(
        """
        SELECT sp."targetRole",
               u.name AS student_name, u.email AS student_email,
               pc."parsedData" AS github_data
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

    if not profile or not job:
        return {"status": "error", "message": "Not found"}

    gh = json.loads(profile["github_data"] or "{}")
    projects = gh.get("top_projects", [])

    prompt = f"""
You are generating a cover letter for a student. Return ONLY valid JSON with no extra text.

Required JSON schema:
{{
  "name": "student full name",
  "email": "student email",
  "phone": "+91 XXXXXXXXXX",
  "company": "{job['company']}",
  "role": "{job['title']}",
  "greeting": "Dear Hiring Manager,",
  "paragraphs": [
    "Hook paragraph (2-3 sentences): why THIS company and THIS role",
    "Experience paragraph (3-4 sentences): 2 specific projects with measurable outcomes",
    "Why company paragraph (2-3 sentences): research-backed, under 70 words"
  ],
  "closing": "Sincerely,"
}}

Fill in known values:
- name: {profile['student_name'] or 'Your Name'}
- email: {profile['student_email'] or 'email@example.com'}

Job: {job['title']} at {job['company']}
Job requirements: {job['requirementsText'][:600]}
Student projects: {json.dumps(projects[:2])}

Rules:
- Total word count under 280 words (all 3 paragraphs combined)
- Professional but genuine tone, avoid clichés like "I am excited to apply"
- Each paragraph is a single string with no internal line breaks
- Return ONLY the JSON object, no markdown fences, no explanation
"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    cl_data = json.loads(res.choices[0].message.content)
    return cl_data


@router.post("/describe")
async def describe_job(req: JobsDescribeRequest):
    """Extract clean job description text from raw HTML."""
    html_snippet = req.html[:8000]

    prompt = f"""Extract only the job description text from the following HTML page.
Remove all navigation, headers, footers, ads, cookie notices, and boilerplate.
Return only the actual job posting content: role overview, responsibilities, requirements, and qualifications.
Keep the text clean and readable. Do not add commentary or formatting — just the extracted text.

HTML:
{html_snippet}"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
    )

    return {"description": res.choices[0].message.content.strip()}


@router.post("/skill-analysis")
async def skill_analysis(req: JobsSkillAnalysisRequest):
    """Analyse student skills against job requirements."""
    student_skills: list[str] = []
    for conn in req.platform_data:
        data = conn.get("data") or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
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

    student_skills = list(dict.fromkeys(s.strip() for s in student_skills if s.strip()))

    weak_topics: list[str] = []
    if req.gap_analysis:
        weak_topics = req.gap_analysis.get("weak_topics") or []

    prompt = f"""You are a career advisor analysing a student's skills against job requirements.
Return ONLY valid JSON with no extra text.

Required JSON schema:
{{
  "matched": ["skills from requirement_tags that the student has"],
  "gaps": ["skills from requirement_tags that the student is missing"],
  "suggestions": ["1-2 sentence actionable suggestion for each gap skill, same order as gaps"]
}}

Job required skills: {req.requirement_tags}
Student known skills: {student_skills}
Student weak topics: {weak_topics}

Rules:
- matched: only skills appearing in BOTH requirement_tags AND student skills (case-insensitive)
- gaps: requirement_tags skills the student does not have
- suggestions: one entry per gap skill, same order, concrete and actionable
- Return ONLY the JSON object, no markdown fences"""

    res = await get_client().chat.completions.create(
        model="gpt-5.4-mini-2026-03-17",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    return json.loads(res.choices[0].message.content)
