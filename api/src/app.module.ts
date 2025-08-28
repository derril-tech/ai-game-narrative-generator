import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { ProjectsModule } from './modules/projects/projects.module';
import { StoryModule } from './modules/story/story.module';
import { QuestsModule } from './modules/quests/quests.module';
import { DialoguesModule } from './modules/dialogues/dialogues.module';
import { LoreModule } from './modules/lore/lore.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ValidationModule } from './modules/validation/validation.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Health checks
    TerminusModule,

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    ProjectsModule,
    StoryModule,
    QuestsModule,
    DialoguesModule,
    LoreModule,
    SimulationModule,
    ExportsModule,
    ValidationModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
