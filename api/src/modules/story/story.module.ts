import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StoryArc } from '../../entities/story-arc.entity';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoryArc])],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
