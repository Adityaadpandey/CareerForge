"""Interview State Machine Agent — conducts mock interviews with scoring.

This agent is different from the others — it's a stateful conversation machine
that processes one message at a time, not a batch pipeline.

State machine:
  OPENING → TECHNICAL → PROBING (if weak answer) → BEHAVIORAL → CLOSING → DEBRIEF

Design:
- Uses process_message() as the public API (not a compiled graph)
- Each message runs: load_session → generate_response → (optionally) generate_debrief
- Answer scoring happens in parallel with response generation
- Debrief is generated once when the interview concludes
"""
import json
import logging
from typing import TypedDict, Optional, Literal

from app.db.client import get_pool
from app.agents.base import llm_json, get_openai

logger = logging.getLogger(__name__)

InterviewPhase = Literal["OPENING", "TECHNICAL", "PROBING", "BEHAVIORAL", "CLOSING", "DEBRIEF"]


class SessionState(TypedDict):
    session_id: str
    student_profile_id: str
    message: str
    current_state: InterviewPhase
    transcript: list[dict]
    mission_context: Optional[str]
    answer_scores: list[dict]
    response: str
    next_state: InterviewPhase
    done: bool


# ─── HELPERS ────────────────────────────────────────────────────

def _determine_phase(n_student_turns: int) -> InterviewPhase:
    """Map turn count to interview phase."""
    if n_student_turns == 0:
        return "OPENING"
    elif n_student_turns <= 2:
        return "TECHNICAL"
    elif n_student_turns <= 4:
        return "BEHAVIORAL"
    return "CLOSING"


SYSTEM_PROMPT = """You are an expert technical interviewer at a top tech company.
Mission context: {mission}
Current interview phase: {phase}

Phase guide:
- OPENING: Ask "Walk me through [topic]" to warm up
- TECHNICAL: Ask 2 targeted technical questions about the mission topic
- PROBING: Dig deeper on a weak answer (ask once per question)
- BEHAVIORAL: Ask one STAR-format behavioral question relevant to the role
- CLOSING: Ask "Do you have questions for me?" and wrap up warmly

Be conversational but rigorous. Don't reveal the phase name. Keep responses under 150 words."""


# ─── LOAD SESSION ───────────────────────────────────────────────

async def _load_session(state: SessionState) -> SessionState:
    """Load transcript and mission context from DB."""
    pool = await get_pool()
    session = await pool.fetchrow(
        """
        SELECT s.transcript, s."interviewType", m.title, m.type as mission_type
        FROM "InterviewSession" s
        LEFT JOIN "Mission" m ON s."missionId" = m.id
        WHERE s.id = $1
        """,
        state["session_id"],
    )
    transcript = json.loads(session["transcript"] or "[]") if session else []
    mission_context = None
    if session and session["title"]:
        mission_context = f"{session['title']} ({session['mission_type']})"

    return {**state, "transcript": transcript, "mission_context": mission_context}


# ─── SCORE ANSWER ───────────────────────────────────────────────

async def _score_answer(question: str, answer: str) -> dict | None:
    """Score a student answer on accuracy, depth, clarity (0-10)."""
    if not question or not answer:
        return None

    result = await llm_json(
        prompt=f'Question: {question}\nAnswer: {answer}\n\nScore this interview answer.\nReturn JSON: {{"accuracy": 0-10, "depth": 0-10, "clarity": 0-10, "overall": 0-10}}',
        model="gpt-4o-mini",
        temperature=0.2,
        fallback=None,
        label="interview/score",
    )
    return result


# ─── GENERATE RESPONSE ─────────────────────────────────────────

