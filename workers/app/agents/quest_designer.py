from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import logging

logger = logging.getLogger(__name__)

class QuestPattern(BaseModel):
    id: str
    name: str
    description: str
    narrative_beat: str  # rising, climax, resolution
    difficulty: str  # easy, medium, hard, epic
    quest_type: str  # escort, fetch, puzzle, boss, diplomacy, betrayal
    conditions: List[Dict[str, Any]]
    rewards: List[Dict[str, Any]]
    outcomes: List[Dict[str, Any]]
    estimated_duration: int  # minutes
    tags: List[str]

class QuestGenerationRequest(BaseModel):
    project_id: str
    story_arc_id: str
    narrative_beat: str  # rising, climax, resolution
    difficulty: str  # easy, medium, hard, epic
    player_level: int
    available_items: List[str]
    available_stats: List[str]
    world_context: str
    character_context: str
    previous_quests: List[Dict[str, Any]]
    target_duration: Optional[int] = None

class QuestGenerationResponse(BaseModel):
    quest_patterns: List[QuestPattern]
    reasoning: str
    narrative_flow: str
    difficulty_progression: str

class QuestDesignerAgent:
    def __init__(self, openai_api_key: str = None, anthropic_api_key: str = None):
        # Initialize LLM
        if openai_api_key:
            self.llm = ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.7,
                api_key=openai_api_key
            )
        elif anthropic_api_key:
            self.llm = ChatAnthropic(
                model="claude-3-sonnet-20240229",
                temperature=0.7,
                api_key=anthropic_api_key
            )
        else:
            raise ValueError("Either OpenAI or Anthropic API key must be provided")

        # Define quest patterns mapped to narrative beats
        self.quest_patterns = {
            "rising": {
                "introduction": {
                    "name": "Introduction Quest",
                    "description": "Introduce the player to the world and basic mechanics",
                    "quest_type": "fetch",
                    "difficulty": "easy",
                    "conditions": [],
                    "rewards": [{"type": "experience", "value": "basic", "amount": 100}],
                    "outcomes": [
                        {"type": "success", "description": "Successfully completed introduction", "probability": 100}
                    ],
                    "estimated_duration": 15,
                    "tags": ["tutorial", "introduction"]
                },
                "world_building": {
                    "name": "World Building Quest",
                    "description": "Explore the world and learn about the setting",
                    "quest_type": "puzzle",
                    "difficulty": "easy",
                    "conditions": [],
                    "rewards": [{"type": "experience", "value": "exploration", "amount": 150}],
                    "outcomes": [
                        {"type": "success", "description": "Discovered world secrets", "probability": 80},
                        {"type": "partial", "description": "Found some information", "probability": 20}
                    ],
                    "estimated_duration": 25,
                    "tags": ["exploration", "lore"]
                },
                "character_development": {
                    "name": "Character Development Quest",
                    "description": "Develop character relationships and backstory",
                    "quest_type": "diplomacy",
                    "difficulty": "medium",
                    "conditions": [{"type": "stat", "operator": "gte", "value": "charisma", "description": "Minimum charisma required"}],
                    "rewards": [{"type": "stat", "value": "reputation", "amount": 1}],
                    "outcomes": [
                        {"type": "success", "description": "Strengthened relationships", "probability": 70},
                        {"type": "partial", "description": "Made some progress", "probability": 25},
                        {"type": "failure", "description": "Relationships strained", "probability": 5}
                    ],
                    "estimated_duration": 30,
                    "tags": ["character", "relationship"]
                }
            },
            "climax": {
                "confrontation": {
                    "name": "Major Confrontation",
                    "description": "Face a significant challenge or enemy",
                    "quest_type": "boss",
                    "difficulty": "hard",
                    "conditions": [
                        {"type": "quest", "operator": "has", "value": "prerequisite_quest", "description": "Must complete prerequisite quest"},
                        {"type": "stat", "operator": "gte", "value": "combat_skill", "description": "Minimum combat skill required"}
                    ],
                    "rewards": [
                        {"type": "experience", "value": "major", "amount": 500},
                        {"type": "item", "value": "unique_weapon", "amount": 1}
                    ],
                    "outcomes": [
                        {"type": "success", "description": "Defeated the enemy", "probability": 50},
                        {"type": "partial", "description": "Drove enemy away", "probability": 35},
                        {"type": "failure", "description": "Defeated by enemy", "probability": 15}
                    ],
                    "estimated_duration": 45,
                    "tags": ["combat", "boss", "climax"]
                },
                "betrayal": {
                    "name": "Betrayal Quest",
                    "description": "Navigate a situation involving deception and betrayal",
                    "quest_type": "betrayal",
                    "difficulty": "hard",
                    "conditions": [
                        {"type": "flag", "operator": "has", "value": "trust_established", "description": "Must have established trust"}
                    ],
                    "rewards": [
                        {"type": "experience", "value": "intrigue", "amount": 400},
                        {"type": "flag", "value": "betrayal_uncovered", "amount": 1}
                    ],
                    "outcomes": [
                        {"type": "success", "description": "Uncovered the betrayal", "probability": 40},
                        {"type": "branch", "description": "Joined the betrayer", "probability": 30},
                        {"type": "failure", "description": "Fell victim to betrayal", "probability": 30}
                    ],
                    "estimated_duration": 40,
                    "tags": ["intrigue", "betrayal", "choice"]
                },
                "puzzle_climax": {
                    "name": "Ultimate Puzzle",
                    "description": "Solve the most complex puzzle in the story",
                    "quest_type": "puzzle",
                    "difficulty": "epic",
                    "conditions": [
                        {"type": "stat", "operator": "gte", "value": "intelligence", "description": "High intelligence required"},
                        {"type": "item", "operator": "has", "value": "puzzle_key", "description": "Must have puzzle key"}
                    ],
                    "rewards": [
                        {"type": "experience", "value": "mastery", "amount": 1000},
                        {"type": "item", "value": "ancient_artifact", "amount": 1}
                    ],
                    "outcomes": [
                        {"type": "success", "description": "Solved the ultimate puzzle", "probability": 30},
                        {"type": "partial", "description": "Partial solution achieved", "probability": 50},
                        {"type": "failure", "description": "Failed to solve puzzle", "probability": 20}
                    ],
                    "estimated_duration": 60,
                    "tags": ["puzzle", "epic", "intelligence"]
                }
            },
            "resolution": {
                "epilogue": {
                    "name": "Epilogue Quest",
                    "description": "Tie up loose ends and conclude the story",
                    "quest_type": "diplomacy",
                    "difficulty": "medium",
                    "conditions": [
                        {"type": "quest", "operator": "has", "value": "main_story_complete", "description": "Main story must be complete"}
                    ],
                    "rewards": [
                        {"type": "experience", "value": "completion", "amount": 300},
                        {"type": "flag", "value": "story_complete", "amount": 1}
                    ],
                    "outcomes": [
                        {"type": "success", "description": "Story concluded successfully", "probability": 90},
                        {"type": "partial", "description": "Some loose ends remain", "probability": 10}
                    ],
                    "estimated_duration": 20,
                    "tags": ["epilogue", "conclusion"]
                },
                "reward_quest": {
                    "name": "Final Reward",
                    "description": "Receive final rewards and recognition",
                    "quest_type": "fetch",
                    "difficulty": "easy",
                    "conditions": [
                        {"type": "flag", "operator": "has", "value": "story_complete", "description": "Story must be complete"}
                    ],
                    "rewards": [
                        {"type": "experience", "value": "legendary", "amount": 2000},
                        {"type": "item", "value": "legendary_weapon", "amount": 1},
                        {"type": "stat", "value": "legendary_status", "amount": 1}
                    ],
                    "outcomes": [
                        {"type": "success", "description": "Received legendary rewards", "probability": 100}
                    ],
                    "estimated_duration": 15,
                    "tags": ["reward", "legendary", "completion"]
                }
            }
        }

    def generate_quest_patterns(self, request: QuestGenerationRequest) -> QuestGenerationResponse:
        """
        Generate quest patterns based on narrative beat and context
        """
        try:
            # Create the quest designer agent
            quest_designer = Agent(
                role='Quest Design Specialist',
                goal='Design engaging quest patterns that align with narrative beats and player progression',
                backstory="""You are an expert quest designer with deep understanding of narrative structure, 
                player psychology, and game mechanics. You specialize in creating quests that not only 
                advance the story but also provide meaningful player experiences and appropriate challenges.""",
                verbose=True,
                allow_delegation=False,
                llm=self.llm
            )

            # Create the task for quest pattern generation
            quest_task = Task(
                description=f"""
                Analyze the narrative context and generate appropriate quest patterns for the {request.narrative_beat} beat.
                
                Context:
                - Project ID: {request.project_id}
                - Story Arc ID: {request.story_arc_id}
                - Narrative Beat: {request.narrative_beat}
                - Difficulty: {request.difficulty}
                - Player Level: {request.player_level}
                - World Context: {request.world_context}
                - Character Context: {request.character_context}
                - Available Items: {request.available_items}
                - Available Stats: {request.available_stats}
                - Previous Quests: {len(request.previous_quests)} completed
                - Target Duration: {request.target_duration} minutes
                
                Requirements:
                1. Generate 3-5 quest patterns appropriate for the {request.narrative_beat} narrative beat
                2. Ensure difficulty progression from previous quests
                3. Consider player level and available resources
                4. Create meaningful connections to the story and world
                5. Provide varied quest types and experiences
                6. Include appropriate conditions, rewards, and outcomes
                
                Output Format:
                Return a JSON object with:
                - quest_patterns: Array of quest pattern objects
                - reasoning: Explanation of design choices
                - narrative_flow: How these quests advance the story
                - difficulty_progression: How difficulty scales from previous quests
                """,
                agent=quest_designer,
                expected_output="JSON object with quest patterns and analysis"
            )

            # Create and run the crew
            crew = Crew(
                agents=[quest_designer],
                tasks=[quest_task],
                verbose=True,
                process=Process.sequential
            )

            result = crew.kickoff()

            # Parse the result
            try:
                parsed_result = json.loads(result)
                
                # Convert to QuestPattern objects
                quest_patterns = []
                for pattern_data in parsed_result.get('quest_patterns', []):
                    pattern = QuestPattern(
                        id=f"pattern_{len(quest_patterns) + 1}",
                        narrative_beat=request.narrative_beat,
                        **pattern_data
                    )
                    quest_patterns.append(pattern)

                return QuestGenerationResponse(
                    quest_patterns=quest_patterns,
                    reasoning=parsed_result.get('reasoning', ''),
                    narrative_flow=parsed_result.get('narrative_flow', ''),
                    difficulty_progression=parsed_result.get('difficulty_progression', '')
                )

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse quest generation result: {e}")
                # Fallback to template patterns
                return self._generate_fallback_patterns(request)

        except Exception as e:
            logger.error(f"Quest generation failed: {e}")
            return self._generate_fallback_patterns(request)

    def _generate_fallback_patterns(self, request: QuestGenerationRequest) -> QuestGenerationResponse:
        """
        Generate fallback quest patterns using templates
        """
        # Get base patterns for the narrative beat
        base_patterns = self.quest_patterns.get(request.narrative_beat, {})
        
        quest_patterns = []
        for pattern_id, pattern_data in base_patterns.items():
            # Adjust difficulty based on request
            adjusted_pattern = pattern_data.copy()
            if request.difficulty != pattern_data['difficulty']:
                adjusted_pattern['difficulty'] = request.difficulty
                # Adjust rewards based on difficulty
                if request.difficulty == 'easy':
                    adjusted_pattern['rewards'] = [{"type": "experience", "value": "basic", "amount": 100}]
                elif request.difficulty == 'hard':
                    adjusted_pattern['rewards'] = [{"type": "experience", "value": "advanced", "amount": 300}]
                elif request.difficulty == 'epic':
                    adjusted_pattern['rewards'] = [{"type": "experience", "value": "legendary", "amount": 500}]

            # Adjust duration if specified
            if request.target_duration:
                adjusted_pattern['estimated_duration'] = min(request.target_duration, pattern_data['estimated_duration'])

            pattern = QuestPattern(
                id=f"fallback_{pattern_id}",
                narrative_beat=request.narrative_beat,
                **adjusted_pattern
            )
            quest_patterns.append(pattern)

        return QuestGenerationResponse(
            quest_patterns=quest_patterns,
            reasoning="Generated using template patterns due to processing error",
            narrative_flow=f"Standard {request.narrative_beat} beat progression",
            difficulty_progression=f"Adjusted to {request.difficulty} difficulty level"
        )

    def get_pattern_templates(self, narrative_beat: str = None) -> Dict[str, Any]:
        """
        Get quest pattern templates for a specific narrative beat or all beats
        """
        if narrative_beat:
            return self.quest_patterns.get(narrative_beat, {})
        return self.quest_patterns

    def validate_quest_pattern(self, pattern: QuestPattern) -> List[str]:
        """
        Validate a quest pattern for completeness and consistency
        """
        errors = []

        # Check required fields
        if not pattern.name or not pattern.description:
            errors.append("Quest pattern must have name and description")

        if not pattern.outcomes:
            errors.append("Quest pattern must have at least one outcome")

        # Validate outcome probabilities
        total_probability = sum(outcome.get('probability', 0) for outcome in pattern.outcomes)
        if abs(total_probability - 100) > 0.01:
            errors.append(f"Outcome probabilities must sum to 100% (current: {total_probability}%)")

        # Validate difficulty
        valid_difficulties = ['easy', 'medium', 'hard', 'epic']
        if pattern.difficulty not in valid_difficulties:
            errors.append(f"Invalid difficulty: {pattern.difficulty}")

        # Validate quest type
        valid_types = ['escort', 'fetch', 'puzzle', 'boss', 'diplomacy', 'betrayal']
        if pattern.quest_type not in valid_types:
            errors.append(f"Invalid quest type: {pattern.quest_type}")

        # Validate narrative beat
        valid_beats = ['rising', 'climax', 'resolution']
        if pattern.narrative_beat not in valid_beats:
            errors.append(f"Invalid narrative beat: {pattern.narrative_beat}")

        return errors
