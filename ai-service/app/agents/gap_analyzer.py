"""Gap Analysis Agent — scores a student across 4 pillars and identifies gaps.

Architecture:
  load_profile ──→ extract_skills ──→ score_pillars ──→ identify_gaps ──→ write_scores
                                                                             │
                                                                             ▼
                                                                            END

Design:
- load_profile, score_pillars, write_scores are CRITICAL
- extract_skills is NON-CRITICAL (falls back to language list)
- identify_gaps is NON-CRITICAL (falls back to score-derived gaps)
- Enriched GitHub data (from github_agent v3) powers Dev, Comm, and Consistency scores
- Backward-compatible with old parsedData schema
"""
import json
import logging
from typing import TypedDict
from langgraph.graph import StateGraph, END

from app.db.client import get_pool
from app.agents.base import agent_node, llm_json, get_openai, init_state

logger = logging.getLogger(__name__)


# ─── STATE ──────────────────────────────────────────────────────

class GapState(TypedDict):
    student_profile_id: str
    _agent_name: str
    _trace: list[dict]
    _started_at: float
    github_data: dict
    leetcode_data: dict
    resume_data: dict
    linkedin_data: dict
    profile_meta: dict
    skills: list[str]
    scores: dict
    gaps: list[dict]
    strong_skills: list[str]


# ─── NODE 1: LOAD PROFILE (critical) ───────────────────────────

@agent_node("load_profile", critical=True)
async def load_profile(state: GapState) -> GapState:
    """Load platform data and student preferences from DB."""
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

    github_data, leetcode_data, resume_data, linkedin_data = {}, {}, {}, {}
    for row in connections:
        data = json.loads(row["parsedData"] or "{}")
        if row["platform"] == "GITHUB":
            github_data = data
        elif row["platform"] == "LEETCODE":
            leetcode_data = data
        elif row["platform"] == "RESUME":
            resume_data = data
        elif row["platform"] == "LINKEDIN":
            linkedin_data = data

    platforms_loaded = [r["platform"] for r in connections]
    logger.info(f"[gap-analyzer] Loaded platforms: {platforms_loaded}")

    return {
        **state,
        "github_data": github_data,
        "leetcode_data": leetcode_data,
        "resume_data": resume_data,
        "linkedin_data": linkedin_data,
        "profile_meta": dict(profile_meta) if profile_meta else {},
    }


# ─── NODE 2: EXTRACT SKILLS (non-critical) ─────────────────────

@agent_node("extract_skills", critical=False)
async def extract_skills(state: GapState) -> GapState:
    """Extract skills from enriched GitHub data, synthesis, and project topics."""
    gh = state["github_data"]
    skills: list[str] = []

    # Languages
    repos_data = gh.get("repositories", {})
    langs = repos_data.get("primary_languages", gh.get("primary_languages", {}))
    skills.extend(langs.keys())

    # Pre-extracted tech stack from github_agent
    synthesis = gh.get("synthesis", {})
    if synthesis.get("tech_stack"):
        skills.extend(synthesis["tech_stack"])

    # Project topics and languages
    for proj in repos_data.get("top_projects", gh.get("top_projects", []))[:5]:
        skills.extend(proj.get("topics", []))
        skills.extend(proj.get("languages", []))

    # Fallback: if no synthesis, ask LLM to extract from projects
    if not synthesis:
        top_projects = repos_data.get("top_projects", gh.get("top_projects", []))
        if top_projects:
            result = await llm_json(
                prompt=f"Extract a list of technical skills from these GitHub projects.\nProjects: {json.dumps(top_projects[:3])}\nReturn JSON: {{\"skills\": [\"skill1\", \"skill2\"]}}. Max 15 skills.",
                model="gpt-4o-mini",
                fallback={"skills": []},
                label="gap/extract_skills",
            )
            inferred = result.get("skills", [])
            if isinstance(inferred, list):
                skills.extend(inferred[:10])

    # Resume skills
    resume_data = state.get("resume_data", {})
    for field in ("skills", "programming_languages", "frameworks", "tools"):
        skills.extend(resume_data.get(field, []))

    # LinkedIn skills
    linkedin_data = state.get("linkedin_data", {})
    skills.extend(linkedin_data.get("skills", []))

    # Deduplicate and clean
    return {**state, "skills": list(set(s for s in skills if s and isinstance(s, str)))}


# ─── NODE 3: SCORE PILLARS (critical) ──────────────────────────

