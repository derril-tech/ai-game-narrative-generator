from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.core.config import settings
from app.core.database import init_db
from app.core.monitoring import setup_monitoring
from app.api.v1.api import api_router

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    setup_monitoring()
    yield
    # Shutdown
    pass

def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Narrative Generator Workers",
        description="CrewAI agents for narrative generation",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_HOSTS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API router
    app.include_router(api_router, prefix="/api/v1")

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "ai-narrative-workers"}

    # Metrics endpoint
    @app.get("/metrics")
    async def metrics():
        from prometheus_client import generate_latest
        return generate_latest()

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("WORKER_PORT", 8001)),
        reload=True,
    )
