import { PartialType } from '@nestjs/swagger';
import { CreateStoryArcDto } from './create-story-arc.dto';

export class UpdateStoryArcDto extends PartialType(CreateStoryArcDto) {}
