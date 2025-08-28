import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StoryArc } from '../../entities/story-arc.entity';
import { CreateStoryArcDto } from './dto/create-story-arc.dto';
import { UpdateStoryArcDto } from './dto/update-story-arc.dto';

@Injectable()
export class StoryService {
  constructor(
    @InjectRepository(StoryArc)
    private readonly storyArcRepository: Repository<StoryArc>,
  ) {}

  async create(createStoryArcDto: CreateStoryArcDto): Promise<StoryArc> {
    const storyArc = this.storyArcRepository.create(createStoryArcDto);
    return this.storyArcRepository.save(storyArc);
  }

  async findAll(projectId: string): Promise<StoryArc[]> {
    return this.storyArcRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<StoryArc> {
    const storyArc = await this.storyArcRepository.findOne({
      where: { id },
    });

    if (!storyArc) {
      throw new NotFoundException(`Story arc with ID ${id} not found`);
    }

    return storyArc;
  }

  async update(id: string, updateStoryArcDto: UpdateStoryArcDto): Promise<StoryArc> {
    const storyArc = await this.findOne(id);
    Object.assign(storyArc, updateStoryArcDto);
    return this.storyArcRepository.save(storyArc);
  }

  async remove(id: string): Promise<void> {
    const storyArc = await this.findOne(id);
    await this.storyArcRepository.remove(storyArc);
  }
}
