from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
import uuid
import json
from typing import Dict, Any, Optional
import asyncio

from app.core.config import settings

class StoryArchitectAgent:
    """Story Architect agent for creating branching story arcs"""
    
    def __init__(self):
        self.llm = self._get_llm()
        self.agent = self._create_agent()
    
    def _get_llm(self):
        """Get the appropriate LLM based on available API keys"""
        if settings.OPENAI_API_KEY:
            return ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.7,
                api_key=settings.OPENAI_API_KEY
            )
        elif settings.ANTHROPIC_API_KEY:
            return ChatAnthropic(
                model="claude-3-sonnet-20240229",
                temperature=0.7,
                api_key=settings.ANTHROPIC_API_KEY
            )
        else:
            raise ValueError("No AI API key configured")
    
    def _create_agent(self) -> Agent:
        """Create the Story Architect agent"""
        return Agent(
            role="Story Architect",
            goal="Create compelling, branching story arcs that engage players and provide meaningful choices",
            backstory="""You are an expert story architect with decades of experience in game narrative design. 
            You specialize in creating branching storylines that adapt to player choices while maintaining 
            narrative coherence and emotional impact. You understand pacing, character development, and 
            the delicate balance between player agency and narrative structure.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )
    
    async def generate_story_arc(
        self,
        project_id: str,
        title: str,
        description: Optional[str] = None,
        genre: str = "fantasy",
        target_audience: str = "teen",
        complexity_level: str = "medium",
        user_id: str = None
    ) -> Dict[str, Any]:
        """Generate a new story arc"""
        
        # Create the story generation task
        task = Task(
            description=f"""
            Create a compelling story arc for a {genre} game targeting {target_audience} audience.
            
            Project Title: {title}
            Description: {description or "No description provided"}
            Complexity Level: {complexity_level}
            
            Requirements:
            1. Create a main story arc with 3-5 major story beats
            2. Include 2-3 branching points where player choices matter
            3. Design character motivations and conflicts
            4. Ensure the story fits the target audience and genre
            5. Include emotional highs and lows for pacing
            6. Make choices meaningful and impactful
            
            Output Format (JSON):
            {{
                "story_arc": {{
                    "title": "Story title",
                    "description": "Story description",
                    "genre": "{genre}",
                    "target_audience": "{target_audience}",
                    "complexity_level": "{complexity_level}",
                    "story_beats": [
                        {{
                            "id": "beat_1",
                            "title": "Beat title",
                            "description": "Beat description",
                            "type": "setup|rising_action|climax|falling_action|resolution",
                            "branching_points": [
                                {{
                                    "id": "choice_1",
                                    "description": "Player choice description",
                                    "options": [
                                        {{
                                            "id": "option_1",
                                            "text": "Choice text",
                                            "consequences": ["consequence 1", "consequence 2"],
                                            "next_beat": "beat_2"
                                        }}
                                    ]
                                }}
                            ]
                        }}
                    ],
                    "characters": [
                        {{
                            "id": "char_1",
                            "name": "Character name",
                            "role": "protagonist|antagonist|supporting",
                            "description": "Character description",
                            "motivation": "Character motivation"
                        }}
                    ],
                    "themes": ["theme1", "theme2"],
                    "estimated_duration": "2-3 hours"
                }},
                "reasoning_trace": "Detailed explanation of creative decisions and narrative structure"
            }}
            """,
            agent=self.agent,
            expected_output="JSON object with story arc structure and reasoning trace"
        )
        
        # Create and run the crew
        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )
        
        # Execute the task
        result = crew.kickoff()
        
        # Parse the result
        try:
            # Extract JSON from the result
            json_start = result.find('{')
            json_end = result.rfind('}') + 1
            json_str = result[json_start:json_end]
            
            parsed_result = json.loads(json_str)
            
            # Generate story arc ID
            story_arc_id = str(uuid.uuid4())
            
            return {
                "story_arc_id": story_arc_id,
                "story_arc": parsed_result.get("story_arc", {}),
                "reasoning_trace": parsed_result.get("reasoning_trace", ""),
                "project_id": project_id,
                "user_id": user_id
            }
            
        except (json.JSONDecodeError, KeyError) as e:
            # Fallback: create a basic structure from the text
            story_arc_id = str(uuid.uuid4())
            
            return {
                "story_arc_id": story_arc_id,
                "story_arc": {
                    "title": title,
                    "description": description or "Generated story arc",
                    "genre": genre,
                    "target_audience": target_audience,
                    "complexity_level": complexity_level,
                    "story_beats": [],
                    "characters": [],
                    "themes": [],
                    "estimated_duration": "2-3 hours"
                },
                "reasoning_trace": result,
                "project_id": project_id,
                "user_id": user_id
            }
