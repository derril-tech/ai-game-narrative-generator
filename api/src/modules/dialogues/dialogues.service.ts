import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dialogue } from '../../entities/dialogue.entity';
import { Character } from '../../entities/character.entity';
import { LoreEntry } from '../../entities/lore-entry.entity';
import { Quest } from '../../entities/quest.entity';
import { CreateDialogueDto, UpdateDialogueDto } from './dto';

export interface DialogueGenerationRequest {
  character_id: string;
  context: string;
  player_state: {
    stats: Record<string, number>;
    flags: Record<string, boolean>;
    quest_progress: Record<string, any>;
    reputation: Record<string, number>;
  };
  previous_dialogue?: string;
  quest_context?: string;
  emotion_context?: string;
  tone_preference?: string;
}

export interface DialogueOption {
  id: string;
  text: string;
  conditions: Array<{
    type: 'stat' | 'flag' | 'quest' | 'reputation';
    target: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'has' | 'not_has';
    value: any;
  }>;
  consequences: {
    reputation_changes?: Record<string, number>;
    flag_changes?: Record<string, boolean>;
    stat_changes?: Record<string, number>;
    quest_triggers?: string[];
  };
  next_dialogue_id?: string;
}

export interface DialogueGenerationResponse {
  dialogue_id: string;
  character_name: string;
  character_voice: string;
  dialogue_text: string;
  emotion: string;
  tone: string;
  options: DialogueOption[];
  consistency_checks: {
    lore_consistency: boolean;
    character_consistency: boolean;
    quest_consistency: boolean;
    warnings: string[];
  };
  metadata: {
    generation_time: number;
    model_used: string;
    confidence_score: number;
  };
}

export interface ConsistencyCheckResult {
  is_consistent: boolean;
  issues: string[];
  suggestions: string[];
  confidence_score: number;
}

@Injectable()
export class DialoguesService {
  constructor(
    @InjectRepository(Dialogue)
    private readonly dialogueRepository: Repository<Dialogue>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(LoreEntry)
    private readonly loreRepository: Repository<LoreEntry>,
    @InjectRepository(Quest)
    private readonly questRepository: Repository<Quest>,
  ) {}

  async create(createDialogueDto: CreateDialogueDto): Promise<Dialogue> {
    const dialogue = this.dialogueRepository.create(createDialogueDto);
    return await this.dialogueRepository.save(dialogue);
  }

