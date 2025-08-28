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
import { Quest } from './quest.entity';

@Entity('story_arcs')
@Index(['project_id'])
export class StoryArc {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Story arc title' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Story arc description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Story arc metadata' })
  @Column({ type: 'jsonb', default: {} })
  meta: Record<string, any>;

  @ApiProperty({ description: 'Story arc status' })
  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who created the story arc' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.storyArcs)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => Quest, (quest) => quest.storyArc)
  quests: Quest[];
}
