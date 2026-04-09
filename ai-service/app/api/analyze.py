from fastapi import APIRouter
from app.models.schemas import AnalyzeGapRequest, AnalyzeRoadmapRequest
from app.agents.gap_analyzer import gap_analyzer_graph
from app.agents.roadmap_agent import roadmap_agent_graph
from app.agents.base import init_state

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/gap")
async def analyze_gap(req: AnalyzeGapRequest):
    result = await gap_analyzer_graph.ainvoke(
        init_state("gap-analyzer", student_profile_id=req.student_profile_id)
    )
    return {
        "status": "done",
        "scores": result.get("scores", {}),
        "trace": result.get("_trace", []),
    }


@router.post("/roadmap")
async def generate_roadmap(req: AnalyzeRoadmapRequest):
    result = await roadmap_agent_graph.ainvoke(
        init_state("roadmap-agent", student_profile_id=req.student_profile_id)
    )
    return {
        "status": "done",
        "missions_count": len(result.get("missions", [])),
        "trace": result.get("_trace", []),
    }
