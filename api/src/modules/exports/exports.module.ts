import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Export } from '../../entities/export.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Export])],
  controllers: [],
  providers: [],
  exports: [],
})
export class ExportsModule {}
