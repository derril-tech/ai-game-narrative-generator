import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityController } from './security.controller';
import { RLSService } from '../auth/rls.service';
import { RLSGuard } from '../auth/rls.guard';
import { SignedUrlsService } from './signed-urls.service';
import { DataExportService } from './data-export.service';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { StoryArc } from '../../entities/story-arc.entity';
import { Quest } from '../../entities/quest.entity';
import { Dialogue } from '../../entities/dialogue.entity';
import { LoreEntry } from '../../entities/lore-entry.entity';
import { Character } from '../../entities/character.entity';
import { Simulation } from '../../entities/simulation.entity';
import { Export } from '../../entities/export.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      User,
      StoryArc,
      Quest,
      Dialogue,
      LoreEntry,
      Character,
      Simulation,
      Export,
      AuditLog,
    ]),
  ],
  controllers: [SecurityController],
  providers: [
    RLSService,
    RLSGuard,
    SignedUrlsService,
    DataExportService,
  ],
  exports: [
    RLSService,
    RLSGuard,
    SignedUrlsService,
    DataExportService,
  ],
})
export class SecurityModule {}
