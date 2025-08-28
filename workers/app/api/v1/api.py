from fastapi import APIRouter

from app.api.v1.endpoints import story_architect, quest_designer, dialogue_writer, lore_keeper, simulator, exporter

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(story_architect.router, prefix="/story-architect", tags=["story-architect"])
api_router.include_router(quest_designer.router, prefix="/quest-designer", tags=["quest-designer"])
api_router.include_router(dialogue_writer.router, prefix="/dialogue-writer", tags=["dialogue-writer"])
api_router.include_router(lore_keeper.router, prefix="/lore-keeper", tags=["lore-keeper"])
api_router.include_router(simulator.router, prefix="/simulator", tags=["simulator"])
api_router.include_router(exporter.router, prefix="/exporter", tags=["exporter"])
