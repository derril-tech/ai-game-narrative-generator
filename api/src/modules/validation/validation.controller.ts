import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ValidationService, ValidationResult } from './validation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('validation')
@Controller('validation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post('project/:projectId')
  @ApiOperation({ summary: 'Validate complete story graph for a project' })
  @ApiResponse({
    status: 200,
    description: 'Validation results',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              nodeId: { type: 'string' },
              edgeId: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning'] },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        warnings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              nodeId: { type: 'string' },
              edgeId: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning'] },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        exportReady: { type: 'boolean' },
        summary: {
          type: 'object',
          properties: {
            totalNodes: { type: 'number' },
            totalEdges: { type: 'number' },
            orphanNodes: { type: 'number' },
            unreachableNodes: { type: 'number' },
            brokenChains: { type: 'number' },
            circularDependencies: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid project ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async validateProject(@Param('projectId') projectId: string): Promise<ValidationResult> {
    return this.validationService.validateStoryGraph(projectId);
  }

  @Post('quest/:questId')
  @ApiOperation({ summary: 'Validate a specific quest and its connections' })
  @ApiResponse({
    status: 200,
    description: 'Quest validation results',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              nodeId: { type: 'string' },
              edgeId: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning'] },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        warnings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              nodeId: { type: 'string' },
              edgeId: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning'] },
              suggestions: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        exportReady: { type: 'boolean' },
        summary: {
          type: 'object',
          properties: {
            totalNodes: { type: 'number' },
            totalEdges: { type: 'number' },
            orphanNodes: { type: 'number' },
            unreachableNodes: { type: 'number' },
            brokenChains: { type: 'number' },
            circularDependencies: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid quest ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quest not found' })
  async validateQuest(@Param('questId') questId: string): Promise<ValidationResult> {
    return this.validationService.validateQuest(questId);
  }

  @Get('project/:projectId/status')
  @ApiOperation({ summary: 'Get validation status for a project' })
  @ApiResponse({
    status: 200,
    description: 'Validation status',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        exportReady: { type: 'boolean' },
        errorCount: { type: 'number' },
        warningCount: { type: 'number' },
        lastValidated: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid project ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getValidationStatus(@Param('projectId') projectId: string) {
    const result = await this.validationService.validateStoryGraph(projectId);
    
    return {
      isValid: result.isValid,
      exportReady: result.exportReady,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      lastValidated: new Date().toISOString()
    };
  }
}
