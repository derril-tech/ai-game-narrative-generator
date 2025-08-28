"""
OpenTelemetry telemetry setup for distributed tracing and observability.
"""

import os
import logging
from typing import Optional, Dict, Any
from contextlib import contextmanager
from functools import wraps
import time

from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.asyncio import AsyncioInstrumentor

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global tracer
tracer: Optional[trace.Tracer] = None


def setup_telemetry(service_name: str = "ai-game-narrative-generator"):
    """Setup OpenTelemetry telemetry with Jaeger and OTLP exporters."""
    global tracer
    
    try:
        # Create resource with service information
        resource = Resource.create({
            "service.name": service_name,
            "service.version": settings.APP_VERSION,
            "deployment.environment": settings.ENVIRONMENT,
        })
        
        # Create tracer provider
        provider = TracerProvider(resource=resource)
        
        # Add span processors based on environment
        if settings.ENVIRONMENT == "development":
            # Console exporter for development
            provider.add_span_processor(
                BatchSpanProcessor(ConsoleSpanExporter())
            )
        
        # Jaeger exporter
        if settings.JAEGER_ENDPOINT:
            jaeger_exporter = JaegerExporter(
                agent_host_name=settings.JAEGER_HOST,
                agent_port=settings.JAEGER_PORT,
            )
            provider.add_span_processor(
                BatchSpanProcessor(jaeger_exporter)
            )
        
        # OTLP exporter for production
        if settings.OTLP_ENDPOINT:
            otlp_exporter = OTLPSpanExporter(
                endpoint=settings.OTLP_ENDPOINT,
                insecure=settings.OTLP_INSECURE,
            )
            provider.add_span_processor(
                BatchSpanProcessor(otlp_exporter)
            )
        
        # Set the global tracer provider
        trace.set_tracer_provider(provider)
        
        # Get the tracer
        tracer = trace.get_tracer(__name__)
        
        logger.info("OpenTelemetry telemetry setup completed")
        
    except Exception as e:
        logger.error(f"Failed to setup OpenTelemetry telemetry: {e}")
        # Fallback to no-op tracer
        tracer = trace.get_tracer(__name__)


def instrument_applications():
    """Instrument various libraries and frameworks."""
    try:
        # Instrument FastAPI
        if hasattr(settings, 'FASTAPI_APP'):
            FastAPIInstrumentor.instrument_app(settings.FASTAPI_APP)
        
        # Instrument HTTP clients
        RequestsInstrumentor().instrument()
        AioHttpClientInstrumentor().instrument()
        
        # Instrument database
        SQLAlchemyInstrumentor().instrument()
        Psycopg2Instrumentor().instrument()
        
        # Instrument Redis
        RedisInstrumentor().instrument()
        
        # Instrument asyncio
        AsyncioInstrumentor().instrument()
        
        logger.info("Application instrumentation completed")
        
    except Exception as e:
        logger.error(f"Failed to instrument applications: {e}")


@contextmanager
def create_span(span_name: str, attributes: Optional[Dict[str, Any]] = None):
    """Context manager for creating spans."""
    if not tracer:
        yield
        return
    
    span = tracer.start_span(span_name, attributes=attributes or {})
    try:
        yield span
    except Exception as e:
        span.record_exception(e)
        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
        raise
    finally:
        span.end()


