# AI Game Narrative Generator

Dynamic AI-driven worlds where CrewAI agents collaborate to create branching storylines, quests, and dialogue—tailored to each player's choices.

## 🎯 Product Overview

### What is the AI Game Narrative Generator?

The AI Game Narrative Generator is a comprehensive, AI-powered platform designed to revolutionize game development by automating and enhancing the creation of interactive narrative content. It's a sophisticated tool that combines multiple AI agents working in harmony to generate rich, branching storylines, quests, dialogue trees, and lore systems that adapt to player choices and maintain narrative consistency.

### What does the product do?

The platform provides a complete narrative generation ecosystem that:

1. **Creates Dynamic Story Arcs**: Generates branching storylines with multiple paths and outcomes based on player decisions
2. **Designs Interactive Quests**: Builds quest structures with conditions, rewards, and multiple completion paths
3. **Generates NPC Dialogue**: Creates realistic dialogue trees with emotional depth, character voice, and contextual awareness
4. **Manages Lore Systems**: Maintains a comprehensive encyclopedia of game world lore with semantic search and consistency validation
5. **Simulates Player Experiences**: Runs playthrough simulations to test narrative flow and player choice impact
6. **Exports Game-Ready Content**: Packages generated content in formats compatible with popular game engines
7. **Enforces Content Policies**: Implements age-appropriate content filtering and review systems
8. **Provides Security & Compliance**: Offers GDPR-compliant data management with encryption and audit trails

### Benefits of the product

#### For Game Developers
- **Accelerated Development**: Reduce narrative design time from months to days
- **Cost Efficiency**: Lower development costs by automating repetitive content creation tasks
- **Scalability**: Generate vast amounts of content without proportional increases in human resources
- **Consistency**: Maintain narrative coherence across large game worlds with AI-powered validation
- **Iteration Speed**: Quickly prototype and test different narrative paths and outcomes

#### For Game Designers
- **Creative Augmentation**: AI agents serve as creative collaborators, not replacements
- **Complex Branching**: Create intricate dialogue trees and quest structures that would be impractical manually
- **Player Choice Integration**: Seamlessly incorporate player decisions into ongoing narrative development
- **Lore Management**: Maintain complex world-building elements with automatic consistency checking
- **Rapid Prototyping**: Test narrative concepts quickly through simulation and preview tools

#### For Game Studios
- **Quality Assurance**: Built-in content policy enforcement and age-appropriate filtering
- **Risk Mitigation**: Comprehensive audit trails and version control for narrative content
- **Compliance**: GDPR-compliant data handling with export and deletion capabilities
- **Performance**: Optimized for handling large-scale narrative generation with load balancing
- **Integration**: Seamless integration with existing game development pipelines

#### For Players
- **Rich Experiences**: More complex and responsive narrative content in games
- **Personalized Stories**: Narratives that adapt to individual player choices and preferences
- **Consistent Quality**: AI-powered consistency ensures coherent story experiences
- **Diverse Content**: Greater variety in quests, dialogue, and story elements
- **Immersive Worlds**: More detailed and interconnected lore systems

## 🏗️ Architecture

- **Frontend**: Next.js 14 with StoryMap, QuestEditor, DialogueTree UI
- **API**: NestJS with OpenAPI 3.1, RBAC, and RLS
- **Workers**: FastAPI-based CrewAI agents communicating via NATS
- **Database**: PostgreSQL 16 + pgvector for semantic search
- **Storage**: S3/R2 for exports, Redis for caching
- **Observability**: OpenTelemetry + Prometheus/Grafana

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 16

### Development Setup
```bash
# Clone and setup
git clone <repo-url>
cd ai-game-narrative-generator

# Install dependencies
npm install
cd frontend && npm install
cd ../api && npm install
cd ../workers && pip install -r requirements.txt

# Start infrastructure
docker-compose up -d

# Run development servers
npm run dev:all
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- Database connections
- NATS/Redis URLs
- S3/R2 credentials
- API keys for AI services

## 📁 Project Structure

```
/
├── frontend/          # Next.js 14 application
├── api/              # NestJS API gateway
├── workers/          # FastAPI CrewAI agents
├── infra/            # Docker, Terraform, K8s
├── docs/             # Documentation
└── shared/           # Shared types and utilities
```

## 🔧 Development

### API Development
```bash
cd api
npm run start:dev
```

### Frontend Development  
```bash
cd frontend
npm run dev
```

### Worker Development
```bash
cd workers
uvicorn main:app --reload
```

## 🧪 Testing

```bash
# Run all tests
npm run test:all

# API tests
cd api && npm test

# Frontend tests
cd frontend && npm test

# Worker tests
cd workers && pytest
```

## 📊 Monitoring

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686

## 📚 Documentation

- [Architecture Guide](docs/architecture.md)
- [API Reference](docs/api.md)
- [Agent Development](docs/agents.md)
- [Deployment Guide](docs/deployment.md)

## 🤝 Contributing

1. Follow conventional commits
2. Add tests for new features
3. Update documentation
4. Ensure all CI checks pass

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
