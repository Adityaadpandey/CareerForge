import json
import logging
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.db.client import get_pool

logger = logging.getLogger(__name__)

LEETCODE_GQL = "https://leetcode.com/graphql"

LEETCODE_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "Origin": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

LEETCODE_TIMEOUT = httpx.Timeout(connect=15.0, read=30.0, write=10.0, pool=10.0)

PROFILE_QUERY = """
query userProfile($username: String!) {
  matchedUser(username: $username) {
    submitStats: submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    profile {
      ranking
    }
  }
  userContestRanking(username: $username) {
    rating
    attendedContestsCount
  }
}
"""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=15),
    retry=retry_if_exception_type((httpx.ConnectTimeout, httpx.ConnectError)),
    reraise=True,
)
async def _fetch_leetcode_profile(handle: str) -> dict:
    """Fetch LeetCode profile with retries on connection failures."""
    async with httpx.AsyncClient(timeout=LEETCODE_TIMEOUT) as client:
        res = await client.post(
            LEETCODE_GQL,
            json={"query": PROFILE_QUERY, "variables": {"username": handle}},
            headers=LEETCODE_HEADERS,
        )
        res.raise_for_status()
        return res.json().get("data", {})


async def ingest_leetcode(student_profile_id: str, handle: str) -> dict:
    pool = await get_pool()

    await pool.execute(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'SYNCING', "lastSyncedAt" = NOW()
        WHERE "studentProfileId" = $1 AND platform = 'LEETCODE'
        """,
        student_profile_id,
    )

    try:
        logger.info(f"Fetching LeetCode profile for {handle}")
        data = await _fetch_leetcode_profile(handle)

        matched = data.get("matchedUser") or {}
        submit_stats = matched.get("submitStats", {}).get("acSubmissionNum", [])

        counts = {s["difficulty"]: s["count"] for s in submit_stats}
        contest = data.get("userContestRanking") or {}

        parsed_data = {
            "total_solved": counts.get("All", 0),
            "easy_solved": counts.get("Easy", 0),
            "medium_solved": counts.get("Medium", 0),
            "hard_solved": counts.get("Hard", 0),
            "contest_rating": int(contest.get("rating", 0)) if contest.get("rating") else None,
            "contests_attended": contest.get("attendedContestsCount", 0),
            "global_ranking": matched.get("profile", {}).get("ranking"),
            "handle": handle,
        }

        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'DONE', "parsedData" = $2, "rawData" = $3, "lastSyncedAt" = NOW()
            WHERE "studentProfileId" = $1 AND platform = 'LEETCODE'
            """,
            student_profile_id,
            json.dumps(parsed_data),
            json.dumps(data),
        )

        return parsed_data

    except Exception as e:
        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'FAILED', "errorMessage" = $2
            WHERE "studentProfileId" = $1 AND platform = 'LEETCODE'
            """,
            student_profile_id,
            str(e),
        )
        raise
