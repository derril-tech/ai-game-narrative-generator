import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DialoguesService, DialogueGenerationRequest, DialogueGenerationResponse, ConsistencyCheckResult } from './dialogues.service';
import { CreateDialogueDto, UpdateDialogueDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('dialogues')
@Controller('dialogues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DialoguesController {
  constructor(private readonly dialoguesService: DialoguesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new dialogue' })
  @ApiResponse({ status: 201, description: 'Dialogue created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createDialogueDto: CreateDialogueDto) {
    return await this.dialoguesService.create(createDialogueDto);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all dialogues for a project' })
  @ApiResponse({ status: 200, description: 'Dialogues retrieved successfully' })
  async findAll(@Param('projectId') projectId: string) {
    return await this.dialoguesService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a dialogue by ID' })
  @ApiResponse({ status: 200, description: 'Dialogue retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Dialogue not found' })
  async findOne(@Param('id') id: string) {
    return await this.dialoguesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a dialogue' })
  @ApiResponse({ status: 200, description: 'Dialogue updated successfully' })
  @ApiResponse({ status: 404, description: 'Dialogue not found' })
  async update(@Param('id') id: string, @Body() updateDialogueDto: UpdateDialogueDto) {
    return await this.dialoguesService.update(id, updateDialogueDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dialogue' })
  @ApiResponse({ status: 200, description: 'Dialogue deleted successfully' })
  @ApiResponse({ status: 404, description: 'Dialogue not found' })
  async remove(@Param('id') id: string) {
    await this.dialoguesService.remove(id);
    return { message: 'Dialogue deleted successfully' };
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate dialogue options and text' })
  @ApiResponse({ status: 200, description: 'Dialogue generated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async generateDialogue(@Body() request: DialogueGenerationRequest): Promise<DialogueGenerationResponse> {
    return await this.dialoguesService.generateDialogue(request);
  }

  @Post(':id/consistency-check')
  @ApiOperation({ summary: 'Check dialogue consistency with lore and character traits' })
  @ApiResponse({ status: 200, description: 'Consistency check completed' })
  @ApiResponse({ status: 404, description: 'Dialogue not found' })
  async checkConsistency(@Param('id') id: string): Promise<ConsistencyCheckResult> {
    return await this.dialoguesService.checkDialogueConsistency(id);
  }

  @Get(':id/tree')
  @ApiOperation({ summary: 'Get dialogue tree structure' })
  @ApiResponse({ status: 200, description: 'Dialogue tree retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Dialogue not found' })
  async getDialogueTree(@Param('id') id: string) {
    return await this.dialoguesService.getDialogueTree(id);
  }

  @Post('batch-consistency-check')
  @ApiOperation({ summary: 'Check consistency for multiple dialogues' })
  @ApiResponse({ status: 200, description: 'Batch consistency check completed' })
  async batchConsistencyCheck(@Body() dialogueIds: string[]) {
    const results = await Promise.all(
      dialogueIds.map(async (id) => {
        try {
          const result = await this.dialoguesService.checkDialogueConsistency(id);
          return { id, ...result };
        } catch (error) {
          return { id, error: error.message };
        }
      })
    );

    const summary = {
      total: results.length,
      consistent: results.filter(r => !r.error && r.is_consistent).length,
      inconsistent: results.filter(r => !r.error && !r.is_consistent).length,
      errors: results.filter(r => r.error).length,
      results,
    };

    return summary;
  }

  @Post('generate-branch')
  @ApiOperation({ summary: 'Generate branching dialogue options' })
  @ApiResponse({ status: 200, description: 'Branching dialogue generated successfully' })
  async generateBranchingDialogue(@Body() request: DialogueGenerationRequest & { branch_count: number }) {
    const { branch_count, ...dialogueRequest } = request;
    
    const baseDialogue = await this.dialoguesService.generateDialogue(dialogueRequest);
    
    // Generate additional branches
    const branches = [];
    for (let i = 0; i < branch_count - 1; i++) {
      const branchRequest = {
        ...dialogueRequest,
        emotion_context: this.getRandomEmotion(),
        tone_preference: this.getRandomTone(),
      };
      
      const branch = await this.dialoguesService.generateDialogue(branchRequest);
      branches.push(branch);
    }

    return {
      main_dialogue: baseDialogue,
      branches,
      total_options: baseDialogue.options.length + branches.reduce((sum, b) => sum + b.options.length, 0),
    };
  }

  private getRandomEmotion(): string {
    const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'];
    return emotions[Math.floor(Math.random() * emotions.length)];
  }

  private getRandomTone(): string {
    const tones = ['formal', 'casual', 'friendly', 'hostile', 'mysterious', 'humorous', 'serious'];
    return tones[Math.floor(Math.random() * tones.length)];
  }
}
