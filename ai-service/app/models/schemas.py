from pydantic import BaseModel
from typing import Optional


class IngestGithubRequest(BaseModel):
    student_profile_id: str
    username: str


class IngestLeetcodeRequest(BaseModel):
    student_profile_id: str
    handle: str


class AnalyzeGapRequest(BaseModel):
    student_profile_id: str


class AnalyzeRoadmapRequest(BaseModel):
    student_profile_id: str


class InterviewStartRequest(BaseModel):
    student_profile_id: str
    mission_id: Optional[str] = None
    type: str = "TECHNICAL"


class InterviewMessageRequest(BaseModel):
    session_id: str
    message: str
    student_profile_id: str


class InterviewEndRequest(BaseModel):
    session_id: str
    student_profile_id: str


class JobsFetchRequest(BaseModel):
    student_profile_id: str


class JobsApplyRequest(BaseModel):
    student_profile_id: str
    job_id: str