def trace_function(span_name: str, attributes: Optional[Dict[str, Any]] = None):
    """Decorator for tracing functions."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not tracer:
                return func(*args, **kwargs)
            
            with create_span(span_name, attributes) as span:
                # Add function info to span
                span.set_attribute("function.name", func.__name__)
                span.set_attribute("function.module", func.__module__)
                
                # Add arguments as attributes (be careful with sensitive data)
                if args:
                    span.set_attribute("function.args_count", len(args))
                if kwargs:
                    span.set_attribute("function.kwargs_count", len(kwargs))
                
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
        
        return wrapper
    return decorator


# Predefined span names for common operations
class SpanNames:
    """Predefined span names for consistent tracing."""
    
    # Story generation
    STORY_GENERATE = "story.generate"
    STORY_VALIDATE = "story.validate"
    STORY_EXPORT = "story.export"
    
    # Quest design
    QUEST_DESIGN = "quest.design"
    QUEST_VALIDATE = "quest.validate"
    QUEST_GENERATE = "quest.generate"
    QUEST_OPTIMIZE = "quest.optimize"
    
    # Dialogue making
    DIALOGUE_MAKE = "dialogue.make"
    DIALOGUE_GENERATE = "dialogue.generate"
    DIALOGUE_VALIDATE = "dialogue.validate"
    DIALOGUE_CONSISTENCY_CHECK = "dialogue.consistency_check"
    
    # Lore checking
    LORE_CHECK = "lore.check"
    LORE_GENERATE = "lore.generate"
    LORE_VALIDATE = "lore.validate"
    LORE_CONSISTENCY = "lore.consistency"
    LORE_FACTION_ANALYSIS = "lore.faction_analysis"
    
    # Simulation running
    SIMULATE_RUN = "simulate.run"
    SIMULATE_BATCH = "simulate.batch"
    SIMULATE_ANALYZE = "simulate.analyze"
    SIMULATE_COMPARE = "simulate.compare"
    
    # Export rendering
    EXPORT_RENDER = "export.render"
    EXPORT_GENERATE = "export.generate"
    EXPORT_VALIDATE = "export.validate"
    EXPORT_CONVERT = "export.convert"
    
    # AI operations
    AI_GENERATE = "ai.generate"
    AI_ANALYZE = "ai.analyze"
    AI_VALIDATE = "ai.validate"
    AI_OPTIMIZE = "ai.optimize"
    
    # Database operations
    DB_QUERY = "db.query"
    DB_WRITE = "db.write"
    DB_TRANSACTION = "db.transaction"
    
    # External API calls
    API_CALL = "api.call"
    API_REQUEST = "api.request"
    API_RESPONSE = "api.response"


class SpanAttributes:
    """Common span attributes for consistent metadata."""
    
    # Project attributes
    PROJECT_ID = "project.id"
    PROJECT_NAME = "project.name"
    PROJECT_VERSION = "project.version"
    
    # User attributes
    USER_ID = "user.id"
    USER_ROLE = "user.role"
    
    # Content attributes
    CONTENT_TYPE = "content.type"
    CONTENT_ID = "content.id"
    CONTENT_SIZE = "content.size"
    
    # AI attributes
    AI_MODEL = "ai.model"
    AI_PROVIDER = "ai.provider"
    AI_TEMPERATURE = "ai.temperature"
    AI_TOKENS_USED = "ai.tokens_used"
    AI_COST = "ai.cost"
    
    # Performance attributes
    DURATION_MS = "duration_ms"
    MEMORY_USAGE = "memory_usage"
    CPU_USAGE = "cpu_usage"
    
    # Error attributes
    ERROR_TYPE = "error.type"
    ERROR_MESSAGE = "error.message"
    ERROR_STACK = "error.stack"


def add_span_event(span: trace.Span, name: str, attributes: Optional[Dict[str, Any]] = None):
    """Add an event to a span."""
    if span:
        span.add_event(name, attributes or {})


def set_span_attribute(span: trace.Span, key: str, value: Any):
    """Set an attribute on a span."""
    if span:
        span.set_attribute(key, value)


def record_span_exception(span: trace.Span, exception: Exception):
    """Record an exception on a span."""
    if span:
        span.record_exception(exception)
        span.set_status(trace.Status(trace.StatusCode.ERROR, str(exception)))


# Convenience functions for common operations
def trace_story_generation(project_id: str, story_type: str = "main"):
    """Create a span for story generation."""
    return create_span(
        SpanNames.STORY_GENERATE,
        {
            SpanAttributes.PROJECT_ID: project_id,
            "story.type": story_type,
        }
    )


def trace_quest_design(project_id: str, quest_type: str = "main"):
    """Create a span for quest design."""
    return create_span(
        SpanNames.QUEST_DESIGN,
        {
            SpanAttributes.PROJECT_ID: project_id,
            "quest.type": quest_type,
        }
    )


def trace_dialogue_generation(project_id: str, character_id: str = None):
    """Create a span for dialogue generation."""
    attributes = {SpanAttributes.PROJECT_ID: project_id}
    if character_id:
        attributes["character.id"] = character_id
    
    return create_span(SpanNames.DIALOGUE_GENERATE, attributes)


def trace_lore_consistency_check(project_id: str, lore_type: str = "general"):
    """Create a span for lore consistency checking."""
    return create_span(
        SpanNames.LORE_CONSISTENCY,
        {
            SpanAttributes.PROJECT_ID: project_id,
            "lore.type": lore_type,
        }
    )


def trace_simulation_run(project_id: str, simulation_type: str = "single"):
    """Create a span for simulation running."""
    return create_span(
        SpanNames.SIMULATE_RUN,
        {
            SpanAttributes.PROJECT_ID: project_id,
            "simulation.type": simulation_type,
        }
    )


def trace_export_generation(project_id: str, export_type: str, format: str):
    """Create a span for export generation."""
    return create_span(
        SpanNames.EXPORT_GENERATE,
        {
            SpanAttributes.PROJECT_ID: project_id,
            "export.type": export_type,
            "export.format": format,
        }
    )


def trace_ai_operation(operation: str, model: str, provider: str):
    """Create a span for AI operations."""
    return create_span(
        SpanNames.AI_GENERATE,
        {
            "ai.operation": operation,
            SpanAttributes.AI_MODEL: model,
            SpanAttributes.AI_PROVIDER: provider,
        }
    )


def trace_database_operation(operation: str, table: str = None):
    """Create a span for database operations."""
    attributes = {"db.operation": operation}
    if table:
        attributes["db.table"] = table
    
    return create_span(SpanNames.DB_QUERY, attributes)


def trace_api_call(method: str, url: str, status_code: int = None):
    """Create a span for API calls."""
    attributes = {
        "http.method": method,
        "http.url": url,
    }
    if status_code:
        attributes["http.status_code"] = status_code
    
    return create_span(SpanNames.API_CALL, attributes)


# Performance monitoring helpers
def measure_duration(func):
    """Decorator to measure function duration and add it to spans."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        if tracer:
            with tracer.start_as_current_span(f"{func.__name__}.duration") as span:
                try:
                    result = func(*args, **kwargs)
                    duration = (time.time() - start_time) * 1000  # Convert to milliseconds
                    span.set_attribute(SpanAttributes.DURATION_MS, duration)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    duration = (time.time() - start_time) * 1000
                    span.set_attribute(SpanAttributes.DURATION_MS, duration)
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
        else:
            return func(*args, **kwargs)
    
    return wrapper


def add_performance_metrics(span: trace.Span, duration_ms: float, memory_usage: float = None):
    """Add performance metrics to a span."""
    if span:
        span.set_attribute(SpanAttributes.DURATION_MS, duration_ms)
        if memory_usage:
            span.set_attribute(SpanAttributes.MEMORY_USAGE, memory_usage)


# Initialize telemetry on module import
if settings.ENABLE_TELEMETRY:
    setup_telemetry()
    instrument_applications()
