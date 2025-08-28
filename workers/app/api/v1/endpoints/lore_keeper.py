from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import time
import logging

from app.core.monitoring import AGENT_EXECUTION_TIME, AGENT_SUCCESS_RATE, AGENT_FAILURE_RATE
from app.agents.lore_keeper import LoreKeeperAgent, LoreGenerationRequest as AgentRequest, LoreGenerationResponse as AgentResponse
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

class LoreGenerationRequest(BaseModel):
    project_id: str
    category: str
    title: str
    content: str
    tags: List[str] = []
    existing_lore: List[Dict[str, Any]] = []
    faction_context: Dict[str, Any] = {}
    world_context: str = ""
    character_context: str = ""

class LoreGenerationResponse(BaseModel):
    lore_entry: Dict[str, Any]
    consistency_check: Dict[str, Any]
    faction_relations: List[Dict[str, Any]]
    suggestions: List[str]
    generation_time: float
    model_used: str

class ConsistencyCheckRequest(BaseModel):
    lore_entries: List[Dict[str, Any]]

class ConsistencyCheckResponse(BaseModel):
    results: List[Dict[str, Any]]
    summary: Dict[str, Any]

class FactionAnalysisRequest(BaseModel):
    lore_entries: List[Dict[str, Any]]

class FactionAnalysisResponse(BaseModel):
    faction_relations: List[Dict[str, Any]]
    analysis_summary: Dict[str, Any]

class ExportValidationRequest(BaseModel):
    lore_entries: List[Dict[str, Any]]

class ExportValidationResponse(BaseModel):
    is_ready_for_export: bool
    issues: List[str]
    warnings: List[str]
    suggestions: List[str]
    missing_categories: List[str]
    contradictions: List[str]
    faction_gaps: List[str]

@router.post("/generate", response_model=LoreGenerationResponse)
async def generate_lore(request: LoreGenerationRequest):
    """Generate a new lore entry with consistency checks and faction implications"""
    start_time = time.time()
    
    try:
        # Initialize the lore keeper agent
        lore_keeper = LoreKeeperAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        # Convert request to agent format
        agent_request = AgentRequest(
            project_id=request.project_id,
            category=request.category,
            title=request.title,
            content=request.content,
            tags=request.tags,
            existing_lore=request.existing_lore,  # This would need conversion to LoreEntry objects
            faction_context=request.faction_context,
            world_context=request.world_context,
            character_context=request.character_context
        )
        
        # Generate lore entry
        result = lore_keeper.generate_lore_entry(agent_request)
        
        # Record metrics
        execution_time = time.time() - start_time
        AGENT_EXECUTION_TIME.labels(
            agent_type="lore_keeper",
            task_type="generate_lore"
        ).observe(execution_time)
        
        AGENT_SUCCESS_RATE.labels(
            agent_type="lore_keeper",
            task_type="generate_lore"
        ).inc()
        
        logger.info(f"Lore generation completed in {execution_time:.2f}s for project {request.project_id}")
        
        return LoreGenerationResponse(
            lore_entry=result.lore_entry.dict(),
            consistency_check=result.consistency_check.dict(),
            faction_relations=[relation.dict() for relation in result.faction_relations],
            suggestions=result.suggestions,
            generation_time=execution_time,
            model_used=result.model_used
        )
        
    except Exception as e:
        AGENT_FAILURE_RATE.labels(
            agent_type="lore_keeper",
            task_type="generate_lore"
        ).inc()
        
        logger.error(f"Lore generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Lore generation failed: {str(e)}"
        )

@router.post("/consistency-check", response_model=ConsistencyCheckResponse)
async def check_lore_consistency(request: ConsistencyCheckRequest):
    """Check consistency across multiple lore entries"""
    start_time = time.time()
    
    try:
        # Initialize the lore keeper agent
        lore_keeper = LoreKeeperAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        # Convert to LoreEntry objects (simplified for now)
        from app.agents.lore_keeper import LoreEntry
        lore_entries = []
        for entry_data in request.lore_entries:
            lore_entries.append(LoreEntry(**entry_data))
        
        # Perform consistency checks
        results = lore_keeper.check_lore_consistency(lore_entries)
        
        # Calculate summary
        total_entries = len(results)
        consistent_entries = sum(1 for r in results if r.is_consistent)
        inconsistent_entries = total_entries - consistent_entries
        avg_confidence = sum(r.confidence_score for r in results) / total_entries if results else 0
        
        summary = {
            'total_entries': total_entries,
            'consistent_entries': consistent_entries,
            'inconsistent_entries': inconsistent_entries,
            'consistency_rate': consistent_entries / total_entries if total_entries > 0 else 0,
            'average_confidence': avg_confidence
        }
        
        # Record metrics
        execution_time = time.time() - start_time
        AGENT_EXECUTION_TIME.labels(
            agent_type="lore_keeper",
            task_type="consistency_check"
        ).observe(execution_time)
        
        AGENT_SUCCESS_RATE.labels(
            agent_type="lore_keeper",
            task_type="consistency_check"
        ).inc()
        
        logger.info(f"Consistency check completed in {execution_time:.2f}s for {total_entries} entries")
        
        return ConsistencyCheckResponse(
            results=[result.dict() for result in results],
            summary=summary
        )
        
    except Exception as e:
        AGENT_FAILURE_RATE.labels(
            agent_type="lore_keeper",
            task_type="consistency_check"
        ).inc()
        
        logger.error(f"Consistency check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Consistency check failed: {str(e)}"
        )

