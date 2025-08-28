import os
from prometheus_client import Counter, Histogram, Gauge, start_http_server
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Prometheus metrics
REQUEST_COUNT = Counter(
    'ai_narrative_requests_total',
    'Total number of requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'ai_narrative_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'ai_narrative_active_requests',
    'Number of active requests'
)

AGENT_EXECUTION_TIME = Histogram(
    'ai_narrative_agent_execution_seconds',
    'Agent execution time in seconds',
    ['agent_type', 'task_type']
)

AGENT_SUCCESS_RATE = Counter(
    'ai_narrative_agent_success_total',
    'Agent success count',
    ['agent_type', 'task_type']
)

AGENT_FAILURE_RATE = Counter(
    'ai_narrative_agent_failure_total',
    'Agent failure count',
    ['agent_type', 'task_type']
)

def setup_monitoring():
    """Setup monitoring and observability"""
    # Start Prometheus metrics server
    if os.getenv("ENABLE_METRICS", "true").lower() == "true":
        metrics_port = int(os.getenv("METRICS_PORT", 9090))
        start_http_server(metrics_port)
        print(f"📊 Metrics server started on port {metrics_port}")
    
    # Setup OpenTelemetry tracing
    if os.getenv("ENABLE_TRACING", "true").lower() == "true":
        trace.set_tracer_provider(TracerProvider())
        trace.get_tracer_provider().add_span_processor(
            BatchSpanProcessor(ConsoleSpanExporter())
        )
        print("🔍 Tracing enabled")
    
    print("✅ Monitoring setup complete")
