from fastapi import APIRouter
from app.models.schemas import AnalyzeGapRequest, AnalyzeRoadmapRequest
from app.agents.gap_analyzer import gap_analyzer_graph
from app.agents.roadmap_agent import roadmap_agent_graph

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/gap")
async def analyze_gap(req: AnalyzeGapRequest):
    result = await gap_analyzer_graph.ainvoke(
        {"student_profile_id": req.student_profile_id}
    )
    return {"status": "done", "scores": result.get("scores", {})}


@router.post("/roadmap")
async def generate_roadmap(req: AnalyzeRoadmapRequest):
    result = await roadmap_agent_graph.ainvoke(
        {"student_profile_id": req.student_profile_id}
    )
    return {"status": "done", "missions_count": len(result.get("missions", []))}
