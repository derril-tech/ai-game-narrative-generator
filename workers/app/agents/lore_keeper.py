from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
import numpy as np
from sentence_transformers import SentenceTransformer
import logging
import time

logger = logging.getLogger(__name__)

class LoreEntry(BaseModel):
    id: str
    title: str
    content: str
    category: str
    tags: List[str] = []
    canon_status: str = "canon"
    version: int = 1
    created_at: str
    updated_at: str
    warnings: List[str] = []
    related_entries: List[str] = []
    faction_relations: Dict[str, float] = {}

class FactionRelation(BaseModel):
    faction1: str
    faction2: str
    relationship_type: str  # ally, enemy, neutral, trade_partner, etc.
    strength: float  # -1.0 to 1.0
    description: str
    historical_context: str

class LoreConsistencyCheck(BaseModel):
    entry_id: str
    is_consistent: bool
    issues: List[str]
    suggestions: List[str]
    confidence_score: float
    related_entries: List[str]
    faction_implications: List[str]

class LoreGenerationRequest(BaseModel):
    project_id: str
    category: str
    title: str
    content: str
    tags: List[str] = []
    existing_lore: List[LoreEntry] = []
    faction_context: Dict[str, Any] = {}
    world_context: str = ""
    character_context: str = ""

class LoreGenerationResponse(BaseModel):
    lore_entry: LoreEntry
    consistency_check: LoreConsistencyCheck
    faction_relations: List[FactionRelation]
    suggestions: List[str]
    generation_time: float
    model_used: str

