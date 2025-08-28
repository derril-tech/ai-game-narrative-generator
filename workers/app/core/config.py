from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AI Narrative Generator Workers"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "postgresql://ai_narrative:ai_narrative_dev@localhost:5432/ai_narrative"
    DATABASE_SCHEMA: str = "ai_narrative"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PASSWORD: Optional[str] = None
    
    # NATS
    NATS_URL: str = "nats://localhost:4222"
    NATS_CLUSTER_ID: str = "ai-narrative-cluster"
    
    # S3/MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin123"
    S3_BUCKET: str = "ai-narrative-exports"
    S3_REGION: str = "us-east-1"
    
    # AI Services
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    COHERE_API_KEY: Optional[str] = None
    
    # Content Policy
    CONTENT_POLICY_AGE_RATING: str = "teen"
    CONTENT_POLICY_THEMES: List[str] = ["fantasy", "adventure", "mystery"]
    CONTENT_POLICY_TONE: str = "neutral"
    CONTENT_POLICY_MAX_VIOLENCE_LEVEL: str = "moderate"
    CONTENT_POLICY_MAX_LANGUAGE_LEVEL: str = "mild"
    
    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    
    # CORS
    ALLOWED_HOSTS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Worker Configuration
    WORKER_PORT: int = 8001
    WORKER_STORY_ARCHITECT_PORT: int = 8001
    WORKER_QUEST_DESIGNER_PORT: int = 8002
    WORKER_DIALOGUE_WRITER_PORT: int = 8003
    WORKER_LORE_KEEPER_PORT: int = 8004
    WORKER_SIMULATOR_PORT: int = 8005
    WORKER_EXPORTER_PORT: int = 8006
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
