import json
import logging
from app.agents.github_agent import github_agent_graph
from app.agents.base import init_state
from app.db.client import get_pool

logger = logging.getLogger(__name__)


async def ingest_github(student_profile_id: str, username: str) -> dict:
    """Run the deep GitHub analysis agent and return parsed data."""
    pool = await get_pool()

    # Mark as syncing
    await pool.execute(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'SYNCING', "lastSyncedAt" = NOW()
        WHERE "studentProfileId" = $1 AND platform = 'GITHUB'
        """,
        student_profile_id,
    )

    try:
        logger.info(f"Starting deep GitHub analysis for {username}")

        result = await github_agent_graph.ainvoke(
            init_state(
                "github-agent",
                student_profile_id=student_profile_id,
                username=username,
                profile={},
                repos_deep=[],
                lang_totals={},
                code_samples=[],
                contributions=[],
                commit_patterns={},
                code_quality={},
                synthesis={},
                final_parsed={},
                _github=None,
            )
        )

        # Log execution summary
        trace = result.get("_trace", [])
        total_time = sum(t.get("elapsed_s", 0) for t in trace)
        failed = [t["node"] for t in trace if t.get("status") == "error"]
        logger.info(
            f"GitHub analysis complete for {username} — "
            f"{len(trace)} nodes in {total_time:.1f}s"
            f"{f', failed: {failed}' if failed else ''}"
        )

        return result.get("final_parsed", {})

    except Exception as e:
        logger.error(f"GitHub analysis failed for {username}: {e}", exc_info=True)
        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'FAILED', "errorMessage" = $2
            WHERE "studentProfileId" = $1 AND platform = 'GITHUB'
            """,
            student_profile_id,
            str(e)[:500],
        )
        raise
