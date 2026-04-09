from fastapi import APIRouter
from app.models.schemas import InterviewMessageRequest, InterviewEndRequest
from app.agents.interview_agent import process_message

router = APIRouter(prefix="/interview", tags=["interview"])


@router.post("/message")
async def interview_message(req: InterviewMessageRequest):
    result = await process_message(req.session_id, req.message, req.student_profile_id)
    return result


@router.post("/end")
async def interview_end(req: InterviewEndRequest):
    # End is triggered when done=True from message endpoint
    # This is called directly from Next.js when user clicks "End"
    from app.agents.interview_agent import generate_debrief, SessionState
    state: SessionState = {
        "session_id": req.session_id,
        "student_profile_id": req.student_profile_id,
        "message": "",
        "current_state": "DEBRIEF",
        "transcript": [],
        "mission_context": None,
        "answer_scores": [],
        "response": "",
        "next_state": "DEBRIEF",
        "done": True,
    }
    result = await generate_debrief(state)
    return {"status": "done", "debrief": "generated", "overall_score": 0}
