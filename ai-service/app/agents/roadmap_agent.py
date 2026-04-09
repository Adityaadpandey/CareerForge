"""Roadmap Generator Agent — produces personalized learning missions.

Architecture:
  load_gaps ──→ generate_missions ──→ set_deadlines ──→ attach_resources ──→ write_missions
                                                            │
                                                            ▼
                                                           END

Design:
- load_gaps, write_missions are CRITICAL
- generate_missions is CRITICAL (no missions = no roadmap)
- set_deadlines is CRITICAL (deadlines are essential for scheduling)
- attach_resources is NON-CRITICAL (missions work without curated links)
- Resources fetched in parallel via Gemini (with per-mission error isolation)
"""
import json
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.db.client import get_pool
from app.agents.base import agent_node, llm_json, gemini_json, init_state

logger = logging.getLogger(__name__)


# ─── STATE ──────────────────────────────────────────────────────

class RoadmapState(TypedDict):
    student_profile_id: str
    _agent_name: str
    _trace: list[dict]
    _started_at: float
    gaps: list[dict]
    profile_meta: dict
    missions: list[dict]


def _parse_deadline_for_db(deadline: str | None) -> datetime | None:
    """Normalize ISO deadline to a naive UTC datetime for TIMESTAMP columns."""
    if not deadline:
        return None

    dt = datetime.fromisoformat(deadline)
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# ─── NODE 1: LOAD GAPS (critical) ──────────────────────────────

@agent_node("load_gaps", critical=True)
async def load_gaps(state: RoadmapState) -> RoadmapState:
    """Load gap analysis and student preferences from DB."""
    pool = await get_pool()

    score_row = await pool.fetchrow(
        """
        SELECT "gapAnalysis", "weakTopics"
        FROM "ReadinessScore"
        WHERE "studentProfileId" = $1
        ORDER BY "createdAt" DESC LIMIT 1
        """,
        state["student_profile_id"],
    )

    profile_row = await pool.fetchrow(
        'SELECT "targetRole", "dreamCompanies", "timelineWeeks", "hoursPerWeek" FROM "StudentProfile" WHERE id = $1',
        state["student_profile_id"],
    )

    gaps = []
    if score_row:
        gap_data = json.loads(score_row["gapAnalysis"] or "{}")
        gaps = gap_data.get("missing", [])

    return {
        **state,
        "gaps": gaps,
        "profile_meta": dict(profile_row) if profile_row else {},
    }


# ─── NODE 2: GENERATE MISSIONS (critical) ──────────────────────

@agent_node("generate_missions", critical=True)
async def generate_missions(state: RoadmapState) -> RoadmapState:
    """LLM generates concrete, deliverable-oriented missions from gaps."""
    meta = state["profile_meta"]
    gaps = state["gaps"]
    target_role = meta.get("targetRole", "SDE")
    weeks = meta.get("timelineWeeks", 12)
    hours = meta.get("hoursPerWeek", 10)

    top_gaps = sorted(gaps, key=lambda g: g.get("importance", 0), reverse=True)[:6]
    n_missions = min(len(top_gaps) + 2, 8)

    result = await llm_json(
        prompt=f"""You are a senior career coach. Generate {n_missions} concrete missions for a student targeting {target_role}.

Skill gaps to address: {json.dumps(top_gaps)}
Timeline: {weeks} weeks, {hours} hrs/week available

Rules:
- Each mission must be a professional-grade DELIVERABLE (e.g. build an auth service, implement a custom orchestrator, write an architecture RFC). NEVER suggest "doing a tutorial" or "reading a book" as a mission.
- Avoid beginner/junior terminology. Act as a Staff Engineer assigning concrete technical tickets to an engineer.
- Mix of BUILD (project), SOLVE (algorithm/system design), COMMUNICATE (tech spec/RFC) types
- Order from foundational to advanced
- Must be completable in 5-25 hours each

Return JSON:
{{
  "missions": [gpt-5.4-mini-2026-03-17
    {{
      "type": "BUILD|SOLVE|COMMUNICATE",
      "title": "...",
      "description": "2-3 specific sentences about what to build/do and why",
      "estimated_hours": 10,
      "success_criteria": "specific measurable outcome",
      "order_index": 1
    }}
  ]
}}""",
        model="gpt-5.4-mini-2026-03-17",
        temperature=0.5,
        fallback={"missions": []},
        label="roadmap/missions",
    )

    missions = result.get("missions", [])
    if not missions:
        logger.warning("[roadmap] LLM returned no missions — generating defaults")
        missions = [
            {"type": "SOLVE", "title": f"DSA Practice: {target_role} Essentials",
             "description": "Solve 30 medium-level problems on arrays, strings, and graphs.",
             "estimated_hours": 15, "success_criteria": "30 problems solved", "order_index": 1},
            {"type": "BUILD", "title": f"Portfolio Project for {target_role}",
             "description": "Build a production-quality project demonstrating core skills for the target role.",
             "estimated_hours": 20, "success_criteria": "Deployed project with README", "order_index": 2},
        ]

    return {**state, "missions": missions}


