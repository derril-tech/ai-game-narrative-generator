import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { QuestsService } from './quests.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { Quest } from '../../entities/quest.entity';

@ApiTags('quests')
@ApiBearerAuth()
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quest' })
  @ApiResponse({ status: 201, description: 'Quest created successfully' })
  create(@Body() createQuestDto: CreateQuestDto): Promise<Quest> {
    return this.questsService.create(createQuestDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all quests for a project' })
  @ApiResponse({ status: 200, description: 'Quests retrieved successfully' })
  findAll(@Query('projectId') projectId: string): Promise<Quest[]> {
    return this.questsService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a quest by ID' })
  @ApiResponse({ status: 200, description: 'Quest retrieved successfully' })
  findOne(@Param('id') id: string): Promise<Quest> {
    return this.questsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a quest' })
  @ApiResponse({ status: 200, description: 'Quest updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateQuestDto: UpdateQuestDto,
  ): Promise<Quest> {
    return this.questsService.update(id, updateQuestDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quest' })
  @ApiResponse({ status: 200, description: 'Quest deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.questsService.remove(id);
  }
}
