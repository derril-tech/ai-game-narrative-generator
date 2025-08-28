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

@Entity('lore_entries')
@Index(['project_id'])
@Index(['category'])
export class LoreEntry {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project ID' })
  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @ApiProperty({ description: 'Lore category' })
  @Column({ type: 'varchar', length: 100 })
  category: string;

  @ApiProperty({ description: 'Lore name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: 'Lore description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Lore content' })
  @Column({ type: 'text', nullable: true })
  content: string;

  @ApiProperty({ description: 'Lore embedding vector' })
  @Column({ type: 'vector', dimension: 1536, nullable: true })
  embedding: number[];

  @ApiProperty({ description: 'Lore tags' })
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who created the lore entry' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.loreEntries)
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
