import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import json
import time

# Import your FastAPI app and database models
# from your_app import app, get_db
# from your_app.models import Base

class TestPhase4Integration:
    """End-to-end tests for Phase 4: Dialogue, Characters, Lore & Simulation"""
    
    @pytest.fixture(autouse=True)
    def setup_database(self):
        """Setup in-memory SQLite database for testing"""
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        TestingSessionLocal = sessionmaker(autoconmit=False, autoflush=False, bind=engine)
        
        # Create tables
        # Base.metadata.create_all(bind=engine)
        
        # Override get_db dependency
        def override_get_db():
            try:
                db = TestingSessionLocal()
                yield db
            finally:
                db.close()
        
        # app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(None)  # Replace with your app
        self.db = TestingSessionLocal()
        
        yield
        
        self.db.close()
    
    def test_dialogue_generation_workflow(self):
        """Test complete dialogue generation workflow with consistency checks"""
        # Create test character
        character_data = {
            "name": "Test NPC",
            "faction": "townsfolk",
            "personality_traits": ["friendly", "helpful"],
            "voice_tone": "casual"
        }
        
        response = self.client.post("/api/v1/characters", json=character_data)
        assert response.status_code == 201
        character_id = response.json()["id"]
        
        # Generate dialogue
        dialogue_request = {
            "character_id": character_id,
            "context": "Player asks for directions to the market",
            "player_state": {
                "stats": {"level": 5, "reputation": 10},
                "flags": {"has_map": True},
                "quest_progress": {},
                "reputation": {"townsfolk": 15}
            },
            "quest_context": None,
            "emotion_context": "helpful",
            "tone_preference": "friendly"
        }
        
        response = self.client.post("/api/v1/dialogues/generate", json=dialogue_request)
        assert response.status_code == 200
        
        dialogue_result = response.json()
        assert "dialogue_id" in dialogue_result
        assert "character_name" in dialogue_result
        assert "dialogue_text" in dialogue_result
        assert "options" in dialogue_result
        assert "consistency_checks" in dialogue_result
        
        # Verify consistency checks
        consistency = dialogue_result["consistency_checks"]
        assert "lore_consistency" in consistency
        assert "character_consistency" in consistency
        assert "quest_consistency" in consistency
        
        # Test dialogue consistency check
        response = self.client.post(f"/api/v1/dialogues/{dialogue_result['dialogue_id']}/consistency-check")
        assert response.status_code == 200
        
        consistency_result = response.json()
        assert "is_consistent" in consistency_result
        assert "issues" in consistency_result
        assert "suggestions" in consistency_result
    
    def test_lore_generation_and_consistency(self):
        """Test lore generation with consistency validation"""
        # Create test lore entry
        lore_request = {
            "project_id": "test_project",
            "category": "character",
            "title": "Elder Council Member",
            "content": "A wise elder who serves on the town council",
            "tags": ["elder", "council", "wise"],
            "existing_lore": [],
            "faction_context": {"townsfolk": "friendly"},
            "world_context": "Medieval fantasy town",
            "character_context": "Respected community leader"
        }
        
        response = self.client.post("/api/v1/lore-keeper/generate", json=lore_request)
        assert response.status_code == 200
        
        lore_result = response.json()
        assert "lore_entry" in lore_result
        assert "consistency_check" in lore_result
        assert "faction_relations" in lore_result
        
        # Test lore consistency check
        consistency_request = {
            "lore_entries": [lore_result["lore_entry"]]
        }
        
        response = self.client.post("/api/v1/lore-keeper/consistency-check", json=consistency_request)
        assert response.status_code == 200
        
        consistency_result = response.json()
        assert "results" in consistency_result
        assert "summary" in consistency_result
        
        # Verify summary statistics
        summary = consistency_result["summary"]
        assert "total_entries" in summary
        assert "consistent_entries" in summary
        assert "consistency_rate" in summary
    
    def test_faction_dynamics_analysis(self):
        """Test faction relationship analysis from lore entries"""
        # Create multiple lore entries with faction relationships
        lore_entries = [
            {
                "id": "lore_1",
                "title": "Merchant Guild",
                "content": "The merchant guild controls trade in the city and often conflicts with the thieves guild",
                "category": "faction",
                "faction_relations": {"merchants": 0.8, "thieves": -0.6}
            },
            {
                "id": "lore_2", 
                "title": "Thieves Guild",
                "content": "The thieves guild operates in the shadows and steals from merchants",
                "category": "faction",
                "faction_relations": {"thieves": 0.9, "merchants": -0.7}
            },
            {
                "id": "lore_3",
                "title": "City Guards",
                "content": "The city guards protect merchants and fight against thieves",
                "category": "faction", 
                "faction_relations": {"guards": 0.7, "merchants": 0.5, "thieves": -0.8}
            }
        ]
        
        # Analyze faction dynamics
        response = self.client.post("/api/v1/lore-keeper/faction-analysis", json={"lore_entries": lore_entries})
        assert response.status_code == 200
        
        analysis_result = response.json()
        assert "faction_relations" in analysis_result
        assert "analysis_summary" in analysis_result
        
        # Verify faction relationships were detected
        relations = analysis_result["faction_relations"]
        assert len(relations) > 0
        
        # Check for expected relationships
        merchant_thief_relation = next((r for r in relations if "merchant" in r["faction1"].lower() and "thief" in r["faction2"].lower()), None)
        if merchant_thief_relation:
            assert merchant_thief_relation["relationship_type"] in ["enemy", "rival"]
            assert merchant_thief_relation["strength"] < 0
    
    def test_simulation_with_reputation_system(self):
        """Test simulation with reputation and alignment tracking"""
        # Create test quests
        quests = [
            {
                "title": "Help the Merchant",
                "type": "dialogue",
                "difficulty": 1,
                "prerequisites": [],
                "rewards": {"experience": 10, "gold": 5}
            },
            {
                "title": "Fight the Bandits", 
                "type": "combat",
                "difficulty": 2,
                "prerequisites": [],
                "rewards": {"experience": 20, "gold": 10}
            }
        ]
        
        # Run simulation
        simulation_request = {
            "project_id": "test_project",
            "story_arc_id": "test_arc",
            "initial_state": {
                "stats": {"health": 100, "level": 1, "experience": 0},
                "reputation": {"merchants": 0, "guards": 0},
                "alignment": {"good": 0, "neutral": 50, "evil": 0}
            },
            "player_name": "TestPlayer",
            "difficulty": "normal",
            "play_style": "balanced",
            "max_duration": 30
        }
        
        response = self.client.post("/api/v1/simulation", json=simulation_request)
        assert response.status_code == 201
        
        simulation_result = response.json()
        assert "id" in simulation_result
        assert "final_state" in simulation_result
        assert "reputation_changes" in simulation_result
        assert "alignment_changes" in simulation_result
        assert "events" in simulation_result
        
        # Verify reputation changes occurred
        reputation_changes = simulation_result["reputation_changes"]
        assert isinstance(reputation_changes, dict)
        
        # Verify alignment changes occurred
        alignment_changes = simulation_result["alignment_changes"]
        assert "good" in alignment_changes
        assert "neutral" in alignment_changes
        assert "evil" in alignment_changes
        
        # Test simulation analysis
        response = self.client.get(f"/api/v1/simulation/{simulation_result['id']}/analysis")
        assert response.status_code == 200
        
        analysis = response.json()
        assert "basic_stats" in analysis
        assert "reputation_analysis" in analysis
        assert "alignment_analysis" in analysis
        assert "event_timeline" in analysis
    
    def test_batch_simulation_comparison(self):
        """Test running multiple simulations and comparing results"""
        # Create multiple simulation requests with different play styles
        simulation_requests = [
            {
                "project_id": "test_project",
                "story_arc_id": "test_arc",
                "play_style": "aggressive",
                "player_name": "AggressivePlayer"
            },
            {
                "project_id": "test_project", 
                "story_arc_id": "test_arc",
                "play_style": "diplomatic",
                "player_name": "DiplomaticPlayer"
            },
            {
                "project_id": "test_project",
                "story_arc_id": "test_arc", 
                "play_style": "exploration",
                "player_name": "ExplorerPlayer"
            }
        ]
        
        # Run batch simulations
        response = self.client.post("/api/v1/simulation/batch", json=simulation_requests)
        assert response.status_code == 201
        
        batch_result = response.json()
        assert "total_simulations" in batch_result
        assert "results" in batch_result
        assert len(batch_result["results"]) == 3
        
        # Get simulation IDs for comparison
        simulation_ids = [result["id"] for result in batch_result["results"]]
        
        # Compare simulations
        response = self.client.post("/api/v1/simulation/compare", json=simulation_ids)
        assert response.status_code == 200
        
        comparison = response.json()
        assert "total_simulations" in comparison
        assert "average_duration" in comparison
        assert "reputation_changes" in comparison
        assert "alignment_distribution" in comparison
        assert "play_style_analysis" in comparison
        
        # Verify play style analysis shows different patterns
        play_style_analysis = comparison["play_style_analysis"]
        assert "aggressive" in play_style_analysis
        assert "diplomatic" in play_style_analysis
        assert "exploration" in play_style_analysis
    
    def test_lore_export_validation(self):
        """Test lore export validation with contradictions and gaps"""
        # Create lore entries with potential issues
        problematic_lore = [
            {
                "id": "lore_1",
                "title": "Ancient Kingdom",
                "content": "The ancient kingdom was destroyed 1000 years ago",
                "category": "event",
                "canon_status": "canon"
            },
            {
                "id": "lore_2",
                "title": "Ancient Kingdom Survivors", 
                "content": "The ancient kingdom still exists in secret",
                "category": "faction",
                "canon_status": "canon"
            },
            {
                "id": "lore_3",
                "title": "Magic System",
                "content": "Magic is powered by ancient runes",
                "category": "concept",
                "canon_status": "canon"
            }
        ]
        
        # Validate for export
        response = self.client.post("/api/v1/lore-keeper/validate-export", json={"lore_entries": problematic_lore})
        assert response.status_code == 200
        
        validation_result = response.json()
        assert "is_ready_for_export" in validation_result
        assert "issues" in validation_result
        assert "warnings" in validation_result
        assert "contradictions" in validation_result
        
        # Should detect contradiction between lore_1 and lore_2
        assert not validation_result["is_ready_for_export"]
        assert len(validation_result["contradictions"]) > 0
    
    def test_dialogue_branching_generation(self):
        """Test branching dialogue generation with multiple options"""
        # Generate branching dialogue
        branch_request = {
            "character_id": "test_character",
            "context": "Player asks about the town's history",
            "player_state": {
                "stats": {"level": 3},
                "flags": {},
                "quest_progress": {},
                "reputation": {"townsfolk": 0}
            },
            "branch_count": 3
        }
        
        response = self.client.post("/api/v1/dialogues/generate-branch", json=branch_request)
        assert response.status_code == 200
        
        branch_result = response.json()
        assert "main_dialogue" in branch_result
        assert "branches" in branch_result
        assert "total_options" in branch_result
        
        # Verify multiple branches were generated
        assert len(branch_result["branches"]) == 2  # branch_count - 1
        assert branch_result["total_options"] > 0
        
        # Check that branches have different emotions/tones
        main_emotion = branch_result["main_dialogue"]["emotion"]
        branch_emotions = [branch["emotion"] for branch in branch_result["branches"]]
        
        # Should have some variation in emotions
        assert len(set([main_emotion] + branch_emotions)) > 1
    
    def test_npc_memory_integration(self):
        """Test NPC memory system with quest state and past choices"""
        # Create character with memory
        character_data = {
            "name": "Village Elder",
            "personality_traits": ["wise", "memory"],
            "memory_context": "Remembers all player interactions"
        }
        
        response = self.client.post("/api/v1/characters", json=character_data)
        assert response.status_code == 201
        character_id = response.json()["id"]
        
        # Generate dialogue with memory context
        dialogue_request = {
            "character_id": character_id,
            "context": "Player returns after completing a quest",
            "player_state": {
                "stats": {"level": 5},
                "flags": {"completed_elder_quest": True},
                "quest_progress": {"elder_quest": {"status": "completed"}},
                "reputation": {"townsfolk": 20}
            },
            "previous_dialogue": "elder_quest_start",
            "quest_context": "elder_quest"
        }
        
        response = self.client.post("/api/v1/dialogues/generate", json=dialogue_request)
        assert response.status_code == 200
        
        dialogue_result = response.json()
        
        # Verify dialogue acknowledges previous interaction
        dialogue_text = dialogue_result["dialogue_text"].lower()
        assert any(word in dialogue_text for word in ["remember", "before", "quest", "help"])
        
        # Check consistency with previous interaction
        consistency = dialogue_result["consistency_checks"]
        assert consistency["character_consistency"] == True
    
    def test_age_rating_content_filtering(self):
        """Test age-appropriate content filtering in dialogue and lore"""
        # Test dialogue generation with age rating
        dialogue_request = {
            "character_id": "test_character",
            "context": "Violent conflict resolution",
            "player_state": {"stats": {"level": 1}},
            "age_rating": "PG-13"
        }
        
        response = self.client.post("/api/v1/dialogues/generate", json=dialogue_request)
        assert response.status_code == 200
        
        dialogue_result = response.json()
        dialogue_text = dialogue_result["dialogue_text"].lower()
        
        # Should not contain inappropriate content for PG-13
        inappropriate_words = ["kill", "murder", "blood", "death"]
        for word in inappropriate_words:
            assert word not in dialogue_text
        
        # Test lore generation with age rating
        lore_request = {
            "project_id": "test_project",
            "category": "event",
            "title": "Battle of the Valley",
            "content": "A great battle was fought here",
            "age_rating": "PG-13"
        }
        
        response = self.client.post("/api/v1/lore-keeper/generate", json=lore_request)
        assert response.status_code == 200
        
        lore_result = response.json()
        lore_content = lore_result["lore_entry"]["content"].lower()
        
        # Should be age-appropriate
        assert "battle" in lore_content  # Appropriate for PG-13
        assert "blood" not in lore_content  # Too graphic
    
    def test_performance_under_load(self):
        """Test system performance with multiple concurrent requests"""
        import concurrent.futures
        import time
        
        # Create multiple concurrent requests
        def make_request():
            dialogue_request = {
                "character_id": "test_character",
                "context": "Simple greeting",
                "player_state": {"stats": {"level": 1}},
            }
            return self.client.post("/api/v1/dialogues/generate", json=dialogue_request)
        
        # Test with 10 concurrent requests
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # All requests should succeed
        assert all(result.status_code == 200 for result in results)
        
        # Should complete within reasonable time (adjust based on your requirements)
        assert total_time < 30  # 30 seconds for 10 requests
        
        # Test simulation performance
        def make_simulation_request():
            simulation_request = {
                "project_id": "test_project",
                "story_arc_id": "test_arc",
                "max_duration": 5  # Short simulation
            }
            return self.client.post("/api/v1/simulation", json=simulation_request)
        
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_simulation_request) for _ in range(5)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # All simulations should succeed
        assert all(result.status_code == 201 for result in results)
        
        # Should complete within reasonable time
        assert total_time < 60  # 60 seconds for 5 simulations

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