@agent_node("score_pillars", critical=True)
async def score_pillars(state: GapState) -> GapState:
    """Compute DSA, Dev, Comm, Consistency scores (0-100 each)."""
    gh = state["github_data"]
    lc = state["leetcode_data"]

    # ─── DSA (from LeetCode) ───
    medium = lc.get("medium_solved", 0)
    hard = lc.get("hard_solved", 0)
    total_solved = lc.get("total_solved", 0)
    contest = lc.get("contest_rating") or 0
    contest_norm = min((contest - 1200) / 800, 1.0) if contest > 1200 else 0

    dsa = min(
        (medium / 100) * 40 + (hard / 50) * 30
        + min(total_solved / 300, 1) * 20 + contest_norm * 10,
        100,
    )

    # ─── Dev (from enriched GitHub or fallback) ───
    code_quality = gh.get("code_quality", {})
    commit_patterns = gh.get("commit_patterns", {})
    repos = gh.get("repositories", {})
    langs = repos.get("primary_languages", gh.get("primary_languages", {}))

    # OSS contribution bonus
    contributions = gh.get("contributions", {})
    oss_merged = contributions.get("merged_prs", 0) if isinstance(contributions, dict) else 0
    oss_bonus = min(oss_merged * 3, 10)  # up to 10 bonus points for OSS

    if code_quality and isinstance(code_quality, dict) and code_quality.get("architecture_maturity") is not None:
        # Enriched path: use LLM-scored quality dimensions (including code_style from v4)
        dev = min(
            code_quality.get("architecture_maturity", 5) * 10 * 0.20
            + code_quality.get("tech_sophistication", 5) * 10 * 0.20
            + code_quality.get("code_style", 5) * 10 * 0.15
            + code_quality.get("testing_adoption", 3) * 10 * 0.12
            + code_quality.get("ci_cd_adoption", 3) * 10 * 0.08
            + code_quality.get("project_complexity", 5) * 10 * 0.15
            + min(len(langs) / 5, 1) * 10
            + oss_bonus,
            100,
        )
    else:
        # Legacy path
        cc = commit_patterns.get("total_90d", gh.get("commit_count_90d", 0))
        top_p = repos.get("top_projects", gh.get("top_projects", []))
        avg_stars = sum(p.get("stars", 0) for p in top_p) / max(len(top_p), 1) if top_p else 0
        dev = min(
            min(cc / 200, 1) * 30 + min(len(langs) / 5, 1) * 20
            + min(avg_stars / 10, 1) * 20 + min(len(top_p) / 5, 1) * 30
            + oss_bonus,
            100,
        )

    # ─── Communication (from code quality + resume writing quality) ───
    resume_data = state.get("resume_data", {})
    resume_comm_q = resume_data.get("communication_quality")  # 1-10 from GPT-4o resume parser

    if code_quality and code_quality.get("readme_quality") is not None:
        readme_q = code_quality.get("readme_quality", 5) * 10
        doc_q = code_quality.get("documentation_quality", 5) * 10
        github_comm = min(readme_q * 0.6 + doc_q * 0.4, 100)
    else:
        github_comm = 30.0

    if resume_comm_q and isinstance(resume_comm_q, (int, float)):
        # Resume quality blended 40% (resume) / 60% (GitHub code docs)
        resume_comm = min(float(resume_comm_q) * 10, 100)
        comm = github_comm * 0.60 + resume_comm * 0.40
    else:
        comm = github_comm

    # ─── Consistency (from commit patterns) ───
    if commit_patterns and commit_patterns.get("unique_active_days_90d") is not None:
        active_days = commit_patterns.get("unique_active_days_90d", 0)
        streak = commit_patterns.get("longest_streak_days", 0)
        weekly = commit_patterns.get("weekly_avg", 0)
        conv = commit_patterns.get("conventional_commit_ratio", 0)
        lc_c = min(total_solved / 200, 1) * 20

        consistency = min(
            min(active_days / 45, 1) * 30 + min(streak / 14, 1) * 25
            + min(weekly / 15, 1) * 25 + conv * 20,
            80,
        ) + min(lc_c, 20)
    else:
        cc = gh.get("commit_count_90d", 0)
        consistency = min(min(cc / 90, 1) * 60 + min(total_solved / 200, 1) * 40, 100)

    total = 0.30 * dsa + 0.30 * dev + 0.20 * comm + 0.20 * consistency

    scores = {
        "total": round(total, 2),
        "dsa": round(dsa, 2),
        "dev": round(dev, 2),
        "comm": round(comm, 2),
        "consistency": round(consistency, 2),
    }

    logger.info(f"[gap-analyzer] Scores: {scores}")
    return {**state, "scores": scores}


