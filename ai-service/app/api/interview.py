from fastapi import APIRouter
from app.models.schemas import InterviewMessageRequest, InterviewEndRequest, InterviewGenerateDebriefRequest
from app.agents.interview_agent import process_message, generate_debrief_from_transcript

router = APIRouter(prefix="/interview", tags=["interview"])


@router.post("/message")
async def interview_message(req: InterviewMessageRequest):
    result = await process_message(req.session_id, req.message, req.student_profile_id)
    return result


@router.post("/end")
async def interview_end(req: InterviewEndRequest):
    # Legacy endpoint for text-based interviews — kept for backward compatibility
    return {"status": "done"}


@router.post("/generate-debrief")
async def interview_generate_debrief(req: InterviewGenerateDebriefRequest):
    """Called by the Stream webhook when call.transcription_ready fires."""
    result = await generate_debrief_from_transcript(
        session_id=req.session_id,
        student_profile_id=req.student_profile_id,
        transcript_url=req.transcript_url,
        emotion_data=req.emotion_data,
        communication_data=req.communication_data,
    )
    return {"status": "ok", "debrief": result}
