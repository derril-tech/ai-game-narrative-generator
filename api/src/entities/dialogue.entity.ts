import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Project } from './project.entity';
import { Quest } from './quest.entity';

@Entity('dialogues')
@Index(['project_id'])
@Index(['quest_id'])
export class Dialogue {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Quest ID' })
  @Column({ type: 'uuid', name: 'quest_id', nullable: true })
  questId: string;

  @ApiProperty({ description: 'Character ID' })
  @Column({ type: 'uuid', name: 'character_id', nullable: true })
  characterId: string;

  @ApiProperty({ description: 'Dialogue node graph' })
  @Column({ type: 'jsonb', default: {} })
  nodeGraph: Record<string, any>;

  @ApiProperty({ description: 'Dialogue conditions' })
  @Column({ type: 'jsonb', default: [] })
  conditions: any[];

  @ApiProperty({ description: 'Next nodes' })
  @Column({ type: 'jsonb', default: [] })
  nextNodes: any[];

  @ApiProperty({ description: 'Emotion' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  emotion: string;

  @ApiProperty({ description: 'Tone' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  tone: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who created the dialogue' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.dialogues)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Quest, (quest) => quest.dialogues)
  @JoinColumn({ name: 'quest_id' })
  quest: Quest;
}
