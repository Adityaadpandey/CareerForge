from fastapi import APIRouter, UploadFile, File, Form
from app.models.schemas import IngestGithubRequest, IngestLeetcodeRequest
from app.ingestion.github import ingest_github
from app.ingestion.leetcode import ingest_leetcode

router = APIRouter(prefix="/ingest", tags=["ingestion"])


@router.post("/github")
async def ingest_github_endpoint(req: IngestGithubRequest):
    result = await ingest_github(req.student_profile_id, req.username)
    return {"status": "done", "data": result}


@router.post("/leetcode")
async def ingest_leetcode_endpoint(req: IngestLeetcodeRequest):
    result = await ingest_leetcode(req.student_profile_id, req.handle)
    return {"status": "done", "data": result}


@router.post("/resume")
async def ingest_resume_endpoint(
    student_profile_id: str = Form(...),
    file: UploadFile = File(...),
):
    # TODO: parse with pdfplumber + GPT-4o
    return {"status": "pending", "message": "Resume ingestion coming soon"}
