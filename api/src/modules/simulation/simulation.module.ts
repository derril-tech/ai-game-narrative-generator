import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { Simulation } from '../../entities/simulation.entity';
import { Quest } from '../../entities/quest.entity';
import { Dialogue } from '../../entities/dialogue.entity';
import { Character } from '../../entities/character.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Simulation, Quest, Dialogue, Character])
  ],
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService]
})
export class SimulationModule {}
