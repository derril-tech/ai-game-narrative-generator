import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Project } from './project.entity';

@Entity('simulations')
@Index(['project_id'])
export class Simulation {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Player profile' })
  @Column({ type: 'jsonb', default: {} })
  playerProfile: Record<string, any>;

  @ApiProperty({ description: 'Simulation results' })
  @Column({ type: 'jsonb', default: {} })
  results: Record<string, any>;

  @ApiProperty({ description: 'Reputation changes' })
  @Column({ type: 'jsonb', default: {} })
  reputationChanges: Record<string, any>;

  @ApiProperty({ description: 'Alignment changes' })
  @Column({ type: 'jsonb', default: {} })
  alignmentChanges: Record<string, any>;

  @ApiProperty({ description: 'Timeline' })
  @Column({ type: 'jsonb', default: [] })
  timeline: any[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'User who created the simulation' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.simulations)
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
