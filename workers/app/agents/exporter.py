"""
Exporter Agent for generating exports and design documents.
Handles JSON/YAML exports and PDF/HTML documentation generation.
"""

import json
import yaml
import asyncio
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

from pydantic import BaseModel, Field
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
import jinja2
from weasyprint import HTML, CSS
from markdown import markdown
import aiofiles
import aiohttp

from app.core.config import settings
from app.core.logging import get_logger
from app.models.base import BaseResponse
from app.utils.metrics import record_metric

logger = get_logger(__name__)


class ExportFormat(str, Enum):
    """Supported export formats."""
    JSON = "json"
    YAML = "yaml"
    PDF = "pdf"
    HTML = "html"
    MARKDOWN = "markdown"


class ExportType(str, Enum):
    """Types of content that can be exported."""
    STORY_GRAPH = "story_graph"
    DIALOGUE_TREE = "dialogue_tree"
    QUEST_SCHEMA = "quest_schema"
    LORE_ENCYCLOPEDIA = "lore_encyclopedia"
    SIMULATION_REPORT = "simulation_report"
    DESIGN_DOC = "design_doc"
    FULL_PROJECT = "full_project"


@dataclass
class ExportMetadata:
    """Metadata for export operations."""
    project_id: str
    export_type: ExportType
    format: ExportFormat
    timestamp: datetime
    version: str = "1.0"
    author: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


class StoryGraphExport(BaseModel):
    """Story graph export structure."""
    metadata: ExportMetadata
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    characters: List[Dict[str, Any]]
    locations: List[Dict[str, Any]]
    themes: List[str]
    story_arcs: List[Dict[str, Any]]


class DialogueTreeExport(BaseModel):
    """Dialogue tree export structure."""
    metadata: ExportMetadata
    root_node: Dict[str, Any]
    characters: List[Dict[str, Any]]
    conditions: List[Dict[str, Any]]
    emotions: List[str]
    tones: List[str]
    branching_paths: List[Dict[str, Any]]


class QuestSchemaExport(BaseModel):
    """Quest schema export structure."""
    metadata: ExportMetadata
    quests: List[Dict[str, Any]]
    objectives: List[Dict[str, Any]]
    rewards: List[Dict[str, Any]]
    prerequisites: List[Dict[str, Any]]
    difficulty_levels: List[str]
    quest_chains: List[Dict[str, Any]]


class LoreEncyclopediaExport(BaseModel):
    """Lore encyclopedia export structure."""
    metadata: ExportMetadata
    entries: List[Dict[str, Any]]
    categories: List[Dict[str, Any]]
    factions: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    timeline: List[Dict[str, Any]]


class SimulationReportExport(BaseModel):
    """Simulation report export structure."""
    metadata: ExportMetadata
    simulation_data: Dict[str, Any]
    player_stats: Dict[str, Any]
    reputation_changes: List[Dict[str, Any]]
    alignment_changes: List[Dict[str, Any]]
    quest_progression: List[Dict[str, Any]]
    event_timeline: List[Dict[str, Any]]
    analysis: Dict[str, Any]


class DesignDocExport(BaseModel):
    """Design document export structure."""
    metadata: ExportMetadata
    overview: str
    story_summary: str
    character_profiles: List[Dict[str, Any]]
    world_building: Dict[str, Any]
    gameplay_mechanics: Dict[str, Any]
    technical_specs: Dict[str, Any]
    art_style_guide: Dict[str, Any]
    audio_requirements: Dict[str, Any]


class ExportRequest(BaseModel):
    """Request for export generation."""
    project_id: str
    export_type: ExportType
    format: ExportFormat
    include_metadata: bool = True
    include_assets: bool = False
    compression: bool = False
    custom_template: Optional[str] = None
    output_path: Optional[str] = None


