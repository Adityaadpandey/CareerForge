"""Gap analysis LangGraph agent.

Graph: load_profile → extract_skills → score_pillars → identify_gaps → write_scores
"""
import json
import math
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from openai import AsyncOpenAI
from app.db.client import get_pool
from app.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class GapState(TypedDict):
    student_profile_id: str
    github_data: dict
    leetcode_data: dict
    profile_meta: dict
    skills: list[str]
    scores: dict
    gaps: list[dict]


async def load_profile(state: GapState) -> GapState:
    pool = await get_pool()

    connections = await pool.fetch(
        """
        SELECT platform, "parsedData"
        FROM "PlatformConnection"
        WHERE "studentProfileId" = $1 AND "syncStatus" = 'DONE'
        """,
        state["student_profile_id"],
    )

    profile_meta = await pool.fetchrow(
        'SELECT "targetRole", "dreamCompanies", "timelineWeeks", "hoursPerWeek" FROM "StudentProfile" WHERE id = $1',
        state["student_profile_id"],
    )

    github_data, leetcode_data = {}, {}
    for row in connections:
        data = json.loads(row["parsedData"] or "{}")
        if row["platform"] == "GITHUB":
            github_data = data
        elif row["platform"] == "LEETCODE":
            leetcode_data = data

    return {
        **state,
        "github_data": github_data,
        "leetcode_data": leetcode_data,
        "profile_meta": dict(profile_meta) if profile_meta else {},
    }


async def extract_skills(state: GapState) -> GapState:
    gh = state["github_data"]
    lc = state["leetcode_data"]

    skills = list(gh.get("primary_languages", {}).keys())

    # Add inferred skills from project descriptions via GPT
    projects = gh.get("top_projects", [])
    if projects:
        prompt = f"""
Extract a list of technical skills from these GitHub projects.
Projects: {json.dumps(projects[:3])}
Return a JSON array of skill strings only. Max 15 skills.
"""
        res = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        try:
            inferred = json.loads(res.choices[0].message.content or "{}")
            if isinstance(inferred, dict):
                inferred = list(inferred.values())[0] if inferred else []
            skills.extend(inferred[:10] if isinstance(inferred, list) else [])
        except Exception:
            pass

    return {**state, "skills": list(set(skills))}


async def score_pillars(state: GapState) -> GapState:
    gh = state["github_data"]
    lc = state["leetcode_data"]

    # DSA Score (0-100)
    medium_solved = lc.get("medium_solved", 0)
    hard_solved = lc.get("hard_solved", 0)
    contest_rating = lc.get("contest_rating") or 0
    contest_norm = min((contest_rating - 1200) / 800, 1.0) if contest_rating > 1200 else 0

    dsa_score = min(
        (medium_solved / 100) * 40
        + (hard_solved / 50) * 30
        + (min(lc.get("total_solved", 0) / 300, 1) * 20)
        + contest_norm * 10,
        100,
    )

    # Dev Score (0-100)
    commit_score = min(gh.get("commit_count_90d", 0) / 200, 1) * 30
    lang_breadth = min(len(gh.get("primary_languages", {})) / 5, 1) * 20
    stars_score = min(gh.get("avg_repo_stars", 0) / 10, 1) * 20
    projects_score = min(len(gh.get("top_projects", [])) / 5, 1) * 30

    dev_score = min(commit_score + lang_breadth + stars_score + projects_score, 100)

    # Communication Score (0-100) — basic without resume
    # Will be enhanced when resume is parsed
    comm_score = 30.0  # baseline

    # Consistency Score (0-100)
    commit_consistency = min(gh.get("commit_count_90d", 0) / 90, 1) * 60
    lc_consistency = min(lc.get("total_solved", 0) / 200, 1) * 40
    consistency_score = min(commit_consistency + lc_consistency, 100)

    total = 0.30 * dsa_score + 0.30 * dev_score + 0.20 * comm_score + 0.20 * consistency_score

    scores = {
        "total": round(total, 2),
        "dsa": round(dsa_score, 2),
        "dev": round(dev_score, 2),
        "comm": round(comm_score, 2),
        "consistency": round(consistency_score, 2),
    }

    return {**state, "scores": scores}


async def identify_gaps(state: GapState) -> GapState:
    meta = state["profile_meta"]
    target_role = meta.get("targetRole", "SDE")
    skills = state["skills"]
    scores = state["scores"]

    prompt = f"""
You are a career coach analyzing a student targeting: {target_role}

Current skills: {json.dumps(skills)}
Scores: DSA={scores['dsa']:.0f}/100, Dev={scores['dev']:.0f}/100, Comm={scores['comm']:.0f}/100

Identify the top 10 skill gaps for {target_role} role. For each gap:
{{
  "skill": "name",
  "importance": 1-10,
  "current_level": 0-10,
  "category": "dsa|dev|comm|system_design"
}}

Return JSON: {{ "gaps": [...], "strong": ["skill1", "skill2"] }}
"""

    res = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    try:
        result = json.loads(res.choices[0].message.content or "{}")
        gaps = result.get("gaps", [])
        strong = result.get("strong", [])
    except Exception:
        gaps, strong = [], []

    return {**state, "gaps": gaps, "strong_skills": strong}  # type: ignore[misc]


async def write_scores(state: GapState) -> GapState:
    pool = await get_pool()
    scores = state["scores"]
    gaps = state["gaps"]
    strong = state.get("strong_skills", [])  # type: ignore[attr-defined]

    weak_topics = [g["skill"] for g in gaps if g.get("importance", 0) >= 7][:5]

    gap_analysis = {
        "missing": [{"skill": g["skill"], "importance": g["importance"]} for g in gaps],
        "strong": strong,
    }

    await pool.execute(
        """
        INSERT INTO "ReadinessScore"
          (id, "studentProfileId", "totalScore", "dsaScore", "devScore", "commScore",
           "consistencyScore", "weakTopics", "gapAnalysis", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())
        """,
        state["student_profile_id"],
        scores["total"],
        scores["dsa"],
        scores["dev"],
        scores["comm"],
        scores["consistency"],
        weak_topics,
        json.dumps(gap_analysis),
    )

    return state


def build_gap_analyzer():
    g = StateGraph(GapState)
    g.add_node("load_profile", load_profile)
    g.add_node("extract_skills", extract_skills)
    g.add_node("score_pillars", score_pillars)
    g.add_node("identify_gaps", identify_gaps)
    g.add_node("write_scores", write_scores)

    g.set_entry_point("load_profile")
    g.add_edge("load_profile", "extract_skills")
    g.add_edge("extract_skills", "score_pillars")
    g.add_edge("score_pillars", "identify_gaps")
    g.add_edge("identify_gaps", "write_scores")
    g.add_edge("write_scores", END)

    return g.compile()


gap_analyzer_graph = build_gap_analyzer()
