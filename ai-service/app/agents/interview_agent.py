"""Interview state machine LangGraph agent."""
import json
import uuid
from typing import TypedDict, Optional, Literal
from langgraph.graph import StateGraph, END
from openai import AsyncOpenAI
from app.db.client import get_pool
from app.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

InterviewState = Literal["OPENING", "TECHNICAL", "PROBING", "BEHAVIORAL", "CLOSING", "DEBRIEF"]


class SessionState(TypedDict):
    session_id: str
    student_profile_id: str
    message: str
    current_state: InterviewState
    transcript: list[dict]
    mission_context: Optional[str]
    answer_scores: list[dict]
    response: str
    next_state: InterviewState
    done: bool


async def load_session(state: SessionState) -> SessionState:
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


async def generate_response(state: SessionState) -> SessionState:
    transcript = state["transcript"]
    msg = state["message"]
    current = state["current_state"]
    mission = state["mission_context"]

    # Build conversation history for GPT
    history = [
        {"role": "user" if t["role"] == "student" else "assistant", "content": t["content"]}
        for t in transcript
    ]

    # System prompt adapts to state
    system = f"""You are an expert technical interviewer at a top tech company.
Mission context: {mission or "General software engineering"}
Current interview state: {current}

State guide:
- OPENING: Ask "Walk me through [topic]" to warm up
- TECHNICAL: Ask 2 targeted technical questions about the mission topic
- PROBING: Dig deeper on a weak answer (ask once per question)
- BEHAVIORAL: Ask one STAR-format behavioral question relevant to the role
- CLOSING: Ask "Do you have questions for me?" and wrap up warmly

Be conversational but rigorous. Don't reveal the state name. Keep responses under 150 words.
"""

    # Score the answer in parallel (lightweight)
    score_task = None
    if current in ("TECHNICAL", "BEHAVIORAL") and msg:
        try:
            last_ai = next(
                (t["content"] for t in reversed(transcript) if t["role"] == "ai"), ""
            )
            score_res = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": f'Question: {last_ai}\nAnswer: {msg}\n\nScore this answer JSON only:\n{{"accuracy": 0-10, "depth": 0-10, "clarity": 0-10, "overall": 0-10}}',
                    }
                ],
                response_format={"type": "json_object"},
            )
            score_task = json.loads(score_res.choices[0].message.content or "{}")
        except Exception:
            score_task = None

    # Generate interviewer response
    res = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system},
            *history,
            {"role": "user", "content": msg},
        ],
    )
    response = res.choices[0].message.content or ""

    # Determine next state
    n_turns = len([t for t in transcript if t["role"] == "student"])
    low_score = score_task and score_task.get("overall", 10) < 6

    if current == "OPENING":
        next_state = "TECHNICAL"
    elif current == "TECHNICAL":
        next_state = "PROBING" if low_score else ("BEHAVIORAL" if n_turns >= 3 else "TECHNICAL")
    elif current == "PROBING":
        next_state = "BEHAVIORAL" if n_turns >= 4 else "TECHNICAL"
    elif current == "BEHAVIORAL":
        next_state = "CLOSING"
    elif current == "CLOSING":
        next_state = "DEBRIEF"
    else:
        next_state = current

    done = next_state == "DEBRIEF"

    scores = state.get("answer_scores", [])
    if score_task:
        scores = [*scores, score_task]

    return {
        **state,
        "response": response,
        "next_state": next_state,
        "done": done,
        "answer_scores": scores,
    }


async def generate_debrief(state: SessionState) -> SessionState:
    pool = await get_pool()
    transcript = state["transcript"]
    scores = state.get("answer_scores", [])

    avg_scores = {}
    if scores:
        for key in ("accuracy", "depth", "clarity", "overall"):
            avg_scores[key] = round(sum(s.get(key, 0) for s in scores) / len(scores), 1)

    transcript_text = "\n".join(
        f"{t['role'].upper()}: {t['content']}" for t in transcript[-20:]
    )

    prompt = f"""
Generate a concise interview debrief based on this transcript:
{transcript_text}

Average scores: {json.dumps(avg_scores)}

Return JSON:
{{
  "strong_zones": ["..."],
  "weak_zones": ["..."],
  "key_phrase_to_practice": "...",
  "one_insight": "..."
}}
"""

    res = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    try:
        debrief = json.loads(res.choices[0].message.content or "{}")
    except Exception:
        debrief = {}

    debrief["scores"] = avg_scores

    overall_score = avg_scores.get("overall", 0) * 10  # Scale to 0-100

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


async def process_message(session_id: str, message: str, student_profile_id: str) -> dict:
    pool = await get_pool()

    session = await pool.fetchrow(
        'SELECT transcript, status FROM "InterviewSession" WHERE id = $1',
        session_id,
    )
    transcript = json.loads(session["transcript"] or "[]") if session else []

    # Determine current state from transcript length
    n_turns = len([t for t in transcript if t["role"] == "student"])
    if n_turns == 0:
        current_state: InterviewState = "OPENING"
    elif n_turns <= 2:
        current_state = "TECHNICAL"
    elif n_turns <= 4:
        current_state = "BEHAVIORAL"
    else:
        current_state = "CLOSING"

    init_state: SessionState = {
        "session_id": session_id,
        "student_profile_id": student_profile_id,
        "message": message,
        "current_state": current_state,
        "transcript": transcript,
        "mission_context": None,
        "answer_scores": [],
        "response": "",
        "next_state": current_state,
        "done": False,
    }

    # Run load + generate
    loaded = await load_session(init_state)
    result = await generate_response(loaded)

    done = result["done"]
    if done:
        result = await generate_debrief(result)

    return {
        "message": result["response"],
        "state": result["next_state"],
        "done": done,
    }
