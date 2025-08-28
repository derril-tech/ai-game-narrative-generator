import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';

export class CreateStoryArcDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'Story arc title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Story arc description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Story arc metadata', required: false })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @ApiProperty({ description: 'User who created the story arc' })
  @IsUUID()
  createdBy: string;
}