async def _generate_response(state: SessionState) -> SessionState:
    """Generate interviewer response and determine next phase."""
    transcript = state["transcript"]
    msg = state["message"]
    current = state["current_state"]
    mission = state["mission_context"]

    # Build conversation history
    history = [
        {"role": "user" if t["role"] == "student" else "assistant", "content": t["content"]}
        for t in transcript
    ]

    system = SYSTEM_PROMPT.format(
        mission=mission or "General software engineering",
        phase=current,
    )

    # Score the previous answer (if applicable)
    score = None
    if current in ("TECHNICAL", "BEHAVIORAL") and msg:
        last_ai = next((t["content"] for t in reversed(transcript) if t["role"] == "ai"), "")
        score = await _score_answer(last_ai, msg)

    # Generate interviewer response
    try:
        client = get_openai()
        res = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system},
                *history,
                {"role": "user", "content": msg},
            ],
        )
        response = res.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"[interview] Response generation failed: {e}")
        response = "That's an interesting perspective. Could you elaborate a bit more on that?"

    # Determine next phase
    n_turns = len([t for t in transcript if t["role"] == "student"])
    low_score = score and score.get("overall", 10) < 6

    transitions = {
        "OPENING": "TECHNICAL",
        "TECHNICAL": "PROBING" if low_score else ("BEHAVIORAL" if n_turns >= 3 else "TECHNICAL"),
        "PROBING": "BEHAVIORAL" if n_turns >= 4 else "TECHNICAL",
        "BEHAVIORAL": "CLOSING",
        "CLOSING": "DEBRIEF",
    }
    next_state = transitions.get(current, current)
    done = next_state == "DEBRIEF"

    scores = list(state.get("answer_scores", []))
    if score:
        scores.append(score)

    return {
        **state,
        "response": response,
        "next_state": next_state,
        "done": done,
        "answer_scores": scores,
    }


# ─── GENERATE DEBRIEF ──────────────────────────────────────────

async def _generate_debrief(state: SessionState) -> SessionState:
    """Produce interview debrief with scores and actionable feedback."""
    pool = await get_pool()
    transcript = state["transcript"]
    scores = state.get("answer_scores", [])

    avg_scores = {}
    if scores:
        for key in ("accuracy", "depth", "clarity", "overall"):
            vals = [s.get(key, 0) for s in scores if isinstance(s, dict)]
            avg_scores[key] = round(sum(vals) / max(len(vals), 1), 1)

    transcript_text = "\n".join(
        f"{t['role'].upper()}: {t['content']}" for t in transcript[-20:]
    )

    debrief = await llm_json(
        prompt=f"""Generate a concise interview debrief:

Transcript (last 20 turns):
{transcript_text}

Average scores: {json.dumps(avg_scores)}

Return JSON:
{{
  "strong_zones": ["areas where the candidate did well"],
  "weak_zones": ["areas needing improvement"],
  "key_phrase_to_practice": "a specific phrase or concept to work on",
  "one_insight": "the single most important takeaway"
}}""",
        model="gpt-4o",
        temperature=0.4,
        fallback={"strong_zones": [], "weak_zones": [], "key_phrase_to_practice": "", "one_insight": ""},
        label="interview/debrief",
    )

    debrief["scores"] = avg_scores
    overall_score = avg_scores.get("overall", 0) * 10  # 0-100

    await pool.execute(
        """
        UPDATE "InterviewSession"
        SET status = 'COMPLETED', "completedAt" = NOW(), debrief = $2, "overallScore" = $3
        WHERE id = $1
        """,
        state["session_id"],
        json.dumps(debrief),
        overall_score,
    )

    return {**state, "response": "Interview complete! Your debrief is ready.", "done": True}


# ─── PUBLIC API ─────────────────────────────────────────────────

async def process_message(session_id: str, message: str, student_profile_id: str) -> dict:
    """Process a single interview message — the main entry point.

    Returns: {"message": str, "state": InterviewPhase, "done": bool}
    """
    pool = await get_pool()

    session = await pool.fetchrow(
        'SELECT transcript, status FROM "InterviewSession" WHERE id = $1',
        session_id,
    )
    transcript = json.loads(session["transcript"] or "[]") if session else []
    n_turns = len([t for t in transcript if t["role"] == "student"])

    state: SessionState = {
        "session_id": session_id,
        "student_profile_id": student_profile_id,
        "message": message,
        "current_state": _determine_phase(n_turns),
        "transcript": transcript,
        "mission_context": None,
        "answer_scores": [],
        "response": "",
        "next_state": _determine_phase(n_turns),
        "done": False,
    }

    # Pipeline: load → respond → (debrief if done)
    state = await _load_session(state)
    state = await _generate_response(state)

    if state["done"]:
        state = await _generate_debrief(state)

    logger.info(f"[interview] {session_id[:8]}… phase={state['current_state']}→{state['next_state']} done={state['done']}")

    return {
        "message": state["response"],
        "state": state["next_state"],
        "done": state["done"],
    }
