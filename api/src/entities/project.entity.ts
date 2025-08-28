import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { StoryArc } from './story-arc.entity';
import { Quest } from './quest.entity';
import { Dialogue } from './dialogue.entity';
import { LoreEntry } from './lore-entry.entity';
import { Character } from './character.entity';
import { Simulation } from './simulation.entity';
import { Export } from './export.entity';

@Entity('projects')
@Index(['organization_id'])
export class Project {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Project name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: 'Project description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Organization ID' })
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ApiProperty({ description: 'Project settings' })
  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who created the project' })
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @ApiProperty({ description: 'Whether the project is active' })
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  // Relations
  @OneToMany(() => StoryArc, (storyArc) => storyArc.project)
  storyArcs: StoryArc[];

  @OneToMany(() => Quest, (quest) => quest.project)
  quests: Quest[];

  @OneToMany(() => Dialogue, (dialogue) => dialogue.project)
  dialogues: Dialogue[];

  @OneToMany(() => LoreEntry, (loreEntry) => loreEntry.project)
  loreEntries: LoreEntry[];

  @OneToMany(() => Character, (character) => character.project)
  characters: Character[];

  @OneToMany(() => Simulation, (simulation) => simulation.project)
  simulations: Simulation[];

  @OneToMany(() => Export, (export_) => export_.project)
  exports: Export[];
}
