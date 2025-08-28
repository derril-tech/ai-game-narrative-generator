"""
Sentry configuration for error tracking and monitoring.
"""

import os
import logging
from typing import Optional, Dict, Any
from functools import wraps

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.aiohttp import AioHttpIntegration

from app.core.config import settings

logger = logging.getLogger(__name__)


def setup_sentry():
    """Setup Sentry for error tracking and monitoring."""
    if not settings.SENTRY_DSN:
        logger.warning("Sentry DSN not configured, skipping Sentry setup")
        return
    
    try:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            release=settings.APP_VERSION,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
            
            # Integrations
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
                RedisIntegration(),
                AsyncioIntegration(),
                AioHttpIntegration(),
            ],
            
            # Before send filter
            before_send=before_send_filter,
            
            # Before breadcrumb filter
            before_breadcrumb=before_breadcrumb_filter,
            
            # Debug mode
            debug=settings.ENVIRONMENT == "development",
            
            # Additional context
            default_tags={
                "service": "ai-game-narrative-generator",
                "component": "workers",
            }
        )
        
        logger.info("Sentry setup completed successfully")
        
    except Exception as e:
        logger.error(f"Failed to setup Sentry: {e}")


def before_send_filter(event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Filter events before sending to Sentry."""
    
    # Don't send events in development unless explicitly enabled
    if settings.ENVIRONMENT == "development" and not settings.SENTRY_ENABLE_IN_DEV:
        return None
    
    # Filter out certain error types
    if "exception" in event:
        exception = event["exception"]
        if exception and "values" in exception:
            for value in exception["values"]:
                # Filter out specific error types
                if value.get("type") in [
                    "KeyboardInterrupt",
                    "SystemExit",
                    "ConnectionRefusedError",
                    "TimeoutError"
                ]:
                    return None
    
    # Add custom context
    event.setdefault("tags", {}).update({
        "component": "workers",
        "service": "ai-game-narrative-generator"
    })
    
    return event


def before_breadcrumb_filter(breadcrumb: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Filter breadcrumbs before sending to Sentry."""
    
    # Filter out certain breadcrumb types
    if breadcrumb.get("category") in [
        "httplib",
        "urllib3",
        "requests"
    ]:
        return None
    
    return breadcrumb


def capture_lore_error(error_type: str, message: str, context: Dict[str, Any] = None):
    """Capture lore-related errors with specific context."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "lore")
        scope.set_tag("error.type", error_type)
        scope.set_level("error")
        
        if context:
            scope.set_context("lore_context", context)
        
        sentry_sdk.capture_message(
            f"Lore Error: {message}",
            level="error"
        )


def capture_invalid_lore_ref(lore_id: str, reference_type: str, reference_id: str, context: Dict[str, Any] = None):
    """Capture invalid lore reference errors."""
    capture_lore_error(
        "invalid_lore_reference",
        f"Invalid {reference_type} reference: {reference_id} in lore {lore_id}",
        {
            "lore_id": lore_id,
            "reference_type": reference_type,
            "reference_id": reference_id,
            **(context or {})
        }
    )


def capture_broken_chain(chain_type: str, chain_id: str, break_point: str, context: Dict[str, Any] = None):
    """Capture broken chain errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "chain")
        scope.set_tag("error.type", "broken_chain")
        scope.set_tag("chain.type", chain_type)
        scope.set_level("error")
        
        if context:
            scope.set_context("chain_context", context)
        
        sentry_sdk.capture_message(
            f"Broken {chain_type} chain: {chain_id} at {break_point}",
            level="error"
        )


def capture_ai_error(operation: str, model: str, provider: str, error: Exception, context: Dict[str, Any] = None):
    """Capture AI-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "ai")
        scope.set_tag("ai.operation", operation)
        scope.set_tag("ai.model", model)
        scope.set_tag("ai.provider", provider)
        scope.set_level("error")
        
        if context:
            scope.set_context("ai_context", context)
        
        sentry_sdk.capture_exception(error)


def capture_export_error(export_type: str, format: str, error: Exception, context: Dict[str, Any] = None):
    """Capture export-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "export")
        scope.set_tag("export.type", export_type)
        scope.set_tag("export.format", format)
        scope.set_level("error")
        
        if context:
            scope.set_context("export_context", context)
        
        sentry_sdk.capture_exception(error)


