"""Roadmap generator LangGraph agent.

Graph: load_gaps → prioritize → generate_missions → set_deadlines → write_missions
"""
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import TypedDict
from langgraph.graph import StateGraph, END
from openai import AsyncOpenAI
from app.db.client import get_pool
from app.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class RoadmapState(TypedDict):
    student_profile_id: str
    gaps: list[dict]
    profile_meta: dict
    missions: list[dict]


async def load_gaps(state: RoadmapState) -> RoadmapState:
    pool = await get_pool()

    score_row = await pool.fetchrow(
        """
        SELECT "gapAnalysis", "weakTopics"
        FROM "ReadinessScore"
        WHERE "studentProfileId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
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


async def generate_missions(state: RoadmapState) -> RoadmapState:
    meta = state["profile_meta"]
    gaps = state["gaps"]
    target_role = meta.get("targetRole", "SDE")
    weeks = meta.get("timelineWeeks", 12)
    hours = meta.get("hoursPerWeek", 10)

    top_gaps = sorted(gaps, key=lambda g: g.get("importance", 0), reverse=True)[:6]
    n_missions = min(len(top_gaps) + 2, 8)

    prompt = f"""
You are a senior career coach. Generate {n_missions} concrete missions for a student targeting {target_role}.

Skill gaps to address: {json.dumps(top_gaps)}
Timeline: {weeks} weeks, {hours} hrs/week available

Rules:
- Each mission must be a DELIVERABLE (something to build or produce), not just "study X"
- Mix of BUILD (project), SOLVE (DSA practice), COMMUNICATE (blog/writeup) types
- Order from foundational to advanced
- Must be completable in 5-25 hours each

Return ONLY valid JSON:
{{
  "missions": [
    {{
      "type": "BUILD|SOLVE|COMMUNICATE",
      "title": "...",
      "description": "2-3 specific sentences about what to build/do and why",
      "estimated_hours": 10,
      "success_criteria": "specific measurable outcome",
      "order_index": 1
    }}
  ]
}}
"""

    res = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    try:
        result = json.loads(res.choices[0].message.content or "{}")
        missions = result.get("missions", [])
    except Exception:
        missions = []

    return {**state, "missions": missions}


async def set_deadlines(state: RoadmapState) -> RoadmapState:
    missions = state["missions"]
    weeks = state["profile_meta"].get("timelineWeeks", 12)
    hours_per_week = state["profile_meta"].get("hoursPerWeek", 10)

    total_hours = weeks * hours_per_week
    n = len(missions)
    now = datetime.now(tz=timezone.utc)

    cumulative_hours = 0
    for i, m in enumerate(missions):
        est = m.get("estimated_hours", 10)
        cumulative_hours += est
        deadline_weeks = max(1, round((cumulative_hours / total_hours) * weeks))
        m["deadline"] = (now + timedelta(weeks=deadline_weeks)).isoformat()
        m["status"] = "AVAILABLE" if i == 0 else "LOCKED"

    return {**state, "missions": missions}


async def write_missions(state: RoadmapState) -> RoadmapState:
    pool = await get_pool()
    spid = state["student_profile_id"]

    # Keep completed missions, replace the rest
    await pool.execute(
        """
        DELETE FROM "Mission"
        WHERE "studentProfileId" = $1 AND status != 'COMPLETED'
        """,
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
            json.dumps([]),  # resources attached separately
            m.get("estimated_hours", 10),
            datetime.fromisoformat(m["deadline"]) if m.get("deadline") else None,
            m.get("order_index", 0),
            [],
        )

    # Mark onboarding done
    await pool.execute(
        'UPDATE "StudentProfile" SET "onboardingDone" = TRUE WHERE id = $1',
        spid,
    )

    return state


def build_roadmap_agent():
    g = StateGraph(RoadmapState)
    g.add_node("load_gaps", load_gaps)
    g.add_node("generate_missions", generate_missions)
    g.add_node("set_deadlines", set_deadlines)
    g.add_node("write_missions", write_missions)

    g.set_entry_point("load_gaps")
    g.add_edge("load_gaps", "generate_missions")
    g.add_edge("generate_missions", "set_deadlines")
    g.add_edge("set_deadlines", "write_missions")
    g.add_edge("write_missions", END)

    return g.compile()


roadmap_agent_graph = build_roadmap_agent()
