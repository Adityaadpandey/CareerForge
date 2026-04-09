import json
import httpx
from app.db.client import get_pool

LEETCODE_GQL = "https://leetcode.com/graphql"

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
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                LEETCODE_GQL,
                json={"query": PROFILE_QUERY, "variables": {"username": handle}},
                headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
            )
            data = res.json().get("data", {})

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
