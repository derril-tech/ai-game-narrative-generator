import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoreEntry } from '../../entities/lore-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoreEntry])],
  controllers: [],
  providers: [],
  exports: [],
})
export class LoreModule {}