# ─── NODE 4: IDENTIFY GAPS (non-critical) ──────────────────────

@agent_node("identify_gaps", critical=False)
async def identify_gaps(state: GapState) -> GapState:
    """LLM identifies specific skill gaps using enriched GitHub context."""
    meta = state["profile_meta"]
    gh = state["github_data"]
    target_role = meta.get("targetRole", "SDE")
    skills = state["skills"]
    scores = state["scores"]

    # Enriched context from GitHub agent v4
    synthesis = gh.get("synthesis", {})
    code_quality = gh.get("code_quality", {})
    code_analysis = gh.get("code_analysis", {})
    contributions = gh.get("contributions", {})

    # Cross-platform context
    resume_data = state.get("resume_data", {})
    linkedin_data = state.get("linkedin_data", {})

    # Code patterns from actual source code review
    code_patterns = code_analysis.get("code_patterns", []) if isinstance(code_analysis, dict) else []
    patterns_str = ", ".join(code_patterns[:8]) if code_patterns else "No code-level analysis available"

    # OSS contributions
    oss_str = ""
    if isinstance(contributions, dict) and contributions.get("merged_prs", 0) > 0:
        oss_str = f"\n- OSS contributions: {contributions['merged_prs']} merged PRs across {', '.join(contributions.get('oss_repos', [])[:5])}"

    # Resume/LinkedIn context
    cross_platform_str = ""
    if resume_data:
        cross_platform_str += f"\n- Resume skills: {json.dumps(resume_data.get('skills', [])[:10])}"
        if resume_data.get('experience'):
            cross_platform_str += f"\n- Work experience: {json.dumps(resume_data.get('experience', [])[:3])}"
    if linkedin_data:
        cross_platform_str += f"\n- LinkedIn skills: {json.dumps(linkedin_data.get('skills', [])[:10])}"
        if linkedin_data.get('headline'):
            cross_platform_str += f"\n- LinkedIn headline: {linkedin_data['headline']}"

    result = await llm_json(
        prompt=f"""You are a career coach analyzing a student targeting: {target_role}

Current skills: {json.dumps(skills)}
Scores: DSA={scores['dsa']:.0f}/100, Dev={scores['dev']:.0f}/100, Comm={scores['comm']:.0f}/100, Consistency={scores['consistency']:.0f}/100

Developer profile:
- Domain: {synthesis.get('domain', 'unknown')}
- Seniority: {synthesis.get('seniority', 'unknown')}
- Strengths: {json.dumps(synthesis.get('strengths', []))}
- Weaknesses: {json.dumps(synthesis.get('weaknesses', []))}
- Code quality scores: {json.dumps(code_quality)}
- Code patterns from actual source review: {patterns_str}
- Improvement priorities: {json.dumps(synthesis.get('improvement_priorities', []))}{oss_str}{cross_platform_str}

Identify the top 10 skill gaps for {target_role} role. For each gap:
{{
  "skill": "name",
  "importance": 1-10,
  "current_level": 0-10,
  "category": "dsa|dev|comm|system_design|testing|devops|oss"
}}

Be SPECIFIC — reference their actual projects, code patterns, and cross-platform evidence. Don't give generic advice.

Return JSON: {{ "gaps": [...], "strong": ["skill1", "skill2"] }}""",
        model="gpt-4o",
        temperature=0.4,
        fallback={"gaps": [], "strong": []},
        label="gap/identify",
    )

    return {
        **state,
        "gaps": result.get("gaps", []),
        "strong_skills": result.get("strong", []),
    }


# ─── NODE 5: WRITE SCORES (critical) ───────────────────────────

def _compute_segment(total: float) -> str:
    if total >= 75:
        return "RISING_STAR"
    elif total >= 55:
        return "CAPABLE"
    elif total >= 35:
        return "AT_RISK"
    return "CRITICAL"


@agent_node("write_scores", critical=True)
async def write_scores(state: GapState) -> GapState:
    """Persist readiness scores and gap analysis to DB."""
    pool = await get_pool()
    scores = state["scores"]
    gaps = state.get("gaps", [])
    strong = state.get("strong_skills", [])

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

    segment = _compute_segment(scores["total"])
    await pool.execute(
        'UPDATE "StudentProfile" SET segment = $2::"Segment", "lastActiveAt" = NOW() WHERE id = $1',
        state["student_profile_id"],
        segment,
    )

    logger.info(f"[gap-analyzer] Written scores. Segment: {segment}")
    return state


# ─── GRAPH ──────────────────────────────────────────────────────

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
