from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import time
import logging

from app.core.monitoring import AGENT_EXECUTION_TIME, AGENT_SUCCESS_RATE, AGENT_FAILURE_RATE
from app.agents.quest_designer import QuestDesignerAgent, QuestGenerationRequest as AgentRequest, QuestGenerationResponse as AgentResponse
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

class QuestGenerationRequest(BaseModel):
    project_id: str
    story_arc_id: str
    narrative_beat: str  # rising, climax, resolution
    difficulty: str  # easy, medium, hard, epic
    player_level: int
    available_items: List[str]
    available_stats: List[str]
    world_context: str
    character_context: str
    previous_quests: List[Dict[str, Any]]
    target_duration: Optional[int] = None

class QuestGenerationResponse(BaseModel):
    quest_patterns: List[Dict[str, Any]]
    reasoning: str
    narrative_flow: str
    difficulty_progression: str
    generation_time: float
    status: str

@router.post("/generate", response_model=QuestGenerationResponse)
async def generate_quest(request: QuestGenerationRequest):
    """Generate quest patterns based on narrative beats and context"""
    start_time = time.time()
    
    try:
        # Initialize the quest designer agent
        quest_designer = QuestDesignerAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        # Convert request to agent format
        agent_request = AgentRequest(
            project_id=request.project_id,
            story_arc_id=request.story_arc_id,
            narrative_beat=request.narrative_beat,
            difficulty=request.difficulty,
            player_level=request.player_level,
            available_items=request.available_items,
            available_stats=request.available_stats,
            world_context=request.world_context,
            character_context=request.character_context,
            previous_quests=request.previous_quests,
            target_duration=request.target_duration
        )
        
        # Generate quest patterns
        result = quest_designer.generate_quest_patterns(agent_request)
        
        # Record metrics
        execution_time = time.time() - start_time
        AGENT_EXECUTION_TIME.labels(
            agent_type="quest_designer",
            task_type="generate_quest_patterns"
        ).observe(execution_time)
        
        AGENT_SUCCESS_RATE.labels(
            agent_type="quest_designer",
            task_type="generate_quest_patterns"
        ).inc()
        
        logger.info(f"Quest generation completed in {execution_time:.2f}s for project {request.project_id}")
        
        return QuestGenerationResponse(
            quest_patterns=[pattern.dict() for pattern in result.quest_patterns],
            reasoning=result.reasoning,
            narrative_flow=result.narrative_flow,
            difficulty_progression=result.difficulty_progression,
            generation_time=execution_time,
            status="completed"
        )
        
    except Exception as e:
        AGENT_FAILURE_RATE.labels(
            agent_type="quest_designer",
            task_type="generate_quest_patterns"
        ).inc()
        
        logger.error(f"Quest generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Quest generation failed: {str(e)}"
        )

@router.get("/templates/{narrative_beat}")
async def get_quest_templates(narrative_beat: str = None):
    """Get quest pattern templates for a specific narrative beat or all beats"""
    try:
        quest_designer = QuestDesignerAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        templates = quest_designer.get_pattern_templates(narrative_beat)
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Failed to get quest templates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get quest templates: {str(e)}")

@router.post("/validate")
async def validate_quest_pattern(pattern: Dict[str, Any]):
    """Validate a quest pattern for completeness and consistency"""
    try:
        from app.agents.quest_designer import QuestPattern
        
        # Convert dict to QuestPattern object
        quest_pattern = QuestPattern(**pattern)
        
        quest_designer = QuestDesignerAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        errors = quest_designer.validate_quest_pattern(quest_pattern)
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Quest pattern validation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Quest pattern validation failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for quest designer agent"""
    return {"status": "healthy", "agent": "quest_designer"}
