import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Simulation } from '../../entities/simulation.entity';
import { Quest } from '../../entities/quest.entity';
import { Dialogue } from '../../entities/dialogue.entity';
import { Character } from '../../entities/character.entity';

export interface PlayerState {
  stats: {
    health: number;
    mana: number;
    experience: number;
    level: number;
    gold: number;
  };
  reputation: Record<string, number>; // faction -> reputation value
  alignment: {
    good: number;
    neutral: number;
    evil: number;
  };
  inventory: string[];
  flags: Record<string, boolean>;
  quest_progress: Record<string, {
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    objectives: Record<string, boolean>;
  }>;
  current_location: string;
  current_quest?: string;
  current_dialogue?: string;
}

export interface SimulationEvent {
  id: string;
  timestamp: number;
  type: 'quest_start' | 'quest_complete' | 'dialogue' | 'stat_change' | 'reputation_change' | 'alignment_change' | 'item_gain' | 'item_loss' | 'flag_set' | 'location_change';
  description: string;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface SimulationRequest {
  project_id: string;
  story_arc_id: string;
  initial_state?: Partial<PlayerState>;
  player_name?: string;
  difficulty?: string;
  play_style?: string;
  max_duration?: number; // in minutes
  random_seed?: number;
}

export interface SimulationResult {
  id: string;
  project_id: string;
  story_arc_id: string;
  initial_state: PlayerState;
  final_state: PlayerState;
  events: SimulationEvent[];
  duration: number;
  completed_quests: string[];
  failed_quests: string[];
  total_experience_gained: number;
  reputation_changes: Record<string, number>;
  alignment_changes: {
    good: number;
    neutral: number;
    evil: number;
  };
  created_at: string;
  metadata: {
    player_name?: string;
    difficulty?: string;
    play_style?: string;
    notes?: string;
  };
}

@Injectable()
export class SimulationService {
  constructor(
    @InjectRepository(Simulation)
    private readonly simulationRepository: Repository<Simulation>,
    @InjectRepository(Quest)
    private readonly questRepository: Repository<Quest>,
    @InjectRepository(Dialogue)
    private readonly dialogueRepository: Repository<Dialogue>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
  ) {}

  async createSimulation(request: SimulationRequest): Promise<SimulationResult> {
    const startTime = Date.now();
    
    // Initialize player state
    const initialState = this.initializePlayerState(request.initial_state);
    
    // Get story arc data
    const quests = await this.questRepository.find({
      where: { story_arc_id: request.story_arc_id },
      relations: ['prerequisites', 'rewards'],
    });
    
    const dialogues = await this.dialogueRepository.find({
      where: { project_id: request.project_id },
      relations: ['character'],
    });
    
    const characters = await this.characterRepository.find({
      where: { project_id: request.project_id },
    });
    
    // Run simulation
    const simulationResult = await this.runSimulation(
      initialState,
      quests,
      dialogues,
      characters,
      request
    );
    
    // Save to database
    const simulation = this.simulationRepository.create({
      project_id: request.project_id,
      story_arc_id: request.story_arc_id,
      initial_state: JSON.stringify(initialState),
      final_state: JSON.stringify(simulationResult.final_state),
      events: JSON.stringify(simulationResult.events),
      duration: simulationResult.duration,
      completed_quests: simulationResult.completed_quests,
      failed_quests: simulationResult.failed_quests,
      total_experience_gained: simulationResult.total_experience_gained,
      reputation_changes: JSON.stringify(simulationResult.reputation_changes),
      alignment_changes: JSON.stringify(simulationResult.alignment_changes),
      metadata: JSON.stringify(simulationResult.metadata),
    });
    
    await this.simulationRepository.save(simulation);
    
    return {
      ...simulationResult,
      id: simulation.id,
    };
  }