class ExportResponse(BaseResponse):
    """Response from export generation."""
    export_id: str
    file_path: str
    file_size: int
    download_url: Optional[str] = None
    metadata: ExportMetadata
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class ExporterAgent:
    """Agent responsible for generating exports and design documents."""

    def __init__(self):
        self.llm = self._get_llm()
        self.template_env = self._setup_templates()
        self.export_templates = self._load_export_templates()

    def _get_llm(self):
        """Get the appropriate LLM based on configuration."""
        if settings.OPENAI_API_KEY:
            return ChatOpenAI(
                model=settings.OPENAI_MODEL,
                temperature=0.1,
                api_key=settings.OPENAI_API_KEY
            )
        elif settings.ANTHROPIC_API_KEY:
            return ChatAnthropic(
                model=settings.ANTHROPIC_MODEL,
                temperature=0.1,
                api_key=settings.ANTHROPIC_API_KEY
            )
        else:
            raise ValueError("No LLM API key configured")

    def _setup_templates(self) -> jinja2.Environment:
        """Setup Jinja2 template environment."""
        template_dir = Path(__file__).parent.parent / "templates"
        template_dir.mkdir(exist_ok=True)
        
        return jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(template_dir)),
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True
        )

    def _load_export_templates(self) -> Dict[str, str]:
        """Load export templates for different formats."""
        templates = {}
        
        # Create default templates if they don't exist
        template_files = {
            "story_graph_json": "story_graph.json.j2",
            "story_graph_yaml": "story_graph.yaml.j2",
            "dialogue_tree_json": "dialogue_tree.json.j2",
            "dialogue_tree_yaml": "dialogue_tree.yaml.j2",
            "quest_schema_json": "quest_schema.json.j2",
            "quest_schema_yaml": "quest_schema.yaml.j2",
            "design_doc_html": "design_doc.html.j2",
            "design_doc_markdown": "design_doc.md.j2"
        }
        
        for key, filename in template_files.items():
            template_path = Path(__file__).parent.parent / "templates" / filename
            if not template_path.exists():
                self._create_default_template(template_path, key)
            templates[key] = filename
            
        return templates

    def _create_default_template(self, template_path: Path, template_type: str):
        """Create default template files."""
        template_path.parent.mkdir(exist_ok=True)
        
        if template_type.startswith("story_graph"):
            content = self._get_story_graph_template()
        elif template_type.startswith("dialogue_tree"):
            content = self._get_dialogue_tree_template()
        elif template_type.startswith("quest_schema"):
            content = self._get_quest_schema_template()
        elif template_type.startswith("design_doc"):
            content = self._get_design_doc_template()
        else:
            content = "{{ data | tojson(indent=2) }}"
            
        with open(template_path, 'w') as f:
            f.write(content)

    def _get_story_graph_template(self) -> str:
        """Get default story graph template."""
        return """{
  "metadata": {
    "project_id": "{{ metadata.project_id }}",
    "export_type": "{{ metadata.export_type }}",
    "format": "{{ metadata.format }}",
    "timestamp": "{{ metadata.timestamp.isoformat() }}",
    "version": "{{ metadata.version }}",
    "author": "{{ metadata.author or 'AI Game Narrative Generator' }}",
    "description": "{{ metadata.description or 'Exported story graph' }}"
  },
  "story_graph": {
    "nodes": {{ nodes | tojson(indent=4) }},
    "edges": {{ edges | tojson(indent=4) }},
    "characters": {{ characters | tojson(indent=4) }},
    "locations": {{ locations | tojson(indent=4) }},
    "themes": {{ themes | tojson(indent=4) }},
    "story_arcs": {{ story_arcs | tojson(indent=4) }}
  }
}"""

    def _get_dialogue_tree_template(self) -> str:
        """Get default dialogue tree template."""
        return """{
  "metadata": {
    "project_id": "{{ metadata.project_id }}",
    "export_type": "{{ metadata.export_type }}",
    "format": "{{ metadata.format }}",
    "timestamp": "{{ metadata.timestamp.isoformat() }}",
    "version": "{{ metadata.version }}"
  },
  "dialogue_tree": {
    "root_node": {{ root_node | tojson(indent=4) }},
    "characters": {{ characters | tojson(indent=4) }},
    "conditions": {{ conditions | tojson(indent=4) }},
    "emotions": {{ emotions | tojson(indent=4) }},
    "tones": {{ tones | tojson(indent=4) }},
    "branching_paths": {{ branching_paths | tojson(indent=4) }}
  }
}"""

    def _get_quest_schema_template(self) -> str:
        """Get default quest schema template."""
        return """{
  "metadata": {
    "project_id": "{{ metadata.project_id }}",
    "export_type": "{{ metadata.export_type }}",
    "format": "{{ metadata.format }}",
    "timestamp": "{{ metadata.timestamp.isoformat() }}",
    "version": "{{ metadata.version }}"
  },
  "quest_schema": {
    "quests": {{ quests | tojson(indent=4) }},
    "objectives": {{ objectives | tojson(indent=4) }},
    "rewards": {{ rewards | tojson(indent=4) }},
    "prerequisites": {{ prerequisites | tojson(indent=4) }},
    "difficulty_levels": {{ difficulty_levels | tojson(indent=4) }},
    "quest_chains": {{ quest_chains | tojson(indent=4) }}
  }
}"""

    def _get_design_doc_template(self) -> str:
        """Get default design document template."""
        return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ metadata.description or 'Game Design Document' }}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        h1, h2, h3 { color: #333; }
        .section { margin-bottom: 30px; }
        .character-profile { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
        .world-building { background: #f9f9f9; padding: 20px; }
        .mechanics { background: #e8f4f8; padding: 20px; }
        .tech-specs { background: #f0f0f0; padding: 20px; }
    </style>
</head>
<body>
    <h1>{{ metadata.description or 'Game Design Document' }}</h1>
    
    <div class="section">
        <h2>Overview</h2>
        <p>{{ overview }}</p>
    </div>
    
    <div class="section">
        <h2>Story Summary</h2>
        <p>{{ story_summary }}</p>
    </div>
    
    <div class="section">
        <h2>Character Profiles</h2>
        {% for character in character_profiles %}
        <div class="character-profile">
            <h3>{{ character.name }}</h3>
            <p><strong>Role:</strong> {{ character.role }}</p>
            <p><strong>Description:</strong> {{ character.description }}</p>
            {% if character.motivation %}
            <p><strong>Motivation:</strong> {{ character.motivation }}</p>
            {% endif %}
        </div>
        {% endfor %}
    </div>
    
    <div class="section world-building">
        <h2>World Building</h2>
        {% for key, value in world_building.items() %}
        <h3>{{ key.title() }}</h3>
        <p>{{ value }}</p>
        {% endfor %}
    </div>
    
    <div class="section mechanics">
        <h2>Gameplay Mechanics</h2>
        {% for key, value in gameplay_mechanics.items() %}
        <h3>{{ key.title() }}</h3>
        <p>{{ value }}</p>
        {% endfor %}
    </div>
    
    <div class="section tech-specs">
        <h2>Technical Specifications</h2>
        {% for key, value in technical_specs.items() %}
        <h3>{{ key.title() }}</h3>
        <p>{{ value }}</p>
        {% endfor %}
    </div>
    
    <div class="section">
        <h2>Art Style Guide</h2>
        {% for key, value in art_style_guide.items() %}
        <h3>{{ key.title() }}</h3>
        <p>{{ value }}</p>
        {% endfor %}
    </div>
    
    <div class="section">
        <h2>Audio Requirements</h2>
        {% for key, value in audio_requirements.items() %}
        <h3>{{ key.title() }}</h3>
        <p>{{ value }}</p>
        {% endfor %}
    </div>
    
    <footer>
        <p><em>Generated on {{ metadata.timestamp.strftime('%Y-%m-%d %H:%M:%S') }} by {{ metadata.author or 'AI Game Narrative Generator' }}</em></p>
    </footer>
</body>
</html>"""

    async def export_content(self, request: ExportRequest) -> ExportResponse:
        """Generate export based on request."""
        try:
            record_metric("exporter.export_requested", {"type": request.export_type, "format": request.format})
            
            # Create export metadata
            metadata = ExportMetadata(
                project_id=request.project_id,
                export_type=request.export_type,
                format=request.format,
                timestamp=datetime.utcnow()
            )
            
            # Fetch project data
            project_data = await self._fetch_project_data(request.project_id, request.export_type)
            
            # Generate export content
            export_content = await self._generate_export_content(
                project_data, metadata, request
            )
            
            # Save export file
            file_path, file_size = await self._save_export_file(
                export_content, metadata, request
            )
            
            # Generate download URL if needed
            download_url = None
            if request.output_path:
                download_url = f"/exports/{metadata.project_id}/{Path(file_path).name}"
            
            return ExportResponse(
                success=True,
                export_id=f"export_{metadata.project_id}_{metadata.timestamp.strftime('%Y%m%d_%H%M%S')}",
                file_path=file_path,
                file_size=file_size,
                download_url=download_url,
                metadata=metadata,
                warnings=[],
                errors=[]
            )
            
        except Exception as e:
            logger.error(f"Export failed: {str(e)}")
            record_metric("exporter.export_failed", {"error": str(e)})
            
            return ExportResponse(
                success=False,
                export_id="",
                file_path="",
                file_size=0,
                metadata=metadata if 'metadata' in locals() else None,
                warnings=[],
                errors=[str(e)]
            )

    async def _fetch_project_data(self, project_id: str, export_type: ExportType) -> Dict[str, Any]:
        """Fetch project data from API."""
        async with aiohttp.ClientSession() as session:
            base_url = settings.API_BASE_URL
            
            data = {}
            
            if export_type in [ExportType.STORY_GRAPH, ExportType.FULL_PROJECT]:
                # Fetch story graph data
                async with session.get(f"{base_url}/api/v1/story-graphs/{project_id}") as resp:
                    if resp.status == 200:
                        data["story_graph"] = await resp.json()
            
            if export_type in [ExportType.DIALOGUE_TREE, ExportType.FULL_PROJECT]:
                # Fetch dialogue data
                async with session.get(f"{base_url}/api/v1/dialogues/project/{project_id}") as resp:
                    if resp.status == 200:
                        data["dialogues"] = await resp.json()
            
            if export_type in [ExportType.QUEST_SCHEMA, ExportType.FULL_PROJECT]:
                # Fetch quest data
                async with session.get(f"{base_url}/api/v1/quests/project/{project_id}") as resp:
                    if resp.status == 200:
                        data["quests"] = await resp.json()
            
            if export_type in [ExportType.LORE_ENCYCLOPEDIA, ExportType.FULL_PROJECT]:
                # Fetch lore data
                async with session.get(f"{base_url}/api/v1/lore/project/{project_id}") as resp:
                    if resp.status == 200:
                        data["lore"] = await resp.json()
            
            if export_type in [ExportType.SIMULATION_REPORT, ExportType.FULL_PROJECT]:
                # Fetch simulation data
                async with session.get(f"{base_url}/api/v1/simulations/project/{project_id}") as resp:
                    if resp.status == 200:
                        data["simulations"] = await resp.json()
            
            return data

    async def _generate_export_content(
        self, 
        project_data: Dict[str, Any], 
        metadata: ExportMetadata, 
        request: ExportRequest
    ) -> str:
        """Generate export content based on format and type."""
        
        if request.format in [ExportFormat.JSON, ExportFormat.YAML]:
            return await self._generate_structured_export(project_data, metadata, request)
        elif request.format in [ExportFormat.PDF, ExportFormat.HTML, ExportFormat.MARKDOWN]:
            return await self._generate_document_export(project_data, metadata, request)
        else:
            raise ValueError(f"Unsupported format: {request.format}")

    async def _generate_structured_export(
        self, 
        project_data: Dict[str, Any], 
        metadata: ExportMetadata, 
        request: ExportRequest
    ) -> str:
        """Generate structured export (JSON/YAML)."""
        
        # Prepare export data
        export_data = {
            "metadata": asdict(metadata),
            "data": {}
        }
        
        if metadata.export_type == ExportType.STORY_GRAPH:
            export_data["data"] = self._prepare_story_graph_data(project_data.get("story_graph", {}))
        elif metadata.export_type == ExportType.DIALOGUE_TREE:
            export_data["data"] = self._prepare_dialogue_tree_data(project_data.get("dialogues", {}))
        elif metadata.export_type == ExportType.QUEST_SCHEMA:
            export_data["data"] = self._prepare_quest_schema_data(project_data.get("quests", {}))
        elif metadata.export_type == ExportType.LORE_ENCYCLOPEDIA:
            export_data["data"] = self._prepare_lore_data(project_data.get("lore", {}))
        elif metadata.export_type == ExportType.SIMULATION_REPORT:
            export_data["data"] = self._prepare_simulation_data(project_data.get("simulations", {}))
        elif metadata.export_type == ExportType.FULL_PROJECT:
            export_data["data"] = {
                "story_graph": self._prepare_story_graph_data(project_data.get("story_graph", {})),
                "dialogues": self._prepare_dialogue_tree_data(project_data.get("dialogues", {})),
                "quests": self._prepare_quest_schema_data(project_data.get("quests", {})),
                "lore": self._prepare_lore_data(project_data.get("lore", {})),
                "simulations": self._prepare_simulation_data(project_data.get("simulations", {}))
            }
        
        # Convert to requested format
        if request.format == ExportFormat.JSON:
            return json.dumps(export_data, indent=2, default=str)
        elif request.format == ExportFormat.YAML:
            return yaml.dump(export_data, default_flow_style=False, allow_unicode=True)

    async def _generate_document_export(
        self, 
        project_data: Dict[str, Any], 
        metadata: ExportMetadata, 
        request: ExportRequest
    ) -> str:
        """Generate document export (PDF/HTML/Markdown)."""
        
        # Prepare document data
        doc_data = {
            "metadata": metadata,
            "overview": "Generated game design document",
            "story_summary": "Comprehensive story overview",
            "character_profiles": [],
            "world_building": {},
            "gameplay_mechanics": {},
            "technical_specs": {},
            "art_style_guide": {},
            "audio_requirements": {}
        }
        
        # Enhance with project data
        if project_data.get("story_graph"):
            doc_data.update(self._extract_story_doc_data(project_data["story_graph"]))
        
        if project_data.get("dialogues"):
            doc_data["character_profiles"].extend(self._extract_character_profiles(project_data["dialogues"]))
        
        if project_data.get("quests"):
            doc_data["gameplay_mechanics"].update(self._extract_quest_mechanics(project_data["quests"]))
        
        # Generate document using template
        template_name = f"design_doc_{request.format}"
        if template_name in self.export_templates:
            template = self.template_env.get_template(self.export_templates[template_name])
            return template.render(**doc_data)
        else:
            # Fallback to markdown
            return self._generate_markdown_doc(doc_data)

    def _prepare_story_graph_data(self, story_graph: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare story graph data for export."""
        return {
            "nodes": story_graph.get("nodes", []),
            "edges": story_graph.get("edges", []),
            "characters": story_graph.get("characters", []),
            "locations": story_graph.get("locations", []),
            "themes": story_graph.get("themes", []),
            "story_arcs": story_graph.get("story_arcs", [])
        }

    def _prepare_dialogue_tree_data(self, dialogues: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare dialogue tree data for export."""
        return {
            "root_node": dialogues.get("root_node", {}),
            "characters": dialogues.get("characters", []),
            "conditions": dialogues.get("conditions", []),
            "emotions": dialogues.get("emotions", []),
            "tones": dialogues.get("tones", []),
            "branching_paths": dialogues.get("branching_paths", [])
        }

    def _prepare_quest_schema_data(self, quests: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare quest schema data for export."""
        return {
            "quests": quests.get("quests", []),
            "objectives": quests.get("objectives", []),
            "rewards": quests.get("rewards", []),
            "prerequisites": quests.get("prerequisites", []),
            "difficulty_levels": quests.get("difficulty_levels", []),
            "quest_chains": quests.get("quest_chains", [])
        }

    def _prepare_lore_data(self, lore: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare lore data for export."""
        return {
            "entries": lore.get("entries", []),
            "categories": lore.get("categories", []),
            "factions": lore.get("factions", []),
            "relationships": lore.get("relationships", []),
            "timeline": lore.get("timeline", [])
        }

    def _prepare_simulation_data(self, simulations: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare simulation data for export."""
        return {
            "simulation_data": simulations.get("simulation_data", {}),
            "player_stats": simulations.get("player_stats", {}),
            "reputation_changes": simulations.get("reputation_changes", []),
            "alignment_changes": simulations.get("alignment_changes", []),
            "quest_progression": simulations.get("quest_progression", []),
            "event_timeline": simulations.get("event_timeline", []),
            "analysis": simulations.get("analysis", {})
        }

    def _extract_story_doc_data(self, story_graph: Dict[str, Any]) -> Dict[str, Any]:
        """Extract story data for design document."""
        return {
            "story_summary": story_graph.get("summary", "Story summary not available"),
            "world_building": {
                "setting": story_graph.get("setting", "Setting not specified"),
                "time_period": story_graph.get("time_period", "Time period not specified"),
                "atmosphere": story_graph.get("atmosphere", "Atmosphere not specified")
            }
        }

    def _extract_character_profiles(self, dialogues: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract character profiles from dialogue data."""
        characters = dialogues.get("characters", [])
        return [
            {
                "name": char.get("name", "Unknown"),
                "role": char.get("role", "Supporting"),
                "description": char.get("description", "No description available"),
                "motivation": char.get("motivation", "Motivation not specified")
            }
            for char in characters
        ]

    def _extract_quest_mechanics(self, quests: Dict[str, Any]) -> Dict[str, Any]:
        """Extract quest mechanics for design document."""
        return {
            "quest_types": quests.get("quest_types", []),
            "difficulty_progression": quests.get("difficulty_progression", {}),
            "reward_system": quests.get("reward_system", {})
        }

    def _generate_markdown_doc(self, doc_data: Dict[str, Any]) -> str:
        """Generate markdown document as fallback."""
        md_content = f"# {doc_data['metadata'].description or 'Game Design Document'}\n\n"
        md_content += f"**Generated:** {doc_data['metadata'].timestamp.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        
        md_content += f"## Overview\n\n{doc_data['overview']}\n\n"
        md_content += f"## Story Summary\n\n{doc_data['story_summary']}\n\n"
        
        if doc_data['character_profiles']:
            md_content += "## Character Profiles\n\n"
            for char in doc_data['character_profiles']:
                md_content += f"### {char['name']}\n"
                md_content += f"- **Role:** {char['role']}\n"
                md_content += f"- **Description:** {char['description']}\n"
                if char.get('motivation'):
                    md_content += f"- **Motivation:** {char['motivation']}\n"
                md_content += "\n"
        
        return md_content

    async def _save_export_file(
        self, 
        content: str, 
        metadata: ExportMetadata, 
        request: ExportRequest
    ) -> tuple[str, int]:
        """Save export file and return path and size."""
        
        # Create export directory
        export_dir = Path(settings.EXPORT_DIR) / metadata.project_id
        export_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        timestamp = metadata.timestamp.strftime("%Y%m%d_%H%M%S")
        filename = f"{metadata.export_type}_{timestamp}.{metadata.format}"
        file_path = export_dir / filename
        
        # Save file
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(content)
        
        # Get file size
        file_size = file_path.stat().st_size
        
        # Convert to PDF if requested
        if request.format == ExportFormat.PDF and metadata.format == ExportFormat.HTML:
            pdf_path = file_path.with_suffix('.pdf')
            await self._convert_html_to_pdf(file_path, pdf_path)
            file_path = pdf_path
            file_size = pdf_path.stat().st_size
        
        return str(file_path), file_size

    async def _convert_html_to_pdf(self, html_path: Path, pdf_path: Path):
        """Convert HTML file to PDF using WeasyPrint."""
        try:
            html = HTML(filename=str(html_path))
            html.write_pdf(str(pdf_path))
        except Exception as e:
            logger.error(f"PDF conversion failed: {str(e)}")
            raise

    async def generate_batch_exports(self, requests: List[ExportRequest]) -> List[ExportResponse]:
        """Generate multiple exports in batch."""
        tasks = [self.export_content(req) for req in requests]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def validate_export_ready(self, project_id: str) -> Dict[str, Any]:
        """Validate that project is ready for export."""
        try:
            async with aiohttp.ClientSession() as session:
                base_url = settings.API_BASE_URL
                
                # Check various endpoints
                checks = {}
                
                # Story graph check
                async with session.get(f"{base_url}/api/v1/story-graphs/{project_id}") as resp:
                    checks["story_graph"] = resp.status == 200
                
                # Dialogue check
                async with session.get(f"{base_url}/api/v1/dialogues/project/{project_id}") as resp:
                    checks["dialogues"] = resp.status == 200
                
                # Quest check
                async with session.get(f"{base_url}/api/v1/quests/project/{project_id}") as resp:
                    checks["quests"] = resp.status == 200
                
                # Lore check
                async with session.get(f"{base_url}/api/v1/lore/project/{project_id}") as resp:
                    checks["lore"] = resp.status == 200
                
                # Overall readiness
                checks["ready"] = all(checks.values())
                
                return checks
                
        except Exception as e:
            logger.error(f"Export validation failed: {str(e)}")
            return {"ready": False, "error": str(e)}