@router.post("/faction-analysis", response_model=FactionAnalysisResponse)
async def analyze_faction_dynamics(request: FactionAnalysisRequest):
    """Analyze faction relationships and dynamics from lore entries"""
    start_time = time.time()
    
    try:
        # Initialize the lore keeper agent
        lore_keeper = LoreKeeperAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        # Convert to LoreEntry objects (simplified for now)
        from app.agents.lore_keeper import LoreEntry
        lore_entries = []
        for entry_data in request.lore_entries:
            lore_entries.append(LoreEntry(**entry_data))
        
        # Analyze faction dynamics
        faction_relations = lore_keeper.analyze_faction_dynamics(lore_entries)
        
        # Calculate analysis summary
        total_relations = len(faction_relations)
        ally_relations = sum(1 for r in faction_relations if r.relationship_type == 'ally')
        enemy_relations = sum(1 for r in faction_relations if r.relationship_type == 'enemy')
        neutral_relations = sum(1 for r in faction_relations if r.relationship_type == 'neutral')
        
        analysis_summary = {
            'total_relations': total_relations,
            'ally_relations': ally_relations,
            'enemy_relations': enemy_relations,
            'neutral_relations': neutral_relations,
            'average_strength': sum(r.strength for r in faction_relations) / total_relations if total_relations > 0 else 0
        }
        
        # Record metrics
        execution_time = time.time() - start_time
        AGENT_EXECUTION_TIME.labels(
            agent_type="lore_keeper",
            task_type="faction_analysis"
        ).observe(execution_time)
        
        AGENT_SUCCESS_RATE.labels(
            agent_type="lore_keeper",
            task_type="faction_analysis"
        ).inc()
        
        logger.info(f"Faction analysis completed in {execution_time:.2f}s for {len(lore_entries)} entries")
        
        return FactionAnalysisResponse(
            faction_relations=[relation.dict() for relation in faction_relations],
            analysis_summary=analysis_summary
        )
        
    except Exception as e:
        AGENT_FAILURE_RATE.labels(
            agent_type="lore_keeper",
            task_type="faction_analysis"
        ).inc()
        
        logger.error(f"Faction analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Faction analysis failed: {str(e)}"
        )

@router.post("/validate-export", response_model=ExportValidationResponse)
async def validate_lore_for_export(request: ExportValidationRequest):
    """Validate lore entries before export to ensure consistency and completeness"""
    start_time = time.time()
    
    try:
        # Initialize the lore keeper agent
        lore_keeper = LoreKeeperAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        # Convert to LoreEntry objects (simplified for now)
        from app.agents.lore_keeper import LoreEntry
        lore_entries = []
        for entry_data in request.lore_entries:
            lore_entries.append(LoreEntry(**entry_data))
        
        # Validate for export
        validation_result = lore_keeper.validate_lore_for_export(lore_entries)
        
        # Record metrics
        execution_time = time.time() - start_time
        AGENT_EXECUTION_TIME.labels(
            agent_type="lore_keeper",
            task_type="validate_export"
        ).observe(execution_time)
        
        AGENT_SUCCESS_RATE.labels(
            agent_type="lore_keeper",
            task_type="validate_export"
        ).inc()
        
        logger.info(f"Export validation completed in {execution_time:.2f}s for {len(lore_entries)} entries")
        
        return ExportValidationResponse(**validation_result)
        
    except Exception as e:
        AGENT_FAILURE_RATE.labels(
            agent_type="lore_keeper",
            task_type="validate_export"
        ).inc()
        
        logger.error(f"Export validation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Export validation failed: {str(e)}"
        )

@router.get("/templates/{category}")
async def get_lore_templates(category: str = None):
    """Get lore generation templates for different categories"""
    try:
        lore_keeper = LoreKeeperAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        templates = lore_keeper.get_pattern_templates(category)
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Failed to get lore templates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get lore templates: {str(e)}")

@router.post("/validate-pattern")
async def validate_lore_pattern(pattern: Dict[str, Any]):
    """Validate a lore generation pattern for completeness and consistency"""
    try:
        lore_keeper = LoreKeeperAgent(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key
        )
        
        errors = lore_keeper.validate_lore_pattern(pattern)
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Lore pattern validation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lore pattern validation failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "agent": "lore_keeper"}
