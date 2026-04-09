import json
import logging
from app.agents.github_agent import github_agent_graph
from app.agents.base import init_state
from app.db.client import get_pool

logger = logging.getLogger(__name__)


async def ingest_github(student_profile_id: str, username: str, sync_type: str = "DEEP") -> dict:
    """Run the deep GitHub analysis agent and return parsed data."""
    pool = await get_pool()

    # Guard: atomic check-and-set to SYNCING.
    # If the row is already SYNCING, another job is in progress — skip.
    row = await pool.fetchrow(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'SYNCING', "lastSyncedAt" = NOW()
        WHERE "studentProfileId" = $1
          AND platform = 'GITHUB'
          AND "syncStatus" != 'SYNCING'
        RETURNING id
        """,
        student_profile_id,
    )

    if row is None:
        logger.warning(
            f"[github] Skipping duplicate — already SYNCING for {student_profile_id}"
        )
        return {}

    try:
        logger.info(f"Starting deep GitHub analysis for {username}")

        result = await github_agent_graph.ainvoke(
            init_state(
                "github-agent",
                student_profile_id=student_profile_id,
                username=username,
                sync_type=sync_type,
                profile={},
                repos_deep=[],
                lang_totals={},
                code_samples=[],
                extracted_stack=[],
                contributions=[],
                commit_patterns={},
                workflow_analysis={},
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
