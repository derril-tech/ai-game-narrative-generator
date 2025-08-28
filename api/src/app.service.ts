import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello(): object {
    return {
      name: 'AI Game Narrative Generator API',
      version: '1.0.0',
      description: 'Dynamic AI-driven worlds where CrewAI agents collaborate to create branching storylines, quests, and dialogue',
      environment: this.configService.get('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
    };
  }

  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }
}
