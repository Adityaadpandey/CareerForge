"""LinkedIn ingestion: scrape public profile page with httpx, parse with GPT-4o."""
import json
import logging
import httpx
from openai import AsyncOpenAI
from app.db.client import get_pool
from app.config import settings

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0)


async def _scrape_linkedin_page(url: str) -> str:
    """
    Attempt to fetch the LinkedIn profile page HTML.
    LinkedIn heavily blocks scrapers — we do a best-effort fetch.
    If blocked (403/999), return empty string and let LLM handle gracefully.
    """
    # Normalize URL
    if not url.startswith("http"):
        url = "https://" + url
    # Strip trailing slash and query params
    url = url.split("?")[0].rstrip("/")
    # Ensure it's the public-facing URL
    if not url.startswith("https://www.linkedin.com"):
        url = url.replace("https://linkedin.com", "https://www.linkedin.com")

    try:
        async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url)
            logger.info(f"[linkedin] GET {url} → {resp.status_code}")
            if resp.status_code in (200, 201):
                # Strip HTML tags to get readable text (rough extraction)
                import re
                text = resp.text
                # Remove script/style blocks
                text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL)
                text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL)
                # Remove all remaining tags
                text = re.sub(r"<[^>]+>", " ", text)
                # Collapse whitespace
                text = re.sub(r"\s+", " ", text).strip()
                return text[:6000]
            else:
                logger.warning(f"[linkedin] Scrape blocked ({resp.status_code}) for {url}")
                return ""
    except Exception as e:
        logger.warning(f"[linkedin] Scrape error for {url}: {e}")
        return ""


async def ingest_linkedin(student_profile_id: str, linkedin_url: str) -> dict:
    """Parse LinkedIn profile URL and store structured data."""
    pool = await get_pool()

    await pool.execute(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'SYNCING', "lastSyncedAt" = NOW()
        WHERE "studentProfileId" = $1 AND platform = 'LINKEDIN'
        """,
        student_profile_id,
    )

    try:
        logger.info(f"[linkedin] Scraping {linkedin_url} for {student_profile_id}")
        page_text = await _scrape_linkedin_page(linkedin_url)

        if page_text:
            logger.info(f"[linkedin] Scraped {len(page_text)} chars")
        else:
            logger.warning(f"[linkedin] No page text — LLM will parse URL metadata only")

        prompt = f"""You are a LinkedIn profile parser.

Profile URL: {linkedin_url}
Page content (may be empty if LinkedIn blocked the scraper):
---
{page_text or "(blocked — infer from URL only)"}
---

Extract structured information from the LinkedIn profile. If you cannot extract a field, set it to null.

Return ONLY valid JSON:
{{
  "name": "full name or null",
  "headline": "professional headline or null",
  "location": "city, country or null",
  "summary": "about/summary section or null",
  "current_role": "current job title or null",
  "current_company": "current company or null",
  "total_experience_years": 0,
  "skills": ["skill1", "skill2"],
  "experience": [
    {{
      "title": "Software Engineer",
      "company": "Company Name",
      "duration": "Jan 2023 – Present",
      "months": 12,
      "description": "key responsibilities"
    }}
  ],
  "education": [
    {{
      "degree": "B.Tech Computer Science",
      "institution": "University Name",
      "year": "2025"
    }}
  ],
  "certifications": ["AWS Certified"],
  "languages": ["English", "Hindi"],
  "open_to_work": false,
  "connections_500_plus": false,
  "profile_completeness": 1
}}

For profile_completeness, rate 1-10: how complete/professional the profile looks.
"""

        res = await _get_client().chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        parsed_data = json.loads(res.choices[0].message.content or "{}")
        parsed_data["source_url"] = linkedin_url
        logger.info(f"[linkedin] Parsed for {student_profile_id}: role={parsed_data.get('current_role')}")

        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'DONE', "parsedData" = $2, "rawData" = $3, "lastSyncedAt" = NOW()
            WHERE "studentProfileId" = $1 AND platform = 'LINKEDIN'
            """,
            student_profile_id,
            json.dumps(parsed_data),
            json.dumps({"scraped_chars": len(page_text), "url": linkedin_url}),
        )

        # Also update the student profile with LinkedIn URL if not set
        await pool.execute(
            'UPDATE "StudentProfile" SET "linkedinUrl" = $2 WHERE id = $1 AND "linkedinUrl" IS NULL',
            student_profile_id,
            linkedin_url,
        )

        return parsed_data

    except Exception as e:
        logger.error(f"[linkedin] Failed for {student_profile_id}: {e}")
        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'FAILED', "errorMessage" = $2
            WHERE "studentProfileId" = $1 AND platform = 'LINKEDIN'
            """,
            student_profile_id,
            str(e)[:500],
        )
        raise
