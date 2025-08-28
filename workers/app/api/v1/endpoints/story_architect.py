from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
import time

from app.core.monitoring import AGENT_EXECUTION_TIME, AGENT_SUCCESS_RATE, AGENT_FAILURE_RATE
from app.agents.story_architect import StoryArchitectAgent

router = APIRouter()

class StoryGenerationRequest(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    genre: Optional[str] = "fantasy"
    target_audience: Optional[str] = "teen"
    complexity_level: Optional[str] = "medium"
    user_id: str

class StoryGenerationResponse(BaseModel):
    story_arc_id: str
    status: str
    story_arc: Optional[Dict[str, Any]] = None
    reasoning_trace: Optional[str] = None
    error: Optional[str] = None

@router.post("/generate", response_model=StoryGenerationResponse)
async def generate_story_arc(request: StoryGenerationRequest, background_tasks: BackgroundTasks):
    """Generate a new story arc using the Story Architect agent"""
    start_time = time.time()
    
    try:
        # Create agent instance
        agent = StoryArchitectAgent()
        
        # Generate story arc
        result = await agent.generate_story_arc(
            project_id=request.project_id,
            title=request.title,
            description=request.description,
            genre=request.genre,
            target_audience=request.target_audience,
            complexity_level=request.complexity_level,
            user_id=request.user_id
        )
        
        # Record metrics
        execution_time = time.time() - start_time
        AGENT_EXECUTION_TIME.labels(
            agent_type="story_architect",
            task_type="generate_story_arc"
        ).observe(execution_time)
        
        AGENT_SUCCESS_RATE.labels(
            agent_type="story_architect",
            task_type="generate_story_arc"
        ).inc()
        
        return StoryGenerationResponse(
            story_arc_id=result["story_arc_id"],
            status="completed",
            story_arc=result["story_arc"],
            reasoning_trace=result["reasoning_trace"]
        )
        
    except Exception as e:
        # Record failure metrics
        AGENT_FAILURE_RATE.labels(
            agent_type="story_architect",
            task_type="generate_story_arc"
        ).inc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Story generation failed: {str(e)}"
        )

@router.get("/health")
async def health_check():
    """Health check for story architect agent"""
    return {"status": "healthy", "agent": "story_architect"}