class LoreKeeperAgent:
    def __init__(self, openai_api_key: str = None, anthropic_api_key: str = None):
        self.openai_api_key = openai_api_key
        self.anthropic_api_key = anthropic_api_key
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize LLM
        if openai_api_key:
            self.llm = ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.3,
                api_key=openai_api_key
            )
        elif anthropic_api_key:
            self.llm = ChatAnthropic(
                model="claude-3-sonnet-20240229",
                temperature=0.3,
                api_key=anthropic_api_key
            )
        else:
            raise ValueError("Either OpenAI or Anthropic API key must be provided")
        
        # Initialize the agent
        self.agent = Agent(
            role="Lore Keeper",
            goal="Maintain consistency and coherence in the game world's lore, ensuring all entries align with established canon and faction dynamics",
            backstory="""You are a meticulous Lore Keeper responsible for maintaining the integrity of the game world's knowledge base. 
            You have deep understanding of world-building, character development, and faction dynamics. 
            You ensure that all lore entries are consistent with existing canon, properly categorized, and contribute meaningfully to the world's narrative fabric.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )

    def generate_lore_entry(self, request: LoreGenerationRequest) -> LoreGenerationResponse:
        """Generate a new lore entry with consistency checks and faction implications"""
        start_time = time.time()
        
        try:
            # Create the lore generation task
            task = Task(
                description=f"""Generate a comprehensive lore entry for the following request:
                
                Category: {request.category}
                Title: {request.title}
                Content: {request.content}
                Tags: {', '.join(request.tags)}
                World Context: {request.world_context}
                Character Context: {request.character_context}
                
                Existing Lore Count: {len(request.existing_lore)}
                Faction Context: {request.faction_context}
                
                Requirements:
                1. Create a detailed lore entry that expands on the provided content
                2. Ensure consistency with existing lore entries
                3. Identify potential faction implications and relationships
                4. Suggest appropriate tags and categories
                5. Flag any potential contradictions or inconsistencies
                6. Provide suggestions for related lore entries
                
                Output the result as a JSON object with the following structure:
                {{
                    "lore_entry": {{
                        "id": "generated_id",
                        "title": "enhanced_title",
                        "content": "expanded_content",
                        "category": "category",
                        "tags": ["tag1", "tag2"],
                        "canon_status": "canon|semi_canon|non_canon|contradictory",
                        "warnings": ["warning1", "warning2"],
                        "related_entries": ["entry_id1", "entry_id2"],
                        "faction_relations": {{"faction1": 0.5, "faction2": -0.3}}
                    }},
                    "consistency_issues": ["issue1", "issue2"],
                    "suggestions": ["suggestion1", "suggestion2"],
                    "faction_implications": ["implication1", "implication2"]
                }}""",
                agent=self.agent
            )
            
            # Execute the task
            crew = Crew(
                agents=[self.agent],
                tasks=[task],
                process=Process.sequential,
                verbose=True
            )
            
            result = crew.kickoff()
            
            # Parse the result (this would need proper JSON parsing in a real implementation)
            # For now, we'll create a structured response
            lore_entry = self._create_lore_entry_from_result(request, result)
            
            # Perform consistency checks
            consistency_check = self._perform_consistency_checks(lore_entry, request.existing_lore)
            
            # Analyze faction implications
            faction_relations = self._analyze_faction_implications(lore_entry, request.faction_context)
            
            generation_time = time.time() - start_time
            
            return LoreGenerationResponse(
                lore_entry=lore_entry,
                consistency_check=consistency_check,
                faction_relations=faction_relations,
                suggestions=self._generate_suggestions(lore_entry, request.existing_lore),
                generation_time=generation_time,
                model_used="lore_keeper_v1"
            )
            
        except Exception as e:
            logger.error(f"Lore generation failed: {str(e)}")
            # Return a fallback response
            return self._generate_fallback_response(request, start_time)

    def check_lore_consistency(self, lore_entries: List[LoreEntry]) -> List[LoreConsistencyCheck]:
        """Check consistency across multiple lore entries"""
        results = []
        
        for entry in lore_entries:
            # Check against other entries
            issues = []
            suggestions = []
            related_entries = []
            
            # Semantic similarity check
            entry_embedding = self.embedding_model.encode(entry.content)
            
            for other_entry in lore_entries:
                if other_entry.id == entry.id:
                    continue
                    
                other_embedding = self.embedding_model.encode(other_entry.content)
                similarity = np.dot(entry_embedding, other_embedding) / (
                    np.linalg.norm(entry_embedding) * np.linalg.norm(other_embedding)
                )
                
                if similarity > 0.8:
                    related_entries.append(other_entry.id)
                    
                    # Check for contradictions
                    if self._detect_contradiction(entry, other_entry):
                        issues.append(f"Potential contradiction with {other_entry.title}")
                        suggestions.append(f"Review and reconcile differences with {other_entry.title}")
            
            # Check canon status consistency
            if entry.canon_status == "contradictory":
                issues.append("Entry marked as contradictory")
                suggestions.append("Review and resolve contradictions before finalizing")
            
            # Check category appropriateness
            if not self._validate_category(entry.category, entry.content):
                issues.append("Category may not match content")
                suggestions.append("Consider re-categorizing the entry")
            
            confidence_score = max(0, 1 - (len(issues) * 0.2))
            
            results.append(LoreConsistencyCheck(
                entry_id=entry.id,
                is_consistent=len(issues) == 0,
                issues=issues,
                suggestions=suggestions,
                confidence_score=confidence_score,
                related_entries=related_entries,
                faction_implications=self._extract_faction_implications(entry)
            ))
        
        return results

    def analyze_faction_dynamics(self, lore_entries: List[LoreEntry]) -> List[FactionRelation]:
        """Analyze faction relationships and dynamics from lore entries"""
        faction_relations = {}
        
        for entry in lore_entries:
            # Extract faction mentions
            factions = self._extract_factions_from_content(entry.content)
            
            for i, faction1 in enumerate(factions):
                for faction2 in factions[i+1:]:
                    relation_key = tuple(sorted([faction1, faction2]))
                    
                    if relation_key not in faction_relations:
                        faction_relations[relation_key] = {
                            'mentions': 0,
                            'positive_mentions': 0,
                            'negative_mentions': 0,
                            'contexts': []
                        }
                    
                    faction_relations[relation_key]['mentions'] += 1
                    
                    # Analyze sentiment between factions
                    sentiment = self._analyze_faction_sentiment(entry.content, faction1, faction2)
                    if sentiment > 0.3:
                        faction_relations[relation_key]['positive_mentions'] += 1
                    elif sentiment < -0.3:
                        faction_relations[relation_key]['negative_mentions'] += 1
                    
                    faction_relations[relation_key]['contexts'].append({
                        'entry_id': entry.id,
                        'entry_title': entry.title,
                        'sentiment': sentiment
                    })
        
        # Convert to FactionRelation objects
        relations = []
        for (faction1, faction2), data in faction_relations.items():
            if data['mentions'] >= 2:  # Only include if mentioned multiple times
                # Calculate overall relationship strength
                total_sentiment = sum(ctx['sentiment'] for ctx in data['contexts'])
                avg_sentiment = total_sentiment / len(data['contexts'])
                
                # Determine relationship type
                if avg_sentiment > 0.5:
                    relationship_type = "ally"
                elif avg_sentiment < -0.5:
                    relationship_type = "enemy"
                elif avg_sentiment > 0.1:
                    relationship_type = "trade_partner"
                elif avg_sentiment < -0.1:
                    relationship_type = "rival"
                else:
                    relationship_type = "neutral"
                
                relations.append(FactionRelation(
                    faction1=faction1,
                    faction2=faction2,
                    relationship_type=relationship_type,
                    strength=avg_sentiment,
                    description=self._generate_relationship_description(faction1, faction2, relationship_type, avg_sentiment),
                    historical_context=self._extract_historical_context(data['contexts'])
                ))
        
        return relations

    def validate_lore_for_export(self, lore_entries: List[LoreEntry]) -> Dict[str, Any]:
        """Validate lore entries before export to ensure consistency and completeness"""
        validation_result = {
            'is_ready_for_export': True,
            'issues': [],
            'warnings': [],
            'suggestions': [],
            'missing_categories': [],
            'contradictions': [],
            'faction_gaps': []
        }
        
        # Check for missing essential categories
        essential_categories = ['character', 'location', 'faction', 'event']
        present_categories = set(entry.category for entry in lore_entries)
        missing_categories = set(essential_categories) - present_categories
        
        if missing_categories:
            validation_result['missing_categories'] = list(missing_categories)
            validation_result['warnings'].append(f"Missing essential categories: {', '.join(missing_categories)}")
        
        # Check for contradictions
        consistency_checks = self.check_lore_consistency(lore_entries)
        contradictions = [check for check in consistency_checks if not check.is_consistent]
        
        if contradictions:
            validation_result['contradictions'] = [check.entry_id for check in contradictions]
            validation_result['issues'].append(f"Found {len(contradictions)} inconsistent entries")
            validation_result['is_ready_for_export'] = False
        
        # Check faction coverage
        all_factions = set()
        for entry in lore_entries:
            if entry.faction_relations:
                all_factions.update(entry.faction_relations.keys())
        
        if len(all_factions) < 2:
            validation_result['faction_gaps'].append("Insufficient faction coverage")
            validation_result['suggestions'].append("Consider adding more faction-related lore")
        
        # Check for orphaned entries (no related entries)
        orphaned_entries = [entry for entry in lore_entries if not entry.related_entries]
        if orphaned_entries:
            validation_result['warnings'].append(f"Found {len(orphaned_entries)} entries with no connections")
            validation_result['suggestions'].append("Consider adding cross-references between related entries")
        
        return validation_result

    def _create_lore_entry_from_result(self, request: LoreGenerationRequest, result: str) -> LoreEntry:
        """Create a LoreEntry from the AI generation result"""
        # In a real implementation, this would parse the JSON result
        # For now, we'll create a structured entry
        return LoreEntry(
            id=f"lore_{int(time.time())}",
            title=request.title,
            content=request.content,
            category=request.category,
            tags=request.tags,
            canon_status="canon",
            version=1,
            created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            updated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            warnings=[],
            related_entries=[],
            faction_relations={}
        )

    def _perform_consistency_checks(self, entry: LoreEntry, existing_lore: List[LoreEntry]) -> LoreConsistencyCheck:
        """Perform consistency checks on a single lore entry"""
        issues = []
        suggestions = []
        related_entries = []
        
        # Check against existing lore
        for existing in existing_lore:
            similarity = self._calculate_similarity(entry.content, existing.content)
            if similarity > 0.7:
                related_entries.append(existing.id)
                if self._detect_contradiction(entry, existing):
                    issues.append(f"Contradicts existing lore: {existing.title}")
                    suggestions.append(f"Review and reconcile with {existing.title}")
        
        confidence_score = max(0, 1 - (len(issues) * 0.2))
        
        return LoreConsistencyCheck(
            entry_id=entry.id,
            is_consistent=len(issues) == 0,
            issues=issues,
            suggestions=suggestions,
            confidence_score=confidence_score,
            related_entries=related_entries,
            faction_implications=self._extract_faction_implications(entry)
        )

    def _analyze_faction_implications(self, entry: LoreEntry, faction_context: Dict[str, Any]) -> List[FactionRelation]:
        """Analyze faction implications of a lore entry"""
        # This would use more sophisticated NLP in a real implementation
        # For now, return empty list
        return []

    def _generate_suggestions(self, entry: LoreEntry, existing_lore: List[LoreEntry]) -> List[str]:
        """Generate suggestions for improving the lore entry"""
        suggestions = []
        
        if len(entry.content) < 100:
            suggestions.append("Consider expanding the content for more detail")
        
        if not entry.tags:
            suggestions.append("Add relevant tags for better categorization")
        
        if not entry.related_entries:
            suggestions.append("Consider linking to related lore entries")
        
        return suggestions

    def _generate_fallback_response(self, request: LoreGenerationRequest, start_time: float) -> LoreGenerationResponse:
        """Generate a fallback response when AI generation fails"""
        lore_entry = LoreEntry(
            id=f"lore_{int(time.time())}",
            title=request.title,
            content=request.content,
            category=request.category,
            tags=request.tags,
            canon_status="semi_canon",
            version=1,
            created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            updated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            warnings=["Generated using fallback method"],
            related_entries=[],
            faction_relations={}
        )
        
        consistency_check = LoreConsistencyCheck(
            entry_id=lore_entry.id,
            is_consistent=True,
            issues=[],
            suggestions=["Review and enhance this entry manually"],
            confidence_score=0.5,
            related_entries=[],
            faction_implications=[]
        )
        
        return LoreGenerationResponse(
            lore_entry=lore_entry,
            consistency_check=consistency_check,
            faction_relations=[],
            suggestions=["Review and enhance this entry manually"],
            generation_time=time.time() - start_time,
            model_used="fallback"
        )

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate semantic similarity between two texts"""
        embedding1 = self.embedding_model.encode(text1)
        embedding2 = self.embedding_model.encode(text2)
        
        return np.dot(embedding1, embedding2) / (
            np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
        )

    def _detect_contradiction(self, entry1: LoreEntry, entry2: LoreEntry) -> bool:
        """Detect contradictions between two lore entries"""
        # This would use more sophisticated contradiction detection
        # For now, check for simple keyword conflicts
        keywords1 = set(entry1.content.lower().split())
        keywords2 = set(entry2.content.lower().split())
        
        # Simple heuristic: if they share many keywords but have different facts
        common_keywords = keywords1.intersection(keywords2)
        if len(common_keywords) > 5:
            # This is a very basic check - real implementation would be more sophisticated
            return False
        
        return False

    def _validate_category(self, category: str, content: str) -> bool:
        """Validate if the category matches the content"""
        # This would use more sophisticated validation
        # For now, return True
        return True

    def _extract_faction_implications(self, entry: LoreEntry) -> List[str]:
        """Extract faction implications from a lore entry"""
        # This would use NLP to extract faction-related implications
        # For now, return empty list
        return []

    def _extract_factions_from_content(self, content: str) -> List[str]:
        """Extract faction names from content"""
        # This would use NER or pattern matching
        # For now, return empty list
        return []

    def _analyze_faction_sentiment(self, content: str, faction1: str, faction2: str) -> float:
        """Analyze sentiment between two factions in content"""
        # This would use sentiment analysis
        # For now, return 0 (neutral)
        return 0.0

    def _generate_relationship_description(self, faction1: str, faction2: str, relationship_type: str, strength: float) -> str:
        """Generate a description of the relationship between two factions"""
        return f"{faction1} and {faction2} have a {relationship_type} relationship with strength {strength:.2f}"

    def _extract_historical_context(self, contexts: List[Dict[str, Any]]) -> str:
        """Extract historical context from multiple contexts"""
        return "Historical context would be extracted here"

    def get_pattern_templates(self, category: str = None) -> Dict[str, Any]:
        """Get lore generation templates for different categories"""
        templates = {
            'character': {
                'structure': ['background', 'personality', 'relationships', 'goals'],
                'prompts': [
                    "Describe the character's background and origins",
                    "What are their key personality traits?",
                    "Who are their allies and enemies?",
                    "What are their current goals and motivations?"
                ]
            },
            'location': {
                'structure': ['geography', 'history', 'inhabitants', 'significance'],
                'prompts': [
                    "Describe the physical geography and features",
                    "What is the history of this location?",
                    "Who lives here and what is their culture?",
                    "Why is this location significant to the story?"
                ]
            },
            'faction': {
                'structure': ['ideology', 'leadership', 'resources', 'relationships'],
                'prompts': [
                    "What are the faction's core beliefs and ideology?",
                    "Who leads the faction and how is it organized?",
                    "What resources and capabilities does it have?",
                    "How does it relate to other factions?"
                ]
            },
            'event': {
                'structure': ['timeline', 'participants', 'consequences', 'significance'],
                'prompts': [
                    "When did this event occur and what was the timeline?",
                    "Who were the key participants and witnesses?",
                    "What were the immediate and long-term consequences?",
                    "Why is this event significant to the world's history?"
                ]
            }
        }
        
        if category:
            return templates.get(category, {})
        return templates

    def validate_lore_pattern(self, pattern: Dict[str, Any]) -> List[str]:
        """Validate a lore generation pattern"""
        errors = []
        
        required_fields = ['structure', 'prompts']
        for field in required_fields:
            if field not in pattern:
                errors.append(f"Missing required field: {field}")
        
        if 'structure' in pattern and not isinstance(pattern['structure'], list):
            errors.append("Structure must be a list")
        
        if 'prompts' in pattern and not isinstance(pattern['prompts'], list):
            errors.append("Prompts must be a list")
        
        return errors
