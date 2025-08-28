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

@Entity('exports')
@Index(['project_id'])
export class Export {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Export kind' })
  @Column({ type: 'varchar', length: 50 })
  kind: string;

  @ApiProperty({ description: 'S3 key' })
  @Column({ type: 'varchar', length: 500, name: 's3_key', nullable: true })
  s3Key: string;

  @ApiProperty({ description: 'Export metadata' })
  @Column({ type: 'jsonb', default: {} })
  meta: Record<string, any>;

  @ApiProperty({ description: 'Export status' })
  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Completion timestamp' })
  @Column({ type: 'timestamp with time zone', name: 'completed_at', nullable: true })
  completedAt: Date;

  @ApiProperty({ description: 'User who created the export' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.exports)
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
