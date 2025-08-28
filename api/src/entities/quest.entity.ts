import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Project } from './project.entity';
import { StoryArc } from './story-arc.entity';
import { Dialogue } from './dialogue.entity';

@Entity('quests')
@Index(['project_id'])
@Index(['story_arc_id'])
export class Quest {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Story arc ID' })
  @Column({ type: 'uuid', name: 'story_arc_id', nullable: true })
  storyArcId: string;

  @ApiProperty({ description: 'Quest title' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Quest description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Quest conditions' })
  @Column({ type: 'jsonb', default: [] })
  conditions: any[];

  @ApiProperty({ description: 'Quest rewards' })
  @Column({ type: 'jsonb', default: [] })
  rewards: any[];

  @ApiProperty({ description: 'Quest outcomes' })
  @Column({ type: 'jsonb', default: [] })
  outcomes: any[];

  @ApiProperty({ description: 'Quest type' })
  @Column({ type: 'varchar', length: 100, default: 'fetch' })
  questType: string;

  @ApiProperty({ description: 'Quest difficulty' })
  @Column({ type: 'integer', default: 1 })
  difficulty: number;

  @ApiProperty({ description: 'Estimated duration in minutes' })
  @Column({ type: 'integer', default: 30, name: 'estimated_duration' })
  estimatedDuration: number;

  @ApiProperty({ description: 'Quest status' })
  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who created the quest' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.quests)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => StoryArc, (storyArc) => storyArc.quests)
  @JoinColumn({ name: 'story_arc_id' })
  storyArc: StoryArc;

  @OneToMany(() => Dialogue, (dialogue) => dialogue.quest)
  dialogues: Dialogue[];
}
