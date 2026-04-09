import base64
import logging
from fastapi import APIRouter, BackgroundTasks
from app.models.schemas import (
    IngestGithubRequest, IngestLeetcodeRequest,
    IngestResumeRequest, IngestLinkedInRequest,
)
from app.ingestion.github import ingest_github
from app.ingestion.leetcode import ingest_leetcode
from app.ingestion.resume import ingest_resume
from app.ingestion.linkedin import ingest_linkedin
from app.db.client import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingestion"])


async def _run_analysis_pipeline(student_profile_id: str) -> None:
    """Check if all platform connections are settled; if so, run gap → roadmap."""
    logger.info(f"[pipeline] Triggered for {student_profile_id}")
    try:
        await _do_pipeline(student_profile_id)
    except Exception as e:
        logger.error(f"[pipeline] Uncaught error for {student_profile_id}: {e}", exc_info=True)


async def _do_pipeline(student_profile_id: str) -> None:
    # Import here to avoid circular imports at module level
    from app.agents.gap_analyzer import gap_analyzer_graph
    from app.agents.roadmap_agent import roadmap_agent_graph

    pool = await get_pool()
    connections = await pool.fetch(
        'SELECT "syncStatus" FROM "PlatformConnection" WHERE "studentProfileId" = $1',
        student_profile_id,
    )
    if not connections:
        logger.warning(f"[pipeline] No connections found for {student_profile_id}")
        return

    statuses = [c["syncStatus"] for c in connections]
    logger.info(f"[pipeline] Connection statuses for {student_profile_id}: {statuses}")

    # PENDING = never started (user never connected that platform) — ignore these.
    # SYNCING = actively in progress — must wait.
    # Only require DONE/FAILED for connections that were actually attempted.
    active_statuses = [s for s in statuses if s != "PENDING"]
    if not active_statuses:
        logger.warning(f"[pipeline] No active connections for {student_profile_id}, skipping")
        return

    all_settled = all(s in ("DONE", "FAILED") for s in active_statuses)
    if not all_settled:
        logger.info(f"[pipeline] Still syncing for {student_profile_id} (active: {active_statuses}), skipping")
        return

    # Deduplication: skip only if score was computed in the last 30s (prevents
    # BullMQ + BackgroundTask double-firing) OR if no platform data is newer than
    # the last score (nothing changed since last analysis).
    last_score = await pool.fetchrow(
        '''SELECT id, "createdAt" FROM "ReadinessScore"
           WHERE "studentProfileId" = $1
           ORDER BY "createdAt" DESC LIMIT 1''',
        student_profile_id,
    )
    if last_score:
        # Hard dedup: prevent race conditions from simultaneous triggers
        just_ran = await pool.fetchrow(
            '''SELECT id FROM "ReadinessScore"
               WHERE "studentProfileId" = $1
               AND "createdAt" > NOW() - INTERVAL '30 seconds'
               LIMIT 1''',
            student_profile_id,
        )
        if just_ran:
            logger.info(f"[pipeline] Score computed in last 30s, skipping (dedup)")
            return

        # Skip if no platform has new data since the last score
        new_data = await pool.fetchrow(
            '''SELECT id FROM "PlatformConnection"
               WHERE "studentProfileId" = $1
               AND "syncStatus" = 'DONE'
               AND "lastSyncedAt" > $2''',
            student_profile_id,
            last_score["createdAt"],
        )
        if not new_data:
            logger.info(f"[pipeline] No new platform data since last score, skipping")
            return
        logger.info(f"[pipeline] New platform data detected since last score — re-running analysis")

    logger.info(f"[pipeline] Running gap analysis for {student_profile_id}")
    try:
        from app.agents.base import init_state
        await gap_analyzer_graph.ainvoke(
            init_state("gap-analyzer", student_profile_id=student_profile_id)
        )
        logger.info(f"[pipeline] Gap done for {student_profile_id}")
        logger.info(f"[pipeline] Gap done for {student_profile_id}")
    except Exception as e:
        logger.error(f"[pipeline] Gap analysis failed for {student_profile_id}: {e}", exc_info=True)
        return

    try:
        logger.info(f"[pipeline] Running roadmap for {student_profile_id}")
        await roadmap_agent_graph.ainvoke(
            init_state("roadmap-agent", student_profile_id=student_profile_id)
        )
        logger.info(f"[pipeline] Roadmap done for {student_profile_id}")
    except Exception as e:
        logger.error(f"[pipeline] Roadmap failed for {student_profile_id}: {e}", exc_info=True)

    # Best-effort job fetch after roadmap
    try:
        from app.api.jobs import fetch_jobs
        from app.models.schemas import JobsFetchRequest
        await fetch_jobs(JobsFetchRequest(student_profile_id=student_profile_id))
        logger.info(f"[pipeline] Jobs fetched for {student_profile_id}")
    except Exception as e:
        logger.warning(f"[pipeline] Jobs fetch failed (non-fatal) for {student_profile_id}: {e}")


@router.post("/github")
async def ingest_github_endpoint(req: IngestGithubRequest, background_tasks: BackgroundTasks):
    result = await ingest_github(req.student_profile_id, req.username, req.sync_type)
    # BackgroundTasks runs AFTER the response is sent, managed by Starlette (more reliable than create_task)
    
    # We only run the full analysis pipeline if it's a DEEP sync. 
    # For SHALLOW sync, we defer the analysis until the backend finishes the DEEP sync.
    if req.sync_type == "DEEP":
        background_tasks.add_task(_run_analysis_pipeline, req.student_profile_id)
        
    return {"status": "done", "data": result}


@router.post("/leetcode")
async def ingest_leetcode_endpoint(req: IngestLeetcodeRequest, background_tasks: BackgroundTasks):
    result = await ingest_leetcode(req.student_profile_id, req.handle)
    background_tasks.add_task(_run_analysis_pipeline, req.student_profile_id)
    return {"status": "done", "data": result}


@router.post("/resume")
async def ingest_resume_endpoint(req: IngestResumeRequest, background_tasks: BackgroundTasks):
    """Accept base64-encoded PDF, parse with pdfplumber + gpt-5.4."""
    pdf_bytes = base64.b64decode(req.pdf_b64)
    result = await ingest_resume(req.student_profile_id, pdf_bytes)
    background_tasks.add_task(_run_analysis_pipeline, req.student_profile_id)
    return {"status": "done", "data": result}


@router.post("/linkedin")
async def ingest_linkedin_endpoint(req: IngestLinkedInRequest, background_tasks: BackgroundTasks):
    """Parse LinkedIn profile from OAuth data (primary) and/or page scrape (supplemental)."""
    result = await ingest_linkedin(
        req.student_profile_id,
        oauth_data=req.oauth_data,
        linkedin_url=req.linkedin_url,
    )
    background_tasks.add_task(_run_analysis_pipeline, req.student_profile_id)
    return {"status": "done", "data": result}
