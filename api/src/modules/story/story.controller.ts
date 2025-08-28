import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { StoryService } from './story.service';
import { CreateStoryArcDto } from './dto/create-story-arc.dto';
import { UpdateStoryArcDto } from './dto/update-story-arc.dto';
import { StoryArc } from '../../entities/story-arc.entity';

@ApiTags('story')
@ApiBearerAuth()
@Controller('story/arcs')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new story arc' })
  @ApiResponse({ status: 201, description: 'Story arc created successfully' })
  create(@Body() createStoryArcDto: CreateStoryArcDto): Promise<StoryArc> {
    return this.storyService.create(createStoryArcDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all story arcs for a project' })
  @ApiResponse({ status: 200, description: 'Story arcs retrieved successfully' })
  findAll(@Query('projectId') projectId: string): Promise<StoryArc[]> {
    return this.storyService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a story arc by ID' })
  @ApiResponse({ status: 200, description: 'Story arc retrieved successfully' })
  findOne(@Param('id') id: string): Promise<StoryArc> {
    return this.storyService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a story arc' })
  @ApiResponse({ status: 200, description: 'Story arc updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateStoryArcDto: UpdateStoryArcDto,
  ): Promise<StoryArc> {
    return this.storyService.update(id, updateStoryArcDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a story arc' })
  @ApiResponse({ status: 200, description: 'Story arc deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.storyService.remove(id);
  }
}
