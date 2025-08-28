import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: configService.get('API_CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('v1');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  if (configService.get('ENABLE_SWAGGER', true)) {
    const config = new DocumentBuilder()
      .setTitle('AI Game Narrative Generator API')
      .setDescription('Dynamic AI-driven worlds where CrewAI agents collaborate to create branching storylines, quests, and dialogue')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('projects', 'Project management')
      .addTag('story', 'Story arcs and narrative generation')
      .addTag('quests', 'Quest design and management')
      .addTag('dialogues', 'Dialogue generation and management')
      .addTag('lore', 'Lore and consistency checking')
      .addTag('simulation', 'Player choice simulation')
      .addTag('exports', 'Content export and packaging')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = configService.get('API_PORT', 3001);
  await app.listen(port);

  console.log(`🚀 AI Narrative Generator API is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
}

bootstrap();
