import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SimulationService, SimulationRequest, SimulationResult } from './simulation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('simulation')
@Controller('simulation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post()
  @ApiOperation({ summary: 'Run a new simulation' })
  @ApiResponse({ status: 201, description: 'Simulation created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createSimulation(@Body() request: SimulationRequest): Promise<SimulationResult> {
    return await this.simulationService.createSimulation(request);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all simulations for a project' })
  @ApiResponse({ status: 200, description: 'Simulations retrieved successfully' })
  async findAll(@Param('projectId') projectId: string) {
    return await this.simulationService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a simulation by ID' })
  @ApiResponse({ status: 200, description: 'Simulation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Simulation not found' })
  async findOne(@Param('id') id: string) {
    return await this.simulationService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a simulation' })
  @ApiResponse({ status: 200, description: 'Simulation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Simulation not found' })
  async remove(@Param('id') id: string) {
    await this.simulationService.remove(id);
    return { message: 'Simulation deleted successfully' };
  }

  @Post('batch')
  @ApiOperation({ summary: 'Run multiple simulations with different parameters' })
  @ApiResponse({ status: 201, description: 'Batch simulations created successfully' })
  async runBatchSimulations(@Body() requests: SimulationRequest[]) {
    const results = await Promise.all(
      requests.map(request => this.simulationService.createSimulation(request))
    );
    
    return {
      total_simulations: results.length,
      results: results.map(result => ({
        id: result.id,
        project_id: result.project_id,
        story_arc_id: result.story_arc_id,
        duration: result.duration,
        completed_quests: result.completed_quests.length,
        failed_quests: result.failed_quests.length,
        total_experience_gained: result.total_experience_gained,
        metadata: result.metadata,
      }))
    };
  }

  @Post('compare')
  @ApiOperation({ summary: 'Compare multiple simulation results' })
  @ApiResponse({ status: 200, description: 'Comparison completed successfully' })
  async compareSimulations(@Body() simulationIds: string[]) {
    const simulations = await Promise.all(
      simulationIds.map(id => this.simulationService.findOne(id))
    );
    
    // Calculate comparison metrics
    const comparison = {
      total_simulations: simulations.length,
      average_duration: simulations.reduce((sum, sim) => sum + sim.duration, 0) / simulations.length,
      average_experience_gained: simulations.reduce((sum, sim) => sum + sim.total_experience_gained, 0) / simulations.length,
      average_quests_completed: simulations.reduce((sum, sim) => sum + sim.completed_quests.length, 0) / simulations.length,
      reputation_changes: this.aggregateReputationChanges(simulations),
      alignment_distribution: this.calculateAlignmentDistribution(simulations),
      play_style_analysis: this.analyzePlayStyles(simulations),
    };
    
    return comparison;
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Get detailed analysis of a simulation' })
  @ApiResponse({ status: 200, description: 'Analysis retrieved successfully' })
  async getSimulationAnalysis(@Param('id') id: string) {
    const simulation = await this.simulationService.findOne(id);
    
    const analysis = {
      simulation_id: simulation.id,
      basic_stats: {
        duration: simulation.duration,
        total_experience_gained: simulation.total_experience_gained,
        quests_completed: simulation.completed_quests.length,
        quests_failed: simulation.failed_quests.length,
        success_rate: simulation.completed_quests.length / (simulation.completed_quests.length + simulation.failed_quests.length),
      },
      reputation_analysis: this.analyzeReputationChanges(simulation),
      alignment_analysis: this.analyzeAlignmentChanges(simulation),
      event_timeline: this.analyzeEventTimeline(simulation),
      performance_metrics: this.calculatePerformanceMetrics(simulation),
    };
    
    return analysis;
  }

  private aggregateReputationChanges(simulations: any[]) {
    const aggregated: Record<string, { total: number; average: number; count: number }> = {};
    
    simulations.forEach(sim => {
      const reputationChanges = JSON.parse(sim.reputation_changes || '{}');
      Object.entries(reputationChanges).forEach(([faction, change]) => {
        if (!aggregated[faction]) {
          aggregated[faction] = { total: 0, average: 0, count: 0 };
        }
        aggregated[faction].total += change as number;
        aggregated[faction].count += 1;
      });
    });
    
    // Calculate averages
    Object.values(aggregated).forEach(stats => {
      stats.average = stats.total / stats.count;
    });
    
    return aggregated;
  }

  private calculateAlignmentDistribution(simulations: any[]) {
    const distribution = {
      good: { count: 0, average: 0 },
      neutral: { count: 0, average: 0 },
      evil: { count: 0, average: 0 },
    };
    
    simulations.forEach(sim => {
      const finalState = JSON.parse(sim.final_state);
      const alignment = finalState.alignment;
      
      // Determine primary alignment
      if (alignment.good > alignment.neutral && alignment.good > alignment.evil) {
        distribution.good.count += 1;
        distribution.good.average += alignment.good;
      } else if (alignment.neutral > alignment.good && alignment.neutral > alignment.evil) {
        distribution.neutral.count += 1;
        distribution.neutral.average += alignment.neutral;
      } else {
        distribution.evil.count += 1;
        distribution.evil.average += alignment.evil;
      }
    });
    
    // Calculate averages
    Object.values(distribution).forEach(stats => {
      if (stats.count > 0) {
        stats.average = stats.average / stats.count;
      }
    });
    
    return distribution;
  }

  private analyzePlayStyles(simulations: any[]) {
    const playStyles: Record<string, { count: number; avg_duration: number; avg_experience: number }> = {};
    
    simulations.forEach(sim => {
      const playStyle = sim.metadata?.play_style || 'unknown';
      
      if (!playStyles[playStyle]) {
        playStyles[playStyle] = { count: 0, avg_duration: 0, avg_experience: 0 };
      }
      
      playStyles[playStyle].count += 1;
      playStyles[playStyle].avg_duration += sim.duration;
      playStyles[playStyle].avg_experience += sim.total_experience_gained;
    });
    
    // Calculate averages
    Object.values(playStyles).forEach(stats => {
      stats.avg_duration = stats.avg_duration / stats.count;
      stats.avg_experience = stats.avg_experience / stats.count;
    });
    
    return playStyles;
  }

  private analyzeReputationChanges(simulation: any) {
    const reputationChanges = JSON.parse(simulation.reputation_changes || '{}');
    
    return {
      total_factions_affected: Object.keys(reputationChanges).length,
      largest_change: Math.max(...Object.values(reputationChanges) as number[], 0),
      smallest_change: Math.min(...Object.values(reputationChanges) as number[], 0),
      positive_changes: Object.values(reputationChanges).filter((change: number) => change > 0).length,
      negative_changes: Object.values(reputationChanges).filter((change: number) => change < 0).length,
      changes_by_faction: reputationChanges,
    };
  }

  private analyzeAlignmentChanges(simulation: any) {
    const alignmentChanges = JSON.parse(simulation.alignment_changes || '{}');
    
    return {
      good_change: alignmentChanges.good || 0,
      neutral_change: alignmentChanges.neutral || 0,
      evil_change: alignmentChanges.evil || 0,
      net_alignment_shift: (alignmentChanges.good || 0) - (alignmentChanges.evil || 0),
      primary_alignment: this.getPrimaryAlignment(alignmentChanges),
    };
  }

  private analyzeEventTimeline(simulation: any) {
    const events = JSON.parse(simulation.events || '[]');
    
    return {
      total_events: events.length,
      event_types: this.countEventTypes(events),
      time_distribution: this.analyzeTimeDistribution(events),
      critical_events: this.findCriticalEvents(events),
    };
  }

  private calculatePerformanceMetrics(simulation: any) {
    const events = JSON.parse(simulation.events || '[]');
    const finalState = JSON.parse(simulation.final_state);
    
    return {
      quest_efficiency: simulation.completed_quests.length / simulation.duration,
      experience_rate: simulation.total_experience_gained / simulation.duration,
      event_frequency: events.length / simulation.duration,
      final_level: finalState.stats.level,
      final_health: finalState.stats.health,
      final_gold: finalState.stats.gold,
    };
  }

  private getPrimaryAlignment(alignmentChanges: any): string {
    const good = alignmentChanges.good || 0;
    const neutral = alignmentChanges.neutral || 0;
    const evil = alignmentChanges.evil || 0;
    
    if (good > neutral && good > evil) return 'good';
    if (evil > good && evil > neutral) return 'evil';
    return 'neutral';
  }

  private countEventTypes(events: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    events.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    
    return counts;
  }

  private analyzeTimeDistribution(events: any[]): any {
    const timeRanges = {
      '0-5min': 0,
      '5-15min': 0,
      '15-30min': 0,
      '30min+': 0,
    };
    
    events.forEach(event => {
      const minutes = event.timestamp / 60;
      if (minutes <= 5) timeRanges['0-5min']++;
      else if (minutes <= 15) timeRanges['5-15min']++;
      else if (minutes <= 30) timeRanges['15-30min']++;
      else timeRanges['30min+']++;
    });
    
    return timeRanges;
  }

  private findCriticalEvents(events: any[]): any[] {
    return events.filter(event => 
      event.severity === 'error' || 
      event.severity === 'success' ||
      event.type === 'quest_complete'
    ).slice(0, 10); // Return top 10 critical events
  }
}
