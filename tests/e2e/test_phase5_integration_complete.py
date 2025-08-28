import pytest
import asyncio
from fastapi.testclient import TestClient
from typing import Dict, Any
import json
import time
from datetime import datetime, timedelta

class TestPhase5CompleteIntegration:
    """Complete end-to-end tests for Phase 5: Exports, Observability, Security & QA"""
    
    def setup_method(self):
        """Setup test client and test data"""
        # This would be initialized with your FastAPI app
        # self.client = TestClient(app)
        self.test_project_id = "test-project-123"
        self.test_user_id = "test-user-456"
        
    def test_complete_authoring_workflow_with_security(self):
        """Test complete authoring workflow with security enforcement"""
        # 1. Create project with content policy
        project_response = self.client.post("/api/projects", json={
            "name": "Secure Test Project",
            "description": "Testing complete workflow with security"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
        
        # Set content policy
        policy_response = self.client.post(
            f"/api/content-policy/projects/{project_id}",
            json={
                "ageRating": "PG-13",
                "themes": ["fantasy", "adventure"],
                "tone": "family",
                "violenceLevel": "mild",
                "languageLevel": "clean",
                "sexualContent": "none",
                "drugContent": "none",
                "politicalContent": "none",
                "customFilters": [],
                "autoReviewThreshold": 3
            }
        )
        assert policy_response.status_code == 200
        
        # 2. Generate story arc with AI
        story_response = self.client.post(
            f"/api/projects/{project_id}/story/arcs",
            json={
                "title": "The Hero's Journey",
                "description": "A classic fantasy adventure",
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert story_response.status_code == 201
        story_id = story_response.json()["id"]
        
        # 3. Generate quests
        quest_response = self.client.post(
            f"/api/projects/{project_id}/quests",
            json={
                "title": "Rescue the Princess",
                "description": "A heroic quest to save the kingdom",
                "storyArcId": story_id,
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert quest_response.status_code == 201
        quest_id = quest_response.json()["id"]
        
        # 4. Generate dialogue
        dialogue_response = self.client.post(
            f"/api/projects/{project_id}/dialogues",
            json={
                "content": "Welcome, brave adventurer! The kingdom needs your help.",
                "characterId": "npc-1",
                "questId": quest_id,
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert dialogue_response.status_code == 201
        
        # 5. Add lore entry
        lore_response = self.client.post(
            f"/api/projects/{project_id}/lore",
            json={
                "title": "The Ancient Prophecy",
                "content": "A prophecy foretelling the hero's arrival",
                "category": "prophecy",
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert lore_response.status_code == 201
        
        # 6. Run simulation
        simulation_response = self.client.post(
            f"/api/projects/{project_id}/simulations",
            json={
                "name": "Test Playthrough",
                "description": "Testing the complete story flow"
            }
        )
        assert simulation_response.status_code == 201
        simulation_id = simulation_response.json()["id"]
        
        # 7. Export project
        export_response = self.client.post(
            f"/api/projects/{project_id}/exports",
            json={
                "type": "full_project",
                "format": "json",
                "includeMetadata": True,
                "includeAssets": True
            }
        )
        assert export_response.status_code == 200
        export_data = export_response.json()
        assert "downloadUrl" in export_data
        
        # 8. Verify audit trail
        audit_response = self.client.get(f"/api/security/projects/{project_id}/audit-trail")
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()
        
        # Should have entries for all operations
        operations = [log["operation"] for log in audit_logs]
        assert "create" in operations  # Project creation
        assert "generate" in operations  # AI generation
        assert "export" in operations  # Export
        
        # 9. Check AI vs human statistics
        stats_response = self.client.get(f"/api/security/projects/{project_id}/edit-statistics")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["aiEdits"] >= 4  # Story, quest, dialogue, lore
        assert stats["aiEditPercentage"] > 80  # Most content should be AI-generated
        
    def test_observability_integration(self):
        """Test observability features integration"""
        # 1. Generate content to create telemetry data
        for i in range(5):
            self.client.post(
                f"/api/projects/{self.test_project_id}/story/arcs",
                json={
                    "title": f"Observability Test {i}",
                    "description": "Testing telemetry collection",
                    "isAIGenerated": True
                },
                headers={"X-AI-Generated": "true"}
            )
        
        # 2. Check OpenTelemetry spans (this would be tested with actual OTel setup)
        # In a real test, you'd verify spans are being created for:
        # - story.generate
        # - quest.design
        # - dialogue.make
        # - lore.check
        # - simulate.run
        # - export.render
        
        # 3. Check Prometheus metrics (this would be tested with actual Prometheus setup)
        # In a real test, you'd verify metrics are being collected for:
        # - Request rates
        # - Response times
        # - Error rates
        # - AI token usage
        # - Database connections
        
        # 4. Check Sentry error tracking (this would be tested with actual Sentry setup)
        # In a real test, you'd verify errors are being captured for:
        # - Invalid lore references
        # - Broken chains
        # - AI operation failures
        # - Database errors
        
    def test_performance_benchmarks(self):
        """Test performance benchmarks for Phase 5 features"""
        # 1. Test export performance
        start_time = time.time()
        export_response = self.client.post(
            f"/api/projects/{self.test_project_id}/exports",
            json={
                "type": "story_graph",
                "format": "json",
                "includeMetadata": True
            }
        )
        export_time = time.time() - start_time
        assert export_response.status_code == 200
        assert export_time < 5.0  # p95 < 5s for story graph export
        
        # 2. Test dialogue tree export performance
        start_time = time.time()
        dialogue_export_response = self.client.post(
            f"/api/projects/{self.test_project_id}/exports",
            json={
                "type": "dialogue_tree",
                "format": "json",
                "includeMetadata": False
            }
        )
        dialogue_export_time = time.time() - start_time
        assert dialogue_export_response.status_code == 200
        assert dialogue_export_time < 4.0  # p95 < 4s for 10-node dialogue tree
        
        # 3. Test security enforcement performance
        start_time = time.time()
        for i in range(100):
            self.client.get(f"/api/projects/{self.test_project_id}")
        security_time = time.time() - start_time
        assert security_time < 10.0  # 100 RLS checks should complete quickly
        
    def test_accessibility_features(self):
        """Test accessibility features in editors"""
        # 1. Test keyboard navigation in StoryMap
        # This would test:
        # - Tab navigation between elements
        # - Arrow key navigation in graph
        # - Enter/Space for selection
        # - Escape for canceling operations
        
        # 2. Test screen reader labels
        # This would test:
        # - ARIA labels on graph nodes
        # - Alt text for images
        # - Form field labels
        # - Button descriptions
        
        # 3. Test high contrast mode
        # This would test:
        # - Color contrast ratios
        # - Focus indicators
        # - Text readability
        
        # Note: These would be tested with actual frontend components
        # For now, we'll verify the API supports accessibility metadata
        
        # Test that API returns accessibility metadata
        project_response = self.client.get(f"/api/projects/{self.test_project_id}")
        assert project_response.status_code == 200
        # In a real implementation, the response would include accessibility metadata
        
    def test_content_policy_enforcement_workflow(self):
        """Test complete content policy enforcement workflow"""
        # 1. Create content that passes policy
        safe_content = "This is a family-friendly fantasy adventure story suitable for all ages."
        
        check_response = self.client.post(
            f"/api/content-policy/projects/{self.test_project_id}/check",
            json={
                "content": safe_content,
                "contentType": "story"
            }
        )
        assert check_response.status_code == 200
        check_data = check_response.json()
        assert check_data["passed"] == True
        assert len(check_data["violations"]) == 0
        
        # 2. Create content that violates policy
        violating_content = "This story contains explicit violence and strong language that violates our content policy."
        
        violation_check_response = self.client.post(
            f"/api/content-policy/projects/{self.test_project_id}/check",
            json={
                "content": violating_content,
                "contentType": "story"
            }
        )
        assert violation_check_response.status_code == 200
        violation_data = violation_check_response.json()
        assert violation_data["passed"] == False
        assert len(violation_data["violations"]) > 0
        assert violation_data["requiresReview"] == True
        
        # 3. Submit violating content for review
        review_response = self.client.post(
            f"/api/content-policy/projects/{self.test_project_id}/submit-review",
            json={
                "contentId": "violating-content-123",
                "contentType": "story",
                "content": violating_content,
                "isAIGenerated": True
            }
        )
        assert review_response.status_code == 200
        review_id = review_response.json()["reviewId"]
        
        # 4. Get review queue
        queue_response = self.client.get(
            f"/api/content-policy/projects/{self.test_project_id}/review-queue"
        )
        assert queue_response.status_code == 200
        queue_data = queue_response.json()
        assert len(queue_data) >= 1
        assert any(review["id"] == review_id for review in queue_data)
        
        # 5. Review and approve content
        approve_response = self.client.post(
            f"/api/content-policy/reviews/{review_id}",
            json={
                "reviewerId": "admin-reviewer",
                "status": "approved",
                "reviewNotes": "Content has been edited to comply with policy."
            }
        )
        assert approve_response.status_code == 200
        approve_data = approve_response.json()
        assert approve_data["status"] == "approved"
        
    def test_gdpr_compliance_workflow(self):
        """Test complete GDPR compliance workflow"""
        # 1. Export user data
        export_response = self.client.post(
            f"/api/security/projects/{self.test_project_id}/export",
            json={
                "format": "json",
                "includeAuditLogs": True,
                "includeDeleted": False,
                "encryptionKey": "user-encryption-key"
            }
        )
        assert export_response.status_code == 200
        export_data = export_response.json()
        assert "exportId" in export_data
        assert "downloadUrl" in export_data
        assert "checksum" in export_data
        
        # 2. Verify data export contains all required information
        # In a real test, you'd download and verify the export file
        # For now, we'll verify the API response structure
        
        # 3. Test data deletion
        delete_response = self.client.delete(
            f"/api/security/projects/{self.test_project_id}/data",
            json={
                "softDelete": True,
                "deleteAuditLogs": False,
                "deleteExports": False
            }
        )
        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        assert "deletionId" in delete_data
        assert "deletedRecords" in delete_data
        
        # 4. Verify deletion audit trail
        audit_response = self.client.get(f"/api/security/projects/{self.test_project_id}/audit-trail")
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()
        
        # Should have deletion entry
        deletion_entries = [log for log in audit_logs if log["operation"] == "delete"]
        assert len(deletion_entries) >= 1
        
    def test_load_testing_with_security(self):
        """Test system performance under load with security enforcement"""
        import concurrent.futures
        
        def create_content_with_security():
            """Create content with security checks"""
            response = self.client.post(
                f"/api/projects/{self.test_project_id}/story/arcs",
                json={
                    "title": f"Load Test Story {time.time()}",
                    "description": "Testing security under load",
                    "isAIGenerated": True
                },
                headers={"X-AI-Generated": "true"}
            )
            return response.status_code
        
        # Test concurrent content creation with security
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(create_content_with_security) for _ in range(50)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        load_time = time.time() - start_time
        
        # All requests should succeed
        assert all(status == 201 for status in results)
        
        # Should complete within reasonable time
        assert load_time < 60  # 50 requests with security should complete in under 60 seconds
        
        # Verify audit logs are created
        audit_response = self.client.get(f"/api/security/projects/{self.test_project_id}/audit-trail")
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()
        assert len(audit_logs) >= 50  # Should have audit entries for all requests
        
    def test_error_handling_and_recovery(self):
        """Test error handling and recovery in Phase 5 features"""
        # 1. Test export with invalid format
        invalid_export_response = self.client.post(
            f"/api/projects/{self.test_project_id}/exports",
            json={
                "type": "story_graph",
                "format": "invalid_format",
                "includeMetadata": True
            }
        )
        assert invalid_export_response.status_code == 400
        
        # 2. Test security with invalid project
        invalid_security_response = self.client.get("/api/security/projects/invalid-id/audit-trail")
        assert invalid_security_response.status_code == 403
        
        # 3. Test content policy with invalid configuration
        invalid_policy_response = self.client.post(
            f"/api/content-policy/projects/{self.test_project_id}",
            json={
                "ageRating": "INVALID",
                "themes": ["invalid-theme"],
                "violenceLevel": "invalid-level"
            }
        )
        assert invalid_policy_response.status_code == 400
        
        # 4. Test encryption with invalid key
        invalid_encrypt_response = self.client.post(
            f"/api/security/projects/{self.test_project_id}/encrypt-data",
            json={
                "data": "test data",
                "encryptionKey": "invalid-key"
            }
        )
        assert invalid_encrypt_response.status_code == 400
        
        # 5. Test recovery from errors
        # After errors, system should still function normally
        recovery_response = self.client.get(f"/api/projects/{self.test_project_id}")
        assert recovery_response.status_code == 200
        
    def test_integration_with_existing_features(self):
        """Test integration of Phase 5 features with existing Phase 1-4 features"""
        # 1. Test story generation with content policy
        story_response = self.client.post(
            f"/api/projects/{self.test_project_id}/story/arcs",
            json={
                "title": "Policy-Compliant Story",
                "description": "A story that follows content policy guidelines",
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert story_response.status_code == 201
        
        # 2. Test quest design with security
        quest_response = self.client.post(
            f"/api/projects/{self.test_project_id}/quests",
            json={
                "title": "Secure Quest",
                "description": "A quest created with security enforcement",
                "storyArcId": story_response.json()["id"],
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert quest_response.status_code == 201
        
        # 3. Test dialogue generation with audit logging
        dialogue_response = self.client.post(
            f"/api/projects/{self.test_project_id}/dialogues",
            json={
                "content": "Audited dialogue content",
                "characterId": "char-1",
                "questId": quest_response.json()["id"],
                "isAIGenerated": True
            },
            headers={"X-AI-Generated": "true"}
        )
        assert dialogue_response.status_code == 201
        
        # 4. Test simulation with observability
        simulation_response = self.client.post(
            f"/api/projects/{self.test_project_id}/simulations",
            json={
                "name": "Observable Simulation",
                "description": "A simulation with full observability"
            }
        )
        assert simulation_response.status_code == 201
        
        # 5. Test export with all features
        export_response = self.client.post(
            f"/api/projects/{self.test_project_id}/exports",
            json={
                "type": "full_project",
                "format": "json",
                "includeMetadata": True,
                "includeAssets": True
            }
        )
        assert export_response.status_code == 200
        
        # 6. Verify complete integration
        # Check that all features work together
        audit_response = self.client.get(f"/api/security/projects/{self.test_project_id}/audit-trail")
        assert audit_response.status_code == 200
        
        stats_response = self.client.get(f"/api/security/projects/{self.test_project_id}/edit-statistics")
        assert stats_response.status_code == 200
        
        # All operations should be tracked and secured

# Test execution
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
