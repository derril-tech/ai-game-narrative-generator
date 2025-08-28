import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';
import { StoryArc } from '../../entities/story-arc.entity';
import { Quest } from '../../entities/quest.entity';
import { Dialogue } from '../../entities/dialogue.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoryArc, Quest, Dialogue])
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService]
})
export class ValidationModule {}