def capture_simulation_error(simulation_type: str, error: Exception, context: Dict[str, Any] = None):
    """Capture simulation-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "simulation")
        scope.set_tag("simulation.type", simulation_type)
        scope.set_level("error")
        
        if context:
            scope.set_context("simulation_context", context)
        
        sentry_sdk.capture_exception(error)


def capture_dialogue_error(dialogue_type: str, character_id: str = None, error: Exception = None, context: Dict[str, Any] = None):
    """Capture dialogue-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "dialogue")
        scope.set_tag("dialogue.type", dialogue_type)
        if character_id:
            scope.set_tag("character.id", character_id)
        scope.set_level("error")
        
        if context:
            scope.set_context("dialogue_context", context)
        
        if error:
            sentry_sdk.capture_exception(error)
        else:
            sentry_sdk.capture_message(
                f"Dialogue Error: {dialogue_type}",
                level="error"
            )


def capture_quest_error(quest_type: str, error: Exception, context: Dict[str, Any] = None):
    """Capture quest-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "quest")
        scope.set_tag("quest.type", quest_type)
        scope.set_level("error")
        
        if context:
            scope.set_context("quest_context", context)
        
        sentry_sdk.capture_exception(error)


def capture_database_error(operation: str, table: str = None, error: Exception = None, context: Dict[str, Any] = None):
    """Capture database-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "database")
        scope.set_tag("db.operation", operation)
        if table:
            scope.set_tag("db.table", table)
        scope.set_level("error")
        
        if context:
            scope.set_context("database_context", context)
        
        if error:
            sentry_sdk.capture_exception(error)
        else:
            sentry_sdk.capture_message(
                f"Database Error: {operation}",
                level="error"
            )


def capture_api_error(endpoint: str, method: str, status_code: int, error: Exception = None, context: Dict[str, Any] = None):
    """Capture API-related errors."""
    if not settings.SENTRY_DSN:
        return
    
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("error.category", "api")
        scope.set_tag("api.endpoint", endpoint)
        scope.set_tag("api.method", method)
        scope.set_tag("api.status_code", status_code)
        scope.set_level("error")
        
        if context:
            scope.set_context("api_context", context)
        
        if error:
            sentry_sdk.capture_exception(error)
        else:
            sentry_sdk.capture_message(
                f"API Error: {method} {endpoint} - {status_code}",
                level="error"
            )


def set_user_context(user_id: str, user_role: str = None, project_id: str = None):
    """Set user context for Sentry events."""
    if not settings.SENTRY_DSN:
        return
    
    sentry_sdk.set_user({
        "id": user_id,
        "role": user_role,
    })
    
    if project_id:
        sentry_sdk.set_tag("project.id", project_id)


def set_operation_context(operation: str, **kwargs):
    """Set operation context for Sentry events."""
    if not settings.SENTRY_DSN:
        return
    
    sentry_sdk.set_tag("operation", operation)
    for key, value in kwargs.items():
        sentry_sdk.set_tag(key, value)


def clear_context():
    """Clear Sentry context."""
    if not settings.SENTRY_DSN:
        return
    
    sentry_sdk.set_user(None)
    sentry_sdk.set_context("operation", None)


def sentry_monitor(func):
    """Decorator to monitor functions with Sentry."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not settings.SENTRY_DSN:
            return func(*args, **kwargs)
        
        with sentry_sdk.start_transaction(
            op="function",
            name=f"{func.__module__}.{func.__name__}"
        ) as transaction:
            try:
                result = func(*args, **kwargs)
                transaction.set_status("ok")
                return result
            except Exception as e:
                transaction.set_status("internal_error")
                sentry_sdk.capture_exception(e)
                raise
    
    return wrapper


def sentry_performance_monitor(operation_name: str):
    """Decorator to monitor performance with Sentry."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not settings.SENTRY_DSN:
                return func(*args, **kwargs)
            
            with sentry_sdk.start_transaction(
                op="performance",
                name=operation_name
            ) as transaction:
                try:
                    result = func(*args, **kwargs)
                    transaction.set_status("ok")
                    return result
                except Exception as e:
                    transaction.set_status("internal_error")
                    sentry_sdk.capture_exception(e)
                    raise
        
        return wrapper
    return decorator


# Initialize Sentry on module import
if settings.ENABLE_SENTRY:
    setup_sentry()
