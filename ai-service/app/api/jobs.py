import asyncio
import json
import httpx
from fastapi import APIRouter
from openai import AsyncOpenAI
from app.models.schemas import JobsFetchRequest, JobsApplyRequest
from app.db.client import get_pool
from app.config import settings

router = APIRouter(prefix="/jobs", tags=["jobs"])
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


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
        client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": cv_prompt}],
        ),
        client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": cl_prompt}],
        ),
    )

    return {
        "cv_markdown": cv_res.choices[0].message.content,
        "cover_letter": cl_res.choices[0].message.content,
        "match_score": 70,  # Static for now; embedding-based matching in V2
    }


