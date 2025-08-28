import { IsString, IsOptional, IsUUID, IsEnum, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDialogueDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  project_id: string;

  @ApiProperty({ description: 'Dialogue content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Character ID', required: false })
  @IsOptional()
  @IsUUID()
  character_id?: string;

  @ApiProperty({ description: 'Quest ID', required: false })
  @IsOptional()
  @IsUUID()
  quest_id?: string;

  @ApiProperty({ 
    description: 'Dialogue emotion',
    enum: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'])
  emotion?: string;

  @ApiProperty({ 
    description: 'Dialogue tone',
    enum: ['formal', 'casual', 'friendly', 'hostile', 'mysterious', 'humorous', 'serious'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['formal', 'casual', 'friendly', 'hostile', 'mysterious', 'humorous', 'serious'])
  tone?: string;

  @ApiProperty({ description: 'Dialogue conditions', required: false })
  @IsOptional()
  @IsArray()
  conditions?: any[];

  @ApiProperty({ description: 'Dialogue responses', required: false })
  @IsOptional()
  @IsArray()
  responses?: any[];

  @ApiProperty({ description: 'Dialogue metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