  async findAll(projectId: string): Promise<Dialogue[]> {
    return await this.dialogueRepository.find({
      where: { project_id: projectId },
      relations: ['character', 'quest'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Dialogue> {
    const dialogue = await this.dialogueRepository.findOne({
      where: { id },
      relations: ['character', 'quest'],
    });
    
    if (!dialogue) {
      throw new Error(`Dialogue with ID ${id} not found`);
    }
    
    return dialogue;
  }

  async update(id: string, updateDialogueDto: UpdateDialogueDto): Promise<Dialogue> {
    const dialogue = await this.findOne(id);
    Object.assign(dialogue, updateDialogueDto);
    return await this.dialogueRepository.save(dialogue);
  }

  async remove(id: string): Promise<void> {
    const dialogue = await this.findOne(id);
    await this.dialogueRepository.remove(dialogue);
  }

  async generateDialogue(request: DialogueGenerationRequest): Promise<DialogueGenerationResponse> {
    const startTime = Date.now();
    
    // Get character information
    const character = await this.characterRepository.findOne({
      where: { id: request.character_id },
    });
    
    if (!character) {
      throw new Error(`Character with ID ${request.character_id} not found`);
    }

    // Perform consistency checks
    const consistencyChecks = await this.performConsistencyChecks(request, character);
    
    // Generate dialogue options based on character traits and context
    const options = await this.generateDialogueOptions(request, character);
    
    // Generate main dialogue text
    const dialogueText = await this.generateDialogueText(request, character, options);
    
    // Determine emotion and tone
    const emotion = this.determineEmotion(request, character);
    const tone = this.determineTone(request, character);
    
    const generationTime = Date.now() - startTime;
    
    return {
      dialogue_id: `dialogue_${Date.now()}`,
      character_name: character.name,
      character_voice: character.voice_tone,
      dialogue_text: dialogueText,
      emotion,
      tone,
      options,
      consistency_checks: consistencyChecks,
      metadata: {
        generation_time: generationTime,
        model_used: 'dialogue_generator_v1',
        confidence_score: this.calculateConfidenceScore(consistencyChecks, options),
      },
    };
  }

  private async performConsistencyChecks(
    request: DialogueGenerationRequest,
    character: Character,
  ): Promise<DialogueGenerationResponse['consistency_checks']> {
    const warnings: string[] = [];
    let loreConsistency = true;
    let characterConsistency = true;
    let questConsistency = true;

    // Check lore consistency
    if (request.context) {
      const loreEntries = await this.loreRepository
        .createQueryBuilder('lore')
        .where('lore.project_id = :projectId', { projectId: character.project_id })
        .andWhere('lore.content ILIKE :context', { context: `%${request.context}%` })
        .getMany();

      for (const lore of loreEntries) {
        if (lore.canon_status === 'contradictory') {
          warnings.push(`Lore contradiction detected: ${lore.title}`);
          loreConsistency = false;
        }
      }
    }

    // Check character consistency
    if (request.previous_dialogue) {
      const previousDialogue = await this.dialogueRepository.findOne({
        where: { id: request.previous_dialogue },
        relations: ['character'],
      });

      if (previousDialogue && previousDialogue.character_id === character.id) {
        // Check for voice tone consistency
        if (previousDialogue.tone && request.tone_preference) {
          const toneDifference = this.calculateToneDifference(previousDialogue.tone, request.tone_preference);
          if (toneDifference > 0.7) {
            warnings.push('Significant tone shift detected from previous dialogue');
            characterConsistency = false;
          }
        }
      }
    }

    // Check quest consistency
    if (request.quest_context) {
      const quest = await this.questRepository.findOne({
        where: { id: request.quest_context },
      });

      if (quest) {
        // Check if character is involved in the quest
        const characterInvolved = quest.prerequisites?.some(prereq => 
          prereq.type === 'character' && prereq.target === character.id
        );

        if (!characterInvolved && character.role !== 'quest_giver') {
          warnings.push('Character may not be appropriate for this quest context');
          questConsistency = false;
        }
      }
    }

    return {
      lore_consistency: loreConsistency,
      character_consistency: characterConsistency,
      quest_consistency: questConsistency,
      warnings,
    };
  }

  private async generateDialogueOptions(
    request: DialogueGenerationRequest,
    character: Character,
  ): Promise<DialogueOption[]> {
    const options: DialogueOption[] = [];

    // Generate options based on character personality
    const personalityTraits = character.personality_traits || [];
    
    // Option 1: Friendly/Helpful response
    if (personalityTraits.includes('friendly') || personalityTraits.includes('helpful')) {
      options.push({
        id: `option_${Date.now()}_1`,
        text: this.generateFriendlyResponse(request, character),
        conditions: [],
        consequences: {
          reputation_changes: { [character.faction || 'neutral']: 5 },
        },
      });
    }

    // Option 2: Neutral/Professional response
    options.push({
      id: `option_${Date.now()}_2`,
      text: this.generateNeutralResponse(request, character),
      conditions: [],
      consequences: {},
    });

    // Option 3: Hostile/Suspicious response (if character has negative traits)
    if (personalityTraits.includes('hostile') || personalityTraits.includes('suspicious')) {
      options.push({
        id: `option_${Date.now()}_3`,
        text: this.generateHostileResponse(request, character),
        conditions: [],
        consequences: {
          reputation_changes: { [character.faction || 'neutral']: -5 },
        },
      });
    }

    // Option 4: Conditional response based on player stats
    if (request.player_state.stats) {
      const highStat = Object.entries(request.player_state.stats)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (highStat && highStat[1] > 15) {
        options.push({
          id: `option_${Date.now()}_4`,
          text: this.generateStatBasedResponse(highStat[0], highStat[1], character),
          conditions: [{
            type: 'stat',
            target: highStat[0],
            operator: 'greater_than',
            value: 15,
          }],
          consequences: {
            reputation_changes: { [character.faction || 'neutral']: 3 },
          },
        });
      }
    }

    // Option 5: Quest-specific response
    if (request.quest_context) {
      options.push({
        id: `option_${Date.now()}_5`,
        text: this.generateQuestResponse(request.quest_context, character),
        conditions: [{
          type: 'quest',
          target: request.quest_context,
          operator: 'has',
          value: 'in_progress',
        }],
        consequences: {
          quest_triggers: [request.quest_context],
        },
      });
    }

    return options;
  }

  private async generateDialogueText(
    request: DialogueGenerationRequest,
    character: Character,
    options: DialogueOption[],
  ): Promise<string> {
    // This would typically call an AI service
    // For now, we'll generate a template-based response
    
    const templates = {
      greeting: [
        "Greetings, traveler. What brings you to these parts?",
        "Well met, stranger. How may I assist you?",
        "Ah, a visitor. I hope you find what you're looking for.",
      ],
      quest: [
        "I have a task that needs attention, if you're willing.",
        "There's something I need help with. Are you interested?",
        "I could use someone with your skills for a particular job.",
      ],
      general: [
        "What can I do for you today?",
        "Is there something specific you'd like to discuss?",
        "I'm here if you need anything.",
      ],
    };

    let templateKey = 'general';
    if (request.quest_context) {
      templateKey = 'quest';
    } else if (!request.previous_dialogue) {
      templateKey = 'greeting';
    }

    const templateArray = templates[templateKey];
    const randomIndex = Math.floor(Math.random() * templateArray.length);
    
    return templateArray[randomIndex];
  }

  private determineEmotion(request: DialogueGenerationRequest, character: Character): string {
    const emotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'];
    
    // Check player reputation with character's faction
    const factionReputation = request.player_state.reputation[character.faction || 'neutral'] || 0;
    
    if (factionReputation > 50) return 'happy';
    if (factionReputation < -50) return 'angry';
    if (request.emotion_context) return request.emotion_context;
    
    return 'neutral';
  }

  private determineTone(request: DialogueGenerationRequest, character: Character): string {
    const tones = ['formal', 'casual', 'friendly', 'hostile', 'mysterious', 'humorous', 'serious'];
    
    if (request.tone_preference) return request.tone_preference;
    
    // Default based on character personality
    const personalityTraits = character.personality_traits || [];
    
    if (personalityTraits.includes('formal')) return 'formal';
    if (personalityTraits.includes('friendly')) return 'friendly';
    if (personalityTraits.includes('hostile')) return 'hostile';
    if (personalityTraits.includes('mysterious')) return 'mysterious';
    
    return 'casual';
  }

  private generateFriendlyResponse(request: DialogueGenerationRequest, character: Character): string {
    const responses = [
      "I'd be happy to help you with that!",
      "Of course, anything I can do to assist.",
      "You've come to the right person for that.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateNeutralResponse(request: DialogueGenerationRequest, character: Character): string {
    const responses = [
      "I can help you with that.",
      "That's something I can assist with.",
      "Let me see what I can do.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateHostileResponse(request: DialogueGenerationRequest, character: Character): string {
    const responses = [
      "Why should I help you?",
      "I don't see why I should bother.",
      "You'll have to convince me first.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateStatBasedResponse(statName: string, statValue: number, character: Character): string {
    return `Your ${statName} of ${statValue} is impressive. I might have something for someone with your abilities.`;
  }

  private generateQuestResponse(questId: string, character: Character): string {
    return "I see you're working on that quest. How is it progressing?";
  }

  private calculateToneDifference(tone1: string, tone2: string): number {
    const toneMap = {
      formal: 0,
      serious: 1,
      casual: 2,
      friendly: 3,
      humorous: 4,
      mysterious: 5,
      hostile: 6,
    };
    
    const val1 = toneMap[tone1 as keyof typeof toneMap] || 0;
    const val2 = toneMap[tone2 as keyof typeof toneMap] || 0;
    
    return Math.abs(val1 - val2) / 6; // Normalize to 0-1
  }

  private calculateConfidenceScore(
    consistencyChecks: DialogueGenerationResponse['consistency_checks'],
    options: DialogueOption[],
  ): number {
    let score = 1.0;
    
    // Reduce score for consistency issues
    if (!consistencyChecks.lore_consistency) score -= 0.2;
    if (!consistencyChecks.character_consistency) score -= 0.2;
    if (!consistencyChecks.quest_consistency) score -= 0.1;
    
    // Reduce score for warnings
    score -= consistencyChecks.warnings.length * 0.05;
    
    // Increase score for more options
    if (options.length >= 3) score += 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  async checkDialogueConsistency(dialogueId: string): Promise<ConsistencyCheckResult> {
    const dialogue = await this.findOne(dialogueId);
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check character consistency
    if (dialogue.character_id) {
      const character = await this.characterRepository.findOne({
        where: { id: dialogue.character_id },
      });
      
      if (character) {
        // Check if dialogue tone matches character personality
        const personalityTraits = character.personality_traits || [];
        const tone = dialogue.tone || 'casual';
        
        if (personalityTraits.includes('formal') && tone === 'casual') {
          issues.push('Dialogue tone may not match character personality');
          suggestions.push('Consider using a more formal tone for this character');
        }
        
        if (personalityTraits.includes('hostile') && tone === 'friendly') {
          issues.push('Dialogue tone may not match character personality');
          suggestions.push('Consider using a more hostile tone for this character');
        }
      }
    }
    
    // Check quest consistency
    if (dialogue.quest_id) {
      const quest = await this.questRepository.findOne({
        where: { id: dialogue.quest_id },
      });
      
      if (quest) {
        // Check if dialogue content relates to quest
        const questKeywords = quest.title.toLowerCase().split(' ');
        const dialogueContent = dialogue.content.toLowerCase();
        
        const hasRelevance = questKeywords.some(keyword => 
          dialogueContent.includes(keyword)
        );
        
        if (!hasRelevance) {
          issues.push('Dialogue content may not be relevant to the associated quest');
          suggestions.push('Consider adding quest-specific content to the dialogue');
        }
      }
    }
    
    // Check for appropriate dialogue length
    if (dialogue.content.length < 10) {
      issues.push('Dialogue content is very short');
      suggestions.push('Consider expanding the dialogue content');
    }
    
    if (dialogue.content.length > 500) {
      issues.push('Dialogue content is very long');
      suggestions.push('Consider breaking this into multiple dialogue nodes');
    }
    
    const confidenceScore = Math.max(0, 1 - (issues.length * 0.2));
    
    return {
      is_consistent: issues.length === 0,
      issues,
      suggestions,
      confidence_score: confidenceScore,
    };
  }

  async getDialogueTree(dialogueId: string): Promise<any> {
    const dialogue = await this.findOne(dialogueId);
    
    // This would typically build a tree structure from dialogue nodes
    // For now, return a simple structure
    return {
      id: dialogue.id,
      content: dialogue.content,
      character: dialogue.character_id,
      quest: dialogue.quest_id,
      children: [], // Would be populated with connected dialogue nodes
    };
  }
}
