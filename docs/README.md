# AI Game Narrative Generator - Documentation

## Overview

The AI Game Narrative Generator is a comprehensive tool for creating interactive narrative content for games using multiple AI agents that collaborate to generate compelling stories, quests, and dialogues.

## Architecture

### Components

1. **Frontend (Next.js 14)**
   - Modern React application with TypeScript
   - Tailwind CSS for styling
   - StoryMap, QuestEditor, DialogueTree UI components
   - Real-time collaboration features

2. **API Gateway (NestJS)**
   - RESTful API with OpenAPI 3.1 documentation
   - JWT authentication and RBAC
   - Request validation with Zod
   - Rate limiting and security middleware

3. **Workers (FastAPI + CrewAI)**
   - Story Architect Agent
   - Quest Designer Agent
   - Dialogue Writer Agent
   - Lore Keeper Agent
   - Simulator Agent
   - Exporter Agent

4. **Infrastructure**
   - PostgreSQL 16 with pgvector for semantic search
   - Redis for caching and sessions
   - NATS for event messaging
   - MinIO for S3-compatible storage
   - Prometheus + Grafana for monitoring

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 16

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd ai-game-narrative-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   cd ../api && npm install
   cd ../workers && pip install -r requirements.txt
   ```

3. **Start infrastructure**
   ```bash
   docker-compose up -d
   ```

4. **Run development servers**
   ```bash
   npm run dev:all
   ```

### Environment Configuration

Copy `env.example` to `.env` and configure:
- Database connections
- AI service API keys
- Content policy settings
- Monitoring configuration

## API Documentation

- **API Gateway**: http://localhost:3001/api
- **Workers API**: http://localhost:8001/api/v1
- **Health Checks**: http://localhost:3001/health

## Monitoring

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686

## Development Workflow

1. **Feature Development**
   - Create feature branch from `develop`
   - Implement changes with tests
   - Submit pull request for review

2. **Testing**
   - Unit tests for all components
   - Integration tests for API endpoints
   - E2E tests for critical user flows

3. **Deployment**
   - Automated CI/CD pipeline
   - Blue-green deployment strategy
   - Environment-specific configurations

## Contributing

Please read our contributing guidelines and ensure all code follows our standards for quality, security, and maintainability.

## License

MIT License - see LICENSE file for details.
