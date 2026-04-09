"""LinkedIn ingestion: OAuth data (primary) + optional page scrape (supplemental)."""
import json
import logging
import httpx
import re
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
    Best-effort HTML scrape of a LinkedIn profile page and recent activity.
    LinkedIn blocks most scrapers — we try anyway and handle gracefully.
    """
    if not url:
        return ""
    if not url.startswith("http"):
        url = "https://" + url
    url = url.split("?")[0].rstrip("/")
    if "www.linkedin.com" not in url:
        url = url.replace("https://linkedin.com", "https://www.linkedin.com")

    activity_url = f"{url}/recent-activity/all/"
    combined_text = ""

    async def fetch_url(client: httpx.AsyncClient, target_url: str) -> str:
        try:
            resp = await client.get(target_url)
            logger.info(f"[linkedin] GET {target_url} → {resp.status_code}")
            if resp.status_code in (200, 201):
                text = resp.text
                text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL)
                text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                return text[:6000]
            else:
                logger.warning(f"[linkedin] Scrape blocked ({resp.status_code}) for {target_url}")
                return ""
        except Exception as e:
            logger.warning(f"[linkedin] Scrape error for {target_url}: {e}")
            return ""

    try:
        async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=15.0) as client:
            main_text = await fetch_url(client, url)
            activity_text = await fetch_url(client, activity_url)

            if main_text:
                combined_text += f"--- MAIN PROFILE ---\n{main_text}\n"
            if activity_text:
                combined_text += f"\n--- RECENT ACTIVITY ---\n{activity_text}\n"

            return combined_text
    except Exception as e:
        logger.warning(f"[linkedin] Scrape client error: {e}")
        return ""


async def ingest_linkedin(
    student_profile_id: str,
    oauth_data: dict | None = None,
    linkedin_url: str | None = None,
) -> dict:
    """
    Parse LinkedIn profile and store structured data.

    Priority order:
    1. oauth_data   — verified data from LinkedIn OAuth + /v2/me API (best quality)
    2. linkedin_url — supplemental scrape to fill in what OAuth doesn't provide
    3. gpt-5.4       — synthesizes everything into a structured profile
    """
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
        # ── Step 1: Build OAuth context ─────────────────────────────────────
        oauth_context = ""
        effective_url = linkedin_url or ""
        if oauth_data:
            name = oauth_data.get("name", "")
            email = oauth_data.get("email", "")
            headline = oauth_data.get("headline", "")
            vanity_name = oauth_data.get("vanityName", "")

            if vanity_name and not effective_url:
                effective_url = f"https://www.linkedin.com/in/{vanity_name}"

            oauth_context = f"""Verified OAuth data (authoritative — user authenticated with LinkedIn):
- Name: {name}
- Email: {email}
- Professional Headline: {headline or "(not available — OIDC scope only)"}
- LinkedIn URL: {effective_url or "(vanity name not available)"}
- LinkedIn Member ID: {oauth_data.get("sub", "")}
"""
            logger.info(
                f"[linkedin] OAuth data for {student_profile_id}: "
                f"name={name!r} headline={headline!r} vanity={vanity_name!r}"
            )
        else:
            logger.info(f"[linkedin] No OAuth data — using URL scrape only")

        # ── Step 2: Supplemental scrape ─────────────────────────────────────
        page_text = ""
        if effective_url:
            page_text = await _scrape_linkedin_page(effective_url)
            if page_text:
                logger.info(f"[linkedin] Scraped {len(page_text)} chars from {effective_url}")
            else:
                logger.info(f"[linkedin] Scrape returned nothing (likely blocked)")

        # ── Step 3: gpt-5.4 synthesis ────────────────────────────────────────
        prompt = f"""You are a LinkedIn profile parser. Extract structured career information.

{oauth_context}
{"Profile page content (supplemental — may be partial or empty if LinkedIn blocked the scraper):" if page_text else "Note: LinkedIn page scraping was blocked or skipped. Use OAuth data above."}
{"---" if page_text else ""}
{page_text if page_text else ""}
{"---" if page_text else ""}

Instructions:
- The OAuth data is AUTHORITATIVE — trust it over any scraped content.
- Use scraped content to fill in what OAuth cannot provide: experience, education, skills, projects.
- If a field cannot be determined, set it to null or an empty list.

Return ONLY valid JSON:
{{
  "name": "full name",
  "headline": "professional headline or null",
  "location": "city, country or null",
  "summary": "about/summary section or null",
  "current_role": "current job title or null",
  "current_company": "current company or null",
  "total_experience_years": 0,
  "skills": ["skill1", "skill2"],
  "recent_posts": ["summary of post 1", "summary of post 2"],
  "thought_leadership_score": 5,
  "network_engagement_tier": "Passive",
  "experience": [
    {{
      "title": "Software Engineer",
      "company": "Company Name",
      "duration": "Jan 2023 – Present",
      "months": 12,
      "description": "key responsibilities"
    }}gpt-5.4-mini-2026-03-17
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
  "profile_completeness": 1,
  "data_source": "oauth_only"
}}

For data_source, use: "oauth_and_scrape" if you had both, "oauth_only" if only OAuth data, "scrape_only" if only scraped.
For profile_completeness, rate 1-10 based on how complete the profile information is.
For network_engagement_tier, use "Passive" (no posts), "Active" (some posts/shares), or "Creator" (frequent original content).
For thought_leadership_score, rate 1-10 based on the quality and professionalism of their recent posts (if available).
"""

        res = await _get_client().chat.completions.create(
            model="gpt-5.4-mini-2026-03-17",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        parsed_data = json.loads(res.choices[0].message.content or "{}")

        # Embed verified OAuth fields so gap analyzer can trust them
        if oauth_data:
            parsed_data["_oauth_verified"] = {
                "name": oauth_data.get("name"),
                "email": oauth_data.get("email"),
                "headline": oauth_data.get("headline"),
                "vanity_name": oauth_data.get("vanityName"),
                "sub": oauth_data.get("sub"),
                "picture": oauth_data.get("picture"),
            }

        if effective_url:
            parsed_data["source_url"] = effective_url

        logger.info(
            f"[linkedin] Parsed for {student_profile_id}: "
            f"role={parsed_data.get('current_role')} source={parsed_data.get('data_source')}"
        )

        raw_meta = {
            "had_oauth": bool(oauth_data),
            "scraped_chars": len(page_text),
            "url": effective_url,
        }

        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'DONE', "parsedData" = $2, "rawData" = $3, "lastSyncedAt" = NOW()
            WHERE "studentProfileId" = $1 AND platform = 'LINKEDIN'
            """,
            student_profile_id,
            json.dumps(parsed_data),
            json.dumps(raw_meta),
        )

        # Update LinkedIn URL on student profile if we resolved one
        if effective_url:
            await pool.execute(
                'UPDATE "StudentProfile" SET "linkedinUrl" = $2 WHERE id = $1 AND "linkedinUrl" IS NULL',
                student_profile_id,
                effective_url,
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