  async findAll(projectId: string): Promise<Simulation[]> {
    return await this.simulationRepository.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Simulation> {
    const simulation = await this.simulationRepository.findOne({
      where: { id },
    });
    
    if (!simulation) {
      throw new Error(`Simulation with ID ${id} not found`);
    }
    
    return simulation;
  }

  async remove(id: string): Promise<void> {
    const simulation = await this.findOne(id);
    await this.simulationRepository.remove(simulation);
  }

  private initializePlayerState(partialState?: Partial<PlayerState>): PlayerState {
    const defaultState: PlayerState = {
      stats: {
        health: 100,
        mana: 100,
        experience: 0,
        level: 1,
        gold: 50,
      },
      reputation: {
        'neutral': 0,
        'townsfolk': 0,
        'merchants': 0,
        'guards': 0,
      },
      alignment: {
        good: 0,
        neutral: 50,
        evil: 0,
      },
      inventory: [],
      flags: {},
      quest_progress: {},
      current_location: 'town_square',
    };
    
    return { ...defaultState, ...partialState };
  }

  private async runSimulation(
    initialState: PlayerState,
    quests: Quest[],
    dialogues: Dialogue[],
    characters: Character[],
    request: SimulationRequest
  ): Promise<SimulationResult> {
    const startTime = Date.now();
    const events: SimulationEvent[] = [];
    const completedQuests: string[] = [];
    const failedQuests: string[] = [];
    
    let currentState = { ...initialState };
    let currentTime = 0;
    
    // Initialize quest progress
    quests.forEach(quest => {
      currentState.quest_progress[quest.id] = {
        status: 'not_started',
        progress: 0,
        objectives: {},
      };
    });
    
    // Main simulation loop
    while (currentTime < (request.max_duration || 60) * 60) { // Convert minutes to seconds
      // Find available quests
      const availableQuests = this.findAvailableQuests(quests, currentState);
      
      if (availableQuests.length === 0) {
        // No more quests available, end simulation
        break;
      }
      
      // Select next quest (simple selection for now)
      const selectedQuest = this.selectNextQuest(availableQuests, currentState, request.play_style);
      
      if (!selectedQuest) {
        break;
      }
      
      // Start quest
      this.addEvent(events, {
        type: 'quest_start',
        description: `Started quest: ${selectedQuest.title}`,
        data: { quest_id: selectedQuest.id, quest_title: selectedQuest.title },
        severity: 'info',
      });
      
      currentState.quest_progress[selectedQuest.id].status = 'in_progress';
      currentState.current_quest = selectedQuest.id;
      
      // Simulate quest completion
      const questResult = await this.simulateQuest(selectedQuest, currentState, dialogues, characters);
      
      // Update state based on quest result
      currentState = this.updateStateFromQuest(currentState, selectedQuest, questResult);
      
      // Record quest completion
      if (questResult.completed) {
        completedQuests.push(selectedQuest.id);
        this.addEvent(events, {
          type: 'quest_complete',
          description: `Completed quest: ${selectedQuest.title}`,
          data: { quest_id: selectedQuest.id, quest_title: selectedQuest.title, rewards: questResult.rewards },
          severity: 'success',
        });
      } else {
        failedQuests.push(selectedQuest.id);
        this.addEvent(events, {
          type: 'quest_complete',
          description: `Failed quest: ${selectedQuest.title}`,
          data: { quest_id: selectedQuest.id, quest_title: selectedQuest.title },
          severity: 'error',
        });
      }
      
      // Update reputation and alignment
      const reputationChanges = this.calculateReputationChanges(selectedQuest, questResult, characters);
      const alignmentChanges = this.calculateAlignmentChanges(selectedQuest, questResult);
      
      currentState = this.applyReputationChanges(currentState, reputationChanges);
      currentState = this.applyAlignmentChanges(currentState, alignmentChanges);
      
      // Record changes
      if (Object.keys(reputationChanges).length > 0) {
        this.addEvent(events, {
          type: 'reputation_change',
          description: 'Reputation changed',
          data: { changes: reputationChanges },
          severity: 'info',
        });
      }
      
      if (alignmentChanges.good !== 0 || alignmentChanges.neutral !== 0 || alignmentChanges.evil !== 0) {
        this.addEvent(events, {
          type: 'alignment_change',
          description: 'Alignment changed',
          data: { changes: alignmentChanges },
          severity: 'info',
        });
      }
      
      currentTime += questResult.duration;
    }
    
    const duration = (Date.now() - startTime) / 1000;
    const totalExperienceGained = currentState.stats.experience - initialState.stats.experience;
    
    // Calculate final reputation and alignment changes
    const reputationChanges: Record<string, number> = {};
    Object.keys(currentState.reputation).forEach(faction => {
      const change = currentState.reputation[faction] - initialState.reputation[faction];
      if (change !== 0) {
        reputationChanges[faction] = change;
      }
    });
    
    const alignmentChanges = {
      good: currentState.alignment.good - initialState.alignment.good,
      neutral: currentState.alignment.neutral - initialState.alignment.neutral,
      evil: currentState.alignment.evil - initialState.alignment.evil,
    };
    
    return {
      id: '',
      project_id: request.project_id,
      story_arc_id: request.story_arc_id,
      initial_state: initialState,
      final_state: currentState,
      events,
      duration,
      completed_quests: completedQuests,
      failed_quests: failedQuests,
      total_experience_gained: totalExperienceGained,
      reputation_changes: reputationChanges,
      alignment_changes: alignmentChanges,
      created_at: new Date().toISOString(),
      metadata: {
        player_name: request.player_name,
        difficulty: request.difficulty,
        play_style: request.play_style,
        notes: `Simulation completed in ${duration.toFixed(2)}s`,
      },
    };
  }

  private findAvailableQuests(quests: Quest[], state: PlayerState): Quest[] {
    return quests.filter(quest => {
      const progress = state.quest_progress[quest.id];
      if (progress.status !== 'not_started') {
        return false;
      }
      
      // Check prerequisites
      if (quest.prerequisites && quest.prerequisites.length > 0) {
        return quest.prerequisites.every(prereq => {
          switch (prereq.type) {
            case 'quest':
              return state.quest_progress[prereq.target]?.status === 'completed';
            case 'stat':
              return state.stats[prereq.target] >= prereq.value;
            case 'flag':
              return state.flags[prereq.target] === prereq.value;
            case 'reputation':
              return state.reputation[prereq.target] >= prereq.value;
            default:
              return true;
          }
        });
      }
      
      return true;
    });
  }

  private selectNextQuest(availableQuests: Quest[], state: PlayerState, playStyle?: string): Quest | null {
    if (availableQuests.length === 0) {
      return null;
    }
    
    // Simple selection logic - could be enhanced with more sophisticated AI
    switch (playStyle) {
      case 'aggressive':
        // Prefer combat quests
        return availableQuests.find(q => q.type === 'combat') || availableQuests[0];
      case 'diplomatic':
        // Prefer dialogue quests
        return availableQuests.find(q => q.type === 'dialogue') || availableQuests[0];
      case 'exploration':
        // Prefer exploration quests
        return availableQuests.find(q => q.type === 'exploration') || availableQuests[0];
      default:
        // Random selection
        return availableQuests[Math.floor(Math.random() * availableQuests.length)];
    }
  }

  private async simulateQuest(
    quest: Quest,
    state: PlayerState,
    dialogues: Dialogue[],
    characters: Character[]
  ): Promise<{
    completed: boolean;
    duration: number;
    rewards: any;
    choices: string[];
  }> {
    // Simulate quest completion based on quest type and player stats
    const baseSuccessRate = 0.7;
    let successRate = baseSuccessRate;
    
    // Adjust success rate based on player stats
    if (quest.type === 'combat' && state.stats.health > 80) {
      successRate += 0.1;
    }
    if (quest.type === 'dialogue' && state.stats.level > 3) {
      successRate += 0.1;
    }
    
    const completed = Math.random() < successRate;
    const duration = quest.estimated_duration || 300; // 5 minutes default
    
    // Generate rewards
    const rewards = this.generateQuestRewards(quest, completed);
    
    // Generate player choices (simplified)
    const choices = this.generatePlayerChoices(quest, state);
    
    return {
      completed,
      duration,
      rewards,
      choices,
    };
  }

  private updateStateFromQuest(
    state: PlayerState,
    quest: Quest,
    result: { completed: boolean; rewards: any }
  ): PlayerState {
    const newState = { ...state };
    
    if (result.completed) {
      // Update quest progress
      newState.quest_progress[quest.id] = {
        status: 'completed',
        progress: 100,
        objectives: {},
      };
      
      // Apply rewards
      if (result.rewards) {
        if (result.rewards.experience) {
          newState.stats.experience += result.rewards.experience;
        }
        if (result.rewards.gold) {
          newState.stats.gold += result.rewards.gold;
        }
        if (result.rewards.items) {
          newState.inventory.push(...result.rewards.items);
        }
        if (result.rewards.flags) {
          Object.assign(newState.flags, result.rewards.flags);
        }
      }
    } else {
      // Quest failed
      newState.quest_progress[quest.id] = {
        status: 'failed',
        progress: 0,
        objectives: {},
      };
    }
    
    // Level up check
    const newLevel = Math.floor(newState.stats.experience / 100) + 1;
    if (newLevel > newState.stats.level) {
      newState.stats.level = newLevel;
      newState.stats.health = Math.min(100, newState.stats.health + 10);
      newState.stats.mana = Math.min(100, newState.stats.mana + 10);
    }
    
    return newState;
  }

  private calculateReputationChanges(
    quest: Quest,
    result: { completed: boolean; choices: string[] },
    characters: Character[]
  ): Record<string, number> {
    const changes: Record<string, number> = {};
    
    if (!result.completed) {
      return changes;
    }
    
    // Find characters involved in the quest
    const involvedCharacters = characters.filter(char => 
      quest.title.toLowerCase().includes(char.name.toLowerCase()) ||
      quest.description.toLowerCase().includes(char.name.toLowerCase())
    );
    
    involvedCharacters.forEach(character => {
      const faction = character.faction || 'neutral';
      const baseChange = 5; // Base reputation gain for quest completion
      
      // Adjust based on character personality
      const personalityTraits = character.personality_traits || [];
      let multiplier = 1.0;
      
      if (personalityTraits.includes('friendly')) {
        multiplier = 1.2;
      } else if (personalityTraits.includes('hostile')) {
        multiplier = 0.8;
      }
      
      changes[faction] = Math.round(baseChange * multiplier);
    });
    
    return changes;
  }

  private calculateAlignmentChanges(
    quest: Quest,
    result: { completed: boolean; choices: string[] }
  ): { good: number; neutral: number; evil: number } {
    const changes = { good: 0, neutral: 0, evil: 0 };
    
    if (!result.completed) {
      return changes;
    }
    
    // Determine alignment impact based on quest type and choices
    switch (quest.type) {
      case 'combat':
        // Combat quests can be good (defending) or evil (aggressive)
        if (result.choices.includes('defend') || result.choices.includes('protect')) {
          changes.good = 5;
        } else if (result.choices.includes('attack') || result.choices.includes('kill')) {
          changes.evil = 3;
        }
        break;
      case 'dialogue':
        // Dialogue quests are generally neutral to good
        changes.neutral = 2;
        if (result.choices.includes('help') || result.choices.includes('agree')) {
          changes.good = 3;
        }
        break;
      case 'exploration':
        // Exploration is generally neutral
        changes.neutral = 1;
        break;
      default:
        changes.neutral = 1;
    }
    
    return changes;
  }

  private applyReputationChanges(
    state: PlayerState,
    changes: Record<string, number>
  ): PlayerState {
    const newState = { ...state };
    
    Object.entries(changes).forEach(([faction, change]) => {
      newState.reputation[faction] = (newState.reputation[faction] || 0) + change;
      // Clamp reputation between -100 and 100
      newState.reputation[faction] = Math.max(-100, Math.min(100, newState.reputation[faction]));
    });
    
    return newState;
  }

  private applyAlignmentChanges(
    state: PlayerState,
    changes: { good: number; neutral: number; evil: number }
  ): PlayerState {
    const newState = { ...state };
    
    newState.alignment.good += changes.good;
    newState.alignment.neutral += changes.neutral;
    newState.alignment.evil += changes.evil;
    
    // Normalize alignment to sum to 100
    const total = newState.alignment.good + newState.alignment.neutral + newState.alignment.evil;
    if (total > 0) {
      newState.alignment.good = Math.round((newState.alignment.good / total) * 100);
      newState.alignment.neutral = Math.round((newState.alignment.neutral / total) * 100);
      newState.alignment.evil = 100 - newState.alignment.good - newState.alignment.neutral;
    }
    
    return newState;
  }

  private generateQuestRewards(quest: Quest, completed: boolean): any {
    if (!completed) {
      return {};
    }
    
    const baseRewards = {
      experience: quest.difficulty * 10,
      gold: quest.difficulty * 5,
      items: [],
      flags: {},
    };
    
    // Add specific rewards based on quest type
    switch (quest.type) {
      case 'combat':
        baseRewards.experience *= 1.5;
        baseRewards.items.push('weapon_upgrade');
        break;
      case 'dialogue':
        baseRewards.gold *= 1.2;
        baseRewards.flags['diplomatic_skill'] = true;
        break;
      case 'exploration':
        baseRewards.experience *= 1.3;
        baseRewards.items.push('map_fragment');
        break;
    }
    
    return baseRewards;
  }

  private generatePlayerChoices(quest: Quest, state: PlayerState): string[] {
    const choices: string[] = [];
    
    // Generate choices based on quest type and player state
    switch (quest.type) {
      case 'combat':
        if (state.stats.health > 50) {
          choices.push('fight');
        }
        if (state.stats.level > 2) {
          choices.push('defend');
        }
        choices.push('flee');
        break;
      case 'dialogue':
        choices.push('agree');
        choices.push('disagree');
        if (state.stats.level > 3) {
          choices.push('negotiate');
        }
        break;
      case 'exploration':
        choices.push('explore');
        choices.push('search');
        if (state.stats.level > 1) {
          choices.push('investigate');
        }
        break;
      default:
        choices.push('proceed');
    }
    
    return choices;
  }

  private addEvent(events: SimulationEvent[], event: Omit<SimulationEvent, 'id' | 'timestamp'>) {
    events.push({
      ...event,
      id: `event_${Date.now()}_${Math.random()}`,
      timestamp: events.length * 30, // 30 seconds per event
    });
  }
}
