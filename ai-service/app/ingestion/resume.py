"""Resume ingestion: extract text with pdfplumber, structure with gpt-5.4."""
import io
import json
import base64
import logging
from openai import AsyncOpenAI
from app.db.client import get_pool
from app.config import settings

logger = logging.getLogger(__name__)


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0)


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from PDF bytes using pdfplumber."""
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t.strip())
    return "\n\n".join(text_parts)


async def ingest_resume(student_profile_id: str, pdf_bytes: bytes) -> dict:
    """Parse resume PDF and store structured data in platform connection."""
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'SYNCING', "lastSyncedAt" = NOW()
        WHERE "studentProfileId" = $1
          AND platform = 'RESUME'
          AND "syncStatus" != 'SYNCING'
        RETURNING id
        """,
        student_profile_id,
    )
    if row is None:
        logger.warning(f"[resume] Skipping duplicate — already SYNCING for {student_profile_id}")
        return {}

    try:
        logger.info(f"[resume] Extracting text for {student_profile_id}")
        raw_text = _extract_text_from_pdf(pdf_bytes)

        if not raw_text.strip():
            raise ValueError("No text extracted from PDF — possibly a scanned/image PDF")

        # Truncate to avoid token limits (keep most relevant content)
        text_for_llm = raw_text[:8000]

        logger.info(f"[resume] Extracted {len(raw_text)} chars, sending to gpt-5.4")

        prompt = f"""You are a resume parser. Extract structured information from this resume text.

Resume text:
---
{text_for_llm}
---

Return ONLY valid JSON with this structure:
{{
  "name": "full name or null",
  "email": "email or null",
  "phone": "phone or null",
  "location": "city, country or null",
  "summary": "professional summary or objective in 2-3 sentences",
  "total_experience_years": 0,
  "current_role": "most recent job title or null",
  "current_company": "most recent company or null",
  "skills": ["skill1", "skill2"],
  "programming_languages": ["Python", "JavaScript"],
  "frameworks": ["React", "FastAPI"],
  "tools": ["Git", "Docker"],
  "education": [
    {{
      "degree": "B.Tech Computer Science",
      "institution": "University Name",
      "year": "2025",
      "gpa": "8.5/10 or null"
    }}
  ],
  "experience": [
    {{
      "title": "Software Engineer Intern",
      "company": "Company Name",
      "duration": "Jun 2024 – Aug 2024",
      "months": 3,
      "highlights": ["Built X", "Improved Y by Z%"]
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "description": "What it does and tech used",
      "tech_stack": ["React", "Node.js"],
      "impact": "outcome or metric"
    }}
  ],
  "certifications": ["AWS Certified", "GCP Associate"],
  "achievements": ["Winner of X hackathon", "Top 10 in Y contest"],
  "has_open_source": false,
  "communication_quality": 1
}}

For communication_quality, rate 1-10 based on: clarity of writing, use of metrics/numbers,
professional language, action verbs, and quantified achievements.
"""

        res = await _get_client().chat.completions.create(
            model="gpt-5.4-mini-2026-03-17",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        parsed_data = json.loads(res.choices[0].message.content or "{}")
        logger.info(f"[resume] Parsed {len(parsed_data.get('skills', []))} skills for {student_profile_id}")

        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'DONE', "parsedData" = $2, "rawData" = $3, "lastSyncedAt" = NOW()
            WHERE "studentProfileId" = $1 AND platform = 'RESUME'
            """,
            student_profile_id,
            json.dumps(parsed_data),
            json.dumps({"text_length": len(raw_text), "pages": raw_text.count("\n\n") + 1}),
        )

        return parsed_data

    except Exception as e:
        logger.error(f"[resume] Failed for {student_profile_id}: {e}")
        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'FAILED', "errorMessage" = $2
            WHERE "studentProfileId" = $1 AND platform = 'RESUME'
            """,
            student_profile_id,
            str(e)[:500],
        )
        raise
