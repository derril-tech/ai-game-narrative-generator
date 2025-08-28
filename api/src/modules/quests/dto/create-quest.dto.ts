import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsArray, IsNumber, IsEnum } from 'class-validator';

export class CreateQuestDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'Story arc ID', required: false })
  @IsOptional()
  @IsUUID()
  storyArcId?: string;

  @ApiProperty({ description: 'Quest title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Quest description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Quest conditions', required: false })
  @IsOptional()
  @IsArray()
  conditions?: any[];

  @ApiProperty({ description: 'Quest rewards', required: false })
  @IsOptional()
  @IsArray()
  rewards?: any[];

  @ApiProperty({ description: 'Quest outcomes', required: false })
  @IsOptional()
  @IsArray()
  outcomes?: any[];

  @ApiProperty({ description: 'Quest type', required: false })
  @IsOptional()
  @IsString()
  questType?: string;

  @ApiProperty({ description: 'Quest difficulty', required: false })
  @IsOptional()
  @IsNumber()
  difficulty?: number;

  @ApiProperty({ description: 'Estimated duration in minutes', required: false })
  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @ApiProperty({ description: 'User who created the quest' })
  @IsUUID()
  createdBy: string;
}
