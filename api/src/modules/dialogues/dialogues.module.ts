import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DialoguesController } from './dialogues.controller';
import { DialoguesService } from './dialogues.service';
import { Dialogue } from '../../entities/dialogue.entity';
import { Character } from '../../entities/character.entity';
import { LoreEntry } from '../../entities/lore-entry.entity';
import { Quest } from '../../entities/quest.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dialogue, Character, LoreEntry, Quest])
  ],
  controllers: [DialoguesController],
  providers: [DialoguesService],
  exports: [DialoguesService]
})
export class DialoguesModule {}