# ─── NODE 3: SET DEADLINES (critical) ──────────────────────────

@agent_node("set_deadlines", critical=True)
async def set_deadlines(state: RoadmapState) -> RoadmapState:
    """Compute progressive deadlines based on timeline and hours budget."""
    missions = state["missions"]
    weeks = state["profile_meta"].get("timelineWeeks", 12)
    hours_per_week = state["profile_meta"].get("hoursPerWeek", 10)

    total_hours = max(weeks * hours_per_week, 1)
    now = datetime.now(tz=timezone.utc)

    cumulative_hours = 0
    for i, m in enumerate(missions):
        est = m.get("estimated_hours", 10)
        cumulative_hours += est
        deadline_weeks = max(1, round((cumulative_hours / total_hours) * weeks))
        m["deadline"] = (now + timedelta(weeks=deadline_weeks)).isoformat()
        m["status"] = "AVAILABLE" if i == 0 else "LOCKED"

    return {**state, "missions": missions}


# ─── NODE 4: ATTACH RESOURCES (non-critical) ───────────────────

@agent_node("attach_resources", critical=False)
async def attach_resources(state: RoadmapState) -> RoadmapState:
    """Fetch learning resources for each mission via Gemini (parallel, per-mission error isolation)."""
    missions = state["missions"]

    async def get_resources_for(mission: dict) -> list[dict]:
        result = await gemini_json(
            prompt=f"""You are a Senior Staff Engineer curating exact, high-signal technical resources for a developer.
Your goal is to provide resources that ACTUALLY level up a developer. DO NOT provide basic "kidish" tutorials (like W3Schools, GeeksForGeeks generic pages, or "Learn X in 10 mins" videos).
Instead, provide:
1. High-quality engineering blogs (e.g., Cloudflare, Uber, Netflix tech blogs)
2. Official advanced documentation or architectural deep-dives
3. High-quality GitHub repositories or reputable system design case studies
4. O'Reilly book chapters or advanced conference talks (e.g., StrangeLoop, InfoQ)

Mission Details:
Title: {mission['title']}
Description: {mission['description']}

Return EXACTLY 3 world-class resources as a JSON array:
[{{"title": "...", "url": "https://...", "type": "article|video|course|docs|repo"}}]

Only return real, existing URLs. They must be directly actionable for this mission!""",
            fallback=[],
            label=f"roadmap/resources/{mission.get('title', 'unknown')[:30]}",
        )
        return result if isinstance(result, list) else []

    # Parallel fetch with per-mission isolation
    resource_lists = await asyncio.gather(
        *[get_resources_for(m) for m in missions],
        return_exceptions=True,
    )

    for m, resources in zip(missions, resource_lists):
        if isinstance(resources, Exception):
            logger.warning(f"[roadmap] Resource fetch failed for {m.get('title', '?')}: {resources}")
            m["resources"] = []
        else:
            m["resources"] = resources

    return {**state, "missions": missions}


# ─── NODE 5: WRITE MISSIONS (critical) ─────────────────────────

@agent_node("write_missions", critical=True)
async def write_missions(state: RoadmapState) -> RoadmapState:
    """Persist missions to DB and mark onboarding complete."""
    pool = await get_pool()
    spid = state["student_profile_id"]

    # Keep completed missions, replace the rest
    await pool.execute(
        'DELETE FROM "Mission" WHERE "studentProfileId" = $1 AND status != \'COMPLETED\'',
        spid,
    )

    for m in state["missions"]:
        await pool.execute(
            """
            INSERT INTO "Mission"
              (id, "studentProfileId", type, title, description, status,
               resources, "estimatedHours", deadline, "orderIndex", "prerequisiteIds")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            str(uuid.uuid4()),
            spid,
            m["type"],
            m["title"],
            m["description"],
            m.get("status", "LOCKED"),
            json.dumps(m.get("resources", [])),
            m.get("estimated_hours", 10),
            _parse_deadline_for_db(m.get("deadline")),
            m.get("order_index", 0),
            [],
        )

    await pool.execute(
        'UPDATE "StudentProfile" SET "onboardingDone" = TRUE WHERE id = $1',
        spid,
    )

    logger.info(f"[roadmap] Wrote {len(state['missions'])} missions, onboarding marked done")
    return state


# ─── GRAPH ──────────────────────────────────────────────────────

def build_roadmap_agent():
    g = StateGraph(RoadmapState)

    g.add_node("load_gaps", load_gaps)
    g.add_node("generate_missions", generate_missions)
    g.add_node("set_deadlines", set_deadlines)
    g.add_node("attach_resources", attach_resources)
    g.add_node("write_missions", write_missions)

    g.set_entry_point("load_gaps")
    g.add_edge("load_gaps", "generate_missions")
    g.add_edge("generate_missions", "set_deadlines")
    g.add_edge("set_deadlines", "attach_resources")
    g.add_edge("attach_resources", "write_missions")
    g.add_edge("write_missions", END)

    return g.compile()


roadmap_agent_graph = build_roadmap_agent()
