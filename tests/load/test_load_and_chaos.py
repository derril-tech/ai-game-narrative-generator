"""
Load and chaos tests for the AI Game Narrative Generator.
Tests system behavior under high load and failure conditions.
"""

import asyncio
import time
import random
import logging
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
import aiohttp
import asyncio_mqtt
from locust import HttpUser, task, between, events
from locust.exception import StopUser

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.metrics import record_metric

logger = get_logger(__name__)


@dataclass
class LoadTestConfig:
    """Configuration for load tests."""
    base_url: str
    num_users: int
    spawn_rate: int
    run_time: int  # seconds
    max_nodes: int
    max_concurrent_requests: int
    timeout: int = 30


@dataclass
class ChaosTestConfig:
    """Configuration for chaos tests."""
    worker_restart_interval: int = 60  # seconds
    network_partition_duration: int = 30  # seconds
    database_failure_duration: int = 45  # seconds
    memory_leak_duration: int = 120  # seconds
    cpu_spike_duration: int = 60  # seconds


class LoadTestUser(HttpUser):
    """Locust user for load testing."""
    
    wait_time = between(1, 3)
    
    def on_start(self):
        """Setup user session."""
        self.project_id = None
        self.session_data = {}
    
    @task(3)
    def create_project(self):
        """Create a new project."""
        try:
            response = self.client.post("/api/v1/projects", json={
                "name": f"LoadTest-{int(time.time())}",
                "description": "Load test project",
                "genre": "fantasy"
            })
            
            if response.status_code == 201:
                data = response.json()
                self.project_id = data.get("id")
                self.session_data["project_id"] = self.project_id
                
        except Exception as e:
            logger.error(f"Failed to create project: {e}")
    
    @task(5)
    def generate_story(self):
        """Generate a story."""
        if not self.project_id:
            return
        
        try:
            response = self.client.post(f"/api/v1/story-graphs/{self.project_id}/generate", json={
                "prompt": "A hero's journey in a magical world",
                "max_nodes": random.randint(10, 50),
                "complexity": "medium"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.session_data["story_id"] = data.get("id")
                
        except Exception as e:
            logger.error(f"Failed to generate story: {e}")
    
    @task(4)
    def design_quests(self):
        """Design quests."""
        if not self.project_id:
            return
        
        try:
            response = self.client.post(f"/api/v1/quests/{self.project_id}/design", json={
                "story_id": self.session_data.get("story_id"),
                "num_quests": random.randint(3, 8),
                "difficulty": random.choice(["easy", "medium", "hard"])
            })
            
        except Exception as e:
            logger.error(f"Failed to design quests: {e}")
    
    @task(3)
    def generate_dialogue(self):
        """Generate dialogue."""
        if not self.project_id:
            return
        
        try:
            response = self.client.post(f"/api/v1/dialogues/generate", json={
                "project_id": self.project_id,
                "character_id": f"char_{random.randint(1, 10)}",
                "context": "Greeting dialogue",
                "tone": "friendly"
            })
            
        except Exception as e:
            logger.error(f"Failed to generate dialogue: {e}")
    
    @task(2)
    def run_simulation(self):
        """Run simulation."""
        if not self.project_id:
            return
        
        try:
            response = self.client.post(f"/api/v1/simulations", json={
                "project_id": self.project_id,
                "simulation_type": "full_playthrough"
            })
            
        except Exception as e:
            logger.error(f"Failed to run simulation: {e}")
    
    @task(1)
    def export_project(self):
        """Export project."""
        if not self.project_id:
            return
        
        try:
            response = self.client.post(f"/api/v1/exporter/export", json={
                "project_id": self.project_id,
                "export_type": "full_project",
                "format": "json"
            })
            
        except Exception as e:
            logger.error(f"Failed to export project: {e}")


class ChaosMonkey:
    """Chaos monkey for testing system resilience."""
    
    def __init__(self, config: ChaosTestConfig):
        self.config = config
        self.running = False
        self.tasks = []
    
    async def start(self):
        """Start chaos monkey."""
        self.running = True
        logger.info("Chaos monkey started")
        
        # Start chaos tasks
        self.tasks = [
            asyncio.create_task(self.worker_restart_chaos()),
            asyncio.create_task(self.network_partition_chaos()),
            asyncio.create_task(self.database_failure_chaos()),
            asyncio.create_task(self.memory_leak_chaos()),
            asyncio.create_task(self.cpu_spike_chaos()),
        ]
        
        await asyncio.gather(*self.tasks)
    
    async def stop(self):
        """Stop chaos monkey."""
        self.running = False
        for task in self.tasks:
            task.cancel()
        logger.info("Chaos monkey stopped")
    
    async def worker_restart_chaos(self):
        """Randomly restart workers."""
        while self.running:
            try:
                await asyncio.sleep(self.config.worker_restart_interval)
                
                if self.running:
                    logger.info("Chaos: Restarting random worker")
                    await self._restart_random_worker()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker restart chaos failed: {e}")
    
    async def network_partition_chaos(self):
        """Simulate network partitions."""
        while self.running:
            try:
                await asyncio.sleep(random.randint(120, 300))  # 2-5 minutes
                
                if self.running:
                    logger.info("Chaos: Simulating network partition")
                    await self._simulate_network_partition()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Network partition chaos failed: {e}")
    
    async def database_failure_chaos(self):
        """Simulate database failures."""
        while self.running:
            try:
                await asyncio.sleep(random.randint(180, 600))  # 3-10 minutes
                
                if self.running:
                    logger.info("Chaos: Simulating database failure")
                    await self._simulate_database_failure()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Database failure chaos failed: {e}")
    
    async def memory_leak_chaos(self):
        """Simulate memory leaks."""
        while self.running:
            try:
                await asyncio.sleep(random.randint(300, 900))  # 5-15 minutes
                
                if self.running:
                    logger.info("Chaos: Simulating memory leak")
                    await self._simulate_memory_leak()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Memory leak chaos failed: {e}")
    
    async def cpu_spike_chaos(self):
        """Simulate CPU spikes."""
        while self.running:
            try:
                await asyncio.sleep(random.randint(60, 180))  # 1-3 minutes
                
                if self.running:
                    logger.info("Chaos: Simulating CPU spike")
                    await self._simulate_cpu_spike()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"CPU spike chaos failed: {e}")
    
    async def _restart_random_worker(self):
        """Restart a random worker container."""
        try:
            # This would integrate with Docker/Kubernetes
            # For now, we'll simulate by making the worker unresponsive
            async with aiohttp.ClientSession() as session:
                # Simulate worker restart by making it temporarily unavailable
                await asyncio.sleep(5)
                
        except Exception as e:
            logger.error(f"Failed to restart worker: {e}")
    
    async def _simulate_network_partition(self):
        """Simulate network partition between services."""
        try:
            # Simulate network issues by adding latency
            await asyncio.sleep(self.config.network_partition_duration)
            
        except Exception as e:
            logger.error(f"Failed to simulate network partition: {e}")
    
    async def _simulate_database_failure(self):
        """Simulate database connection failures."""
        try:
            # Simulate database issues
            await asyncio.sleep(self.config.database_failure_duration)
            
        except Exception as e:
            logger.error(f"Failed to simulate database failure: {e}")
    
    async def _simulate_memory_leak(self):
        """Simulate memory leak in workers."""
        try:
            # Simulate memory pressure
            await asyncio.sleep(self.config.memory_leak_duration)
            
        except Exception as e:
            logger.error(f"Failed to simulate memory leak: {e}")
    
    async def _simulate_cpu_spike(self):
        """Simulate CPU spikes."""
        try:
            # Simulate CPU pressure
            await asyncio.sleep(self.config.cpu_spike_duration)
            
        except Exception as e:
            logger.error(f"Failed to simulate CPU spike: {e}")


class LoadTestRunner:
    """Runner for load tests."""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results = []
        self.start_time = None
        self.end_time = None
    
    async def run_load_test(self):
        """Run the load test."""
        logger.info(f"Starting load test with {self.config.num_users} users")
        self.start_time = datetime.now()
        
        # Create test data
        await self._create_test_data()
        
        # Run concurrent requests
        await self._run_concurrent_requests()
        
        # Run stress test
        await self._run_stress_test()
        
        # Run endurance test
        await self._run_endurance_test()
        
        self.end_time = datetime.now()
        
        # Generate report
        await self._generate_report()
    
    async def _create_test_data(self):
        """Create test data for load testing."""
        logger.info("Creating test data...")
        
        async with aiohttp.ClientSession() as session:
            # Create multiple projects
            for i in range(10):
                try:
                    response = await session.post(
                        f"{self.config.base_url}/api/v1/projects",
                        json={
                            "name": f"LoadTest-Project-{i}",
                            "description": f"Load test project {i}",
                            "genre": "fantasy"
                        }
                    )
                    
                    if response.status == 201:
                        data = await response.json()
                        project_id = data.get("id")
                        
                        # Generate story with many nodes
                        await session.post(
                            f"{self.config.base_url}/api/v1/story-graphs/{project_id}/generate",
                            json={
                                "prompt": f"Complex story {i} with many nodes",
                                "max_nodes": self.config.max_nodes,
                                "complexity": "high"
                            }
                        )
                        
                except Exception as e:
                    logger.error(f"Failed to create test data {i}: {e}")
    
    async def _run_concurrent_requests(self):
        """Run concurrent requests test."""
        logger.info("Running concurrent requests test...")
        
        async def make_request(session, request_id):
            try:
                start_time = time.time()
                
                # Randomly choose an endpoint
                endpoints = [
                    "/api/v1/projects",
                    "/api/v1/story-graphs",
                    "/api/v1/quests",
                    "/api/v1/dialogues",
                    "/api/v1/simulations"
                ]
                
                endpoint = random.choice(endpoints)
                method = random.choice(["GET", "POST"])
                
                if method == "GET":
                    response = await session.get(f"{self.config.base_url}{endpoint}")
                else:
                    response = await session.post(f"{self.config.base_url}{endpoint}", json={})
                
                duration = time.time() - start_time
                
                return {
                    "request_id": request_id,
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": response.status,
                    "duration": duration,
                    "success": response.status < 400
                }
                
            except Exception as e:
                return {
                    "request_id": request_id,
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": 0,
                    "duration": time.time() - start_time,
                    "success": False,
                    "error": str(e)
                }
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for i in range(self.config.max_concurrent_requests):
                task = asyncio.create_task(make_request(session, i))
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            self.results.extend([r for r in results if isinstance(r, dict)])
    
    async def _run_stress_test(self):
        """Run stress test with high load."""
        logger.info("Running stress test...")
        
        # Gradually increase load
        for load_multiplier in [1, 2, 4, 8]:
            logger.info(f"Stress test: {load_multiplier}x load")
            
            async with aiohttp.ClientSession() as session:
                tasks = []
                for i in range(self.config.max_concurrent_requests * load_multiplier):
                    task = asyncio.create_task(self._stress_request(session, i))
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                self.results.extend([r for r in results if isinstance(r, dict)])
                
                # Check system health
                await self._check_system_health()
    
    async def _run_endurance_test(self):
        """Run endurance test for extended period."""
        logger.info(f"Running endurance test for {self.config.run_time} seconds...")
        
        start_time = time.time()
        request_count = 0
        
        async with aiohttp.ClientSession() as session:
            while time.time() - start_time < self.config.run_time:
                try:
                    await self._endurance_request(session, request_count)
                    request_count += 1
                    
                    # Small delay to prevent overwhelming
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Endurance request failed: {e}")
    
    async def _stress_request(self, session, request_id):
        """Make a stress test request."""
        try:
            start_time = time.time()
            
            # Make a complex request
            response = await session.post(
                f"{self.config.base_url}/api/v1/story-graphs/generate",
                json={
                    "prompt": "Complex story with many characters and plot twists",
                    "max_nodes": 100,
                    "complexity": "high",
                    "include_dialogues": True,
                    "include_quests": True
                },
                timeout=aiohttp.ClientTimeout(total=self.config.timeout)
            )
            
            duration = time.time() - start_time
            
            return {
                "request_id": request_id,
                "type": "stress",
                "status_code": response.status,
                "duration": duration,
                "success": response.status < 400
            }
            
        except Exception as e:
            return {
                "request_id": request_id,
                "type": "stress",
                "status_code": 0,
                "duration": time.time() - start_time,
                "success": False,
                "error": str(e)
            }
    
    async def _endurance_request(self, session, request_id):
        """Make an endurance test request."""
        try:
            start_time = time.time()
            
            # Make a standard request
            response = await session.get(
                f"{self.config.base_url}/api/v1/health",
                timeout=aiohttp.ClientTimeout(total=self.config.timeout)
            )
            
            duration = time.time() - start_time
            
            self.results.append({
                "request_id": request_id,
                "type": "endurance",
                "status_code": response.status,
                "duration": duration,
                "success": response.status < 400
            })
            
        except Exception as e:
            self.results.append({
                "request_id": request_id,
                "type": "endurance",
                "status_code": 0,
                "duration": time.time() - start_time,
                "success": False,
                "error": str(e)
            })
    
    async def _check_system_health(self):
        """Check system health during stress test."""
        try:
            async with aiohttp.ClientSession() as session:
                response = await session.get(f"{self.config.base_url}/api/v1/health")
                
                if response.status != 200:
                    logger.warning(f"System health check failed: {response.status}")
                else:
                    logger.info("System health check passed")
                    
        except Exception as e:
            logger.error(f"System health check error: {e}")
    
    async def _generate_report(self):
        """Generate load test report."""
        logger.info("Generating load test report...")
        
        total_requests = len(self.results)
        successful_requests = len([r for r in self.results if r.get("success", False)])
        failed_requests = total_requests - successful_requests
        
        if total_requests > 0:
            success_rate = (successful_requests / total_requests) * 100
            avg_duration = sum(r.get("duration", 0) for r in self.results) / total_requests
            max_duration = max(r.get("duration", 0) for r in self.results)
            min_duration = min(r.get("duration", 0) for r in self.results)
            
            logger.info(f"Load Test Results:")
            logger.info(f"  Total Requests: {total_requests}")
            logger.info(f"  Successful: {successful_requests}")
            logger.info(f"  Failed: {failed_requests}")
            logger.info(f"  Success Rate: {success_rate:.2f}%")
            logger.info(f"  Avg Duration: {avg_duration:.3f}s")
            logger.info(f"  Max Duration: {max_duration:.3f}s")
            logger.info(f"  Min Duration: {min_duration:.3f}s")
            logger.info(f"  Test Duration: {(self.end_time - self.start_time).total_seconds():.2f}s")
            
            # Record metrics
            record_metric("load_test.total_requests", {"count": total_requests})
            record_metric("load_test.success_rate", {"rate": success_rate})
            record_metric("load_test.avg_duration", {"duration": avg_duration})
            record_metric("load_test.max_duration", {"duration": max_duration})


class DLQDrainRunbook:
    """Runbook for draining Dead Letter Queue."""
    
    def __init__(self, dlq_url: str):
        self.dlq_url = dlq_url
        self.processed_count = 0
        self.failed_count = 0
    
    async def drain_dlq(self):
        """Drain the Dead Letter Queue."""
        logger.info("Starting DLQ drain process...")
        
        try:
            # Get DLQ statistics
            stats = await self._get_dlq_stats()
            logger.info(f"DLQ contains {stats['message_count']} messages")
            
            if stats['message_count'] == 0:
                logger.info("DLQ is empty, nothing to drain")
                return
            
            # Process messages in batches
            batch_size = 10
            while True:
                messages = await self._get_dlq_messages(batch_size)
                
                if not messages:
                    break
                
                await self._process_message_batch(messages)
                
                # Small delay to prevent overwhelming
                await asyncio.sleep(1)
            
            logger.info(f"DLQ drain completed. Processed: {self.processed_count}, Failed: {self.failed_count}")
            
        except Exception as e:
            logger.error(f"DLQ drain failed: {e}")
            raise
    
    async def _get_dlq_stats(self) -> Dict[str, Any]:
        """Get DLQ statistics."""
        async with aiohttp.ClientSession() as session:
            response = await session.get(f"{self.dlq_url}/stats")
            return await response.json()
    
    async def _get_dlq_messages(self, batch_size: int) -> List[Dict[str, Any]]:
        """Get messages from DLQ."""
        async with aiohttp.ClientSession() as session:
            response = await session.get(f"{self.dlq_url}/messages?limit={batch_size}")
            return await response.json()
    
    async def _process_message_batch(self, messages: List[Dict[str, Any]]):
        """Process a batch of DLQ messages."""
        for message in messages:
            try:
                await self._process_single_message(message)
                self.processed_count += 1
                
            except Exception as e:
                logger.error(f"Failed to process message {message.get('id')}: {e}")
                self.failed_count += 1
    
    async def _process_single_message(self, message: Dict[str, Any]):
        """Process a single DLQ message."""
        message_id = message.get("id")
        message_type = message.get("type")
        
        logger.info(f"Processing DLQ message {message_id} of type {message_type}")
        
        # Route message based on type
        if message_type == "story_generation":
            await self._retry_story_generation(message)
        elif message_type == "quest_design":
            await self._retry_quest_design(message)
        elif message_type == "dialogue_generation":
            await self._retry_dialogue_generation(message)
        elif message_type == "simulation":
            await self._retry_simulation(message)
        elif message_type == "export":
            await self._retry_export(message)
        else:
            logger.warning(f"Unknown message type: {message_type}")
    
    async def _retry_story_generation(self, message: Dict[str, Any]):
        """Retry story generation."""
        try:
            async with aiohttp.ClientSession() as session:
                response = await session.post(
                    f"{settings.API_BASE_URL}/api/v1/story-graphs/generate",
                    json=message.get("payload", {}),
                    timeout=aiohttp.ClientTimeout(total=60)
                )
                
                if response.status == 200:
                    logger.info(f"Successfully retried story generation for message {message.get('id')}")
                else:
                    logger.error(f"Failed to retry story generation: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error retrying story generation: {e}")
            raise
    
    async def _retry_quest_design(self, message: Dict[str, Any]):
        """Retry quest design."""
        try:
            async with aiohttp.ClientSession() as session:
                response = await session.post(
                    f"{settings.API_BASE_URL}/api/v1/quests/design",
                    json=message.get("payload", {}),
                    timeout=aiohttp.ClientTimeout(total=60)
                )
                
                if response.status == 200:
                    logger.info(f"Successfully retried quest design for message {message.get('id')}")
                else:
                    logger.error(f"Failed to retry quest design: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error retrying quest design: {e}")
            raise
    
    async def _retry_dialogue_generation(self, message: Dict[str, Any]):
        """Retry dialogue generation."""
        try:
            async with aiohttp.ClientSession() as session:
                response = await session.post(
                    f"{settings.API_BASE_URL}/api/v1/dialogues/generate",
                    json=message.get("payload", {}),
                    timeout=aiohttp.ClientTimeout(total=60)
                )
                
                if response.status == 200:
                    logger.info(f"Successfully retried dialogue generation for message {message.get('id')}")
                else:
                    logger.error(f"Failed to retry dialogue generation: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error retrying dialogue generation: {e}")
            raise
    
    async def _retry_simulation(self, message: Dict[str, Any]):
        """Retry simulation."""
        try:
            async with aiohttp.ClientSession() as session:
                response = await session.post(
                    f"{settings.API_BASE_URL}/api/v1/simulations",
                    json=message.get("payload", {}),
                    timeout=aiohttp.ClientTimeout(total=60)
                )
                
                if response.status == 200:
                    logger.info(f"Successfully retried simulation for message {message.get('id')}")
                else:
                    logger.error(f"Failed to retry simulation: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error retrying simulation: {e}")
            raise
    
    async def _retry_export(self, message: Dict[str, Any]):
        """Retry export."""
        try:
            async with aiohttp.ClientSession() as session:
                response = await session.post(
                    f"{settings.API_BASE_URL}/api/v1/exporter/export",
                    json=message.get("payload", {}),
                    timeout=aiohttp.ClientTimeout(total=60)
                )
                
                if response.status == 200:
                    logger.info(f"Successfully retried export for message {message.get('id')}")
                else:
                    logger.error(f"Failed to retry export: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error retrying export: {e}")
            raise


# Test fixtures and utilities
@pytest.fixture
def load_test_config():
    """Load test configuration fixture."""
    return LoadTestConfig(
        base_url=settings.API_BASE_URL,
        num_users=100,
        spawn_rate=10,
        run_time=300,  # 5 minutes
        max_nodes=1000,
        max_concurrent_requests=50,
        timeout=30
    )


@pytest.fixture
def chaos_test_config():
    """Chaos test configuration fixture."""
    return ChaosTestConfig(
        worker_restart_interval=60,
        network_partition_duration=30,
        database_failure_duration=45,
        memory_leak_duration=120,
        cpu_spike_duration=60
    )


# Test functions
@pytest.mark.asyncio
async def test_load_test(load_test_config):
    """Test system under load."""
    runner = LoadTestRunner(load_test_config)
    await runner.run_load_test()
    
    # Assertions
    assert len(runner.results) > 0
    success_rate = len([r for r in runner.results if r.get("success", False)]) / len(runner.results) * 100
    assert success_rate > 80  # At least 80% success rate


@pytest.mark.asyncio
async def test_chaos_monkey(chaos_test_config):
    """Test system resilience with chaos monkey."""
    chaos_monkey = ChaosMonkey(chaos_test_config)
    
    # Start chaos monkey
    chaos_task = asyncio.create_task(chaos_monkey.start())
    
    # Run normal operations during chaos
    await asyncio.sleep(30)  # Let chaos run for 30 seconds
    
    # Stop chaos monkey
    await chaos_monkey.stop()
    chaos_task.cancel()
    
    # Verify system is still functional
    async with aiohttp.ClientSession() as session:
        response = await session.get(f"{settings.API_BASE_URL}/api/v1/health")
        assert response.status == 200


@pytest.mark.asyncio
async def test_dlq_drain():
    """Test DLQ drain runbook."""
    dlq_url = f"{settings.API_BASE_URL}/api/v1/dlq"
    runbook = DLQDrainRunbook(dlq_url)
    
    await runbook.drain_dlq()
    
    # Verify DLQ is drained
    async with aiohttp.ClientSession() as session:
        response = await session.get(f"{dlq_url}/stats")
        stats = await response.json()
        assert stats['message_count'] == 0


@pytest.mark.asyncio
async def test_thousands_of_nodes():
    """Test system with thousands of nodes."""
    async with aiohttp.ClientSession() as session:
        # Create project
        response = await session.post(
            f"{settings.API_BASE_URL}/api/v1/projects",
            json={
                "name": "ThousandNodesTest",
                "description": "Test with thousands of nodes",
                "genre": "epic"
            }
        )
        
        assert response.status == 201
        data = await response.json()
        project_id = data.get("id")
        
        # Generate story with thousands of nodes
        response = await session.post(
            f"{settings.API_BASE_URL}/api/v1/story-graphs/{project_id}/generate",
            json={
                "prompt": "Epic story with thousands of interconnected nodes",
                "max_nodes": 5000,
                "complexity": "extreme"
            },
            timeout=aiohttp.ClientTimeout(total=300)  # 5 minutes timeout
        )
        
        assert response.status == 200
        data = await response.json()
        
        # Verify story was generated
        assert data.get("id") is not None
        assert len(data.get("nodes", [])) > 1000  # Should have many nodes


@pytest.mark.asyncio
async def test_worker_restart_resilience():
    """Test system resilience to worker restarts."""
    # Start chaos monkey with frequent worker restarts
    config = ChaosTestConfig(worker_restart_interval=10)  # Restart every 10 seconds
    chaos_monkey = ChaosMonkey(config)
    
    chaos_task = asyncio.create_task(chaos_monkey.start())
    
    # Make requests during worker restarts
    async with aiohttp.ClientSession() as session:
        for i in range(10):
            try:
                response = await session.get(f"{settings.API_BASE_URL}/api/v1/health")
                assert response.status == 200
                await asyncio.sleep(2)
            except Exception as e:
                logger.warning(f"Request failed during worker restart: {e}")
    
    await chaos_monkey.stop()
    chaos_task.cancel()


if __name__ == "__main__":
    # Run load tests
    asyncio.run(test_load_test(LoadTestConfig(
        base_url="http://localhost:8000",
        num_users=50,
        spawn_rate=5,
        run_time=60,
        max_nodes=500,
        max_concurrent_requests=20
    )))
