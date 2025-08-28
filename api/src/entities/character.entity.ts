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

@Entity('characters')
@Index(['project_id'])
export class Character {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Character name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: 'Character role' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  role: string;

  @ApiProperty({ description: 'Character faction' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  faction: string;

  @ApiProperty({ description: 'Character traits' })
  @Column({ type: 'jsonb', default: [] })
  traits: any[];

  @ApiProperty({ description: 'Character backstory' })
  @Column({ type: 'text', nullable: true })
  backstory: string;

  @ApiProperty({ description: 'Character personality' })
  @Column({ type: 'jsonb', default: {} })
  personality: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who created the character' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.characters)
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
