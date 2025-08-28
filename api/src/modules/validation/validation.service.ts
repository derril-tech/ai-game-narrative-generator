import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoryArc } from '../../entities/story-arc.entity';
import { Quest } from '../../entities/quest.entity';
import { Dialogue } from '../../entities/dialogue.entity';

export interface ValidationError {
  type: 'orphan' | 'unreachable' | 'broken_chain' | 'invalid_condition' | 'circular_dependency' | 'missing_prerequisites';
  nodeId?: string;
  edgeId?: string;
  message: string;
  severity: 'error' | 'warning';
  suggestions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  exportReady: boolean;
  summary: {
    totalNodes: number;
    totalEdges: number;
    orphanNodes: number;
    unreachableNodes: number;
    brokenChains: number;
    circularDependencies: number;
  };
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    @InjectRepository(StoryArc)
    private storyArcRepository: Repository<StoryArc>,
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,
    @InjectRepository(Dialogue)
    private dialogueRepository: Repository<Dialogue>,
  ) {}

  /**
   * Validate a complete story graph for a project
   */
  async validateStoryGraph(projectId: string): Promise<ValidationResult> {
    this.logger.log(`Starting validation for project ${projectId}`);

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Fetch all story elements for the project
      const storyArcs = await this.storyArcRepository.find({
        where: { projectId },
        relations: ['quests', 'dialogues']
      });

      const quests = await this.questRepository.find({
        where: { projectId },
        relations: ['prerequisites', 'outcomes', 'storyArc']
      });

      const dialogues = await this.dialogueRepository.find({
        where: { projectId },
        relations: ['quest', 'storyArc']
      });

      // Build graph representation
      const graph = this.buildGraph(storyArcs, quests, dialogues);

      // Perform validation checks
      const orphanErrors = this.detectOrphanNodes(graph);
      const unreachableErrors = this.detectUnreachableNodes(graph);
      const brokenChainErrors = this.detectBrokenChains(graph);
      const circularErrors = this.detectCircularDependencies(graph);
      const prerequisiteErrors = this.validatePrerequisites(graph);
      const conditionErrors = this.validateConditions(graph);

      // Combine all errors and warnings
      errors.push(...orphanErrors.filter(e => e.severity === 'error'));
      errors.push(...unreachableErrors.filter(e => e.severity === 'error'));
      errors.push(...brokenChainErrors.filter(e => e.severity === 'error'));
      errors.push(...circularErrors.filter(e => e.severity === 'error'));
      errors.push(...prerequisiteErrors.filter(e => e.severity === 'error'));
      errors.push(...conditionErrors.filter(e => e.severity === 'error'));

      warnings.push(...orphanErrors.filter(e => e.severity === 'warning'));
      warnings.push(...unreachableErrors.filter(e => e.severity === 'warning'));
      warnings.push(...brokenChainErrors.filter(e => e.severity === 'warning'));
      warnings.push(...circularErrors.filter(e => e.severity === 'warning'));
      warnings.push(...prerequisiteErrors.filter(e => e.severity === 'warning'));
      warnings.push(...conditionErrors.filter(e => e.severity === 'warning'));

      // Generate summary
      const summary = this.generateSummary(graph, errors, warnings);

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        exportReady: errors.length === 0 && warnings.length < 5, // Allow some warnings
        summary
      };

      this.logger.log(`Validation completed for project ${projectId}: ${errors.length} errors, ${warnings.length} warnings`);
      return result;

    } catch (error) {
      this.logger.error(`Validation failed for project ${projectId}:`, error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Validate a specific quest and its connections
   */
  async validateQuest(questId: string): Promise<ValidationResult> {
    this.logger.log(`Starting validation for quest ${questId}`);

    const quest = await this.questRepository.findOne({
      where: { id: questId },
      relations: ['prerequisites', 'outcomes', 'storyArc', 'dialogues']
    });

    if (!quest) {
      throw new Error(`Quest ${questId} not found`);
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate quest-specific rules
    const questErrors = this.validateQuestStructure(quest);
    const prerequisiteErrors = this.validateQuestPrerequisites(quest);
    const outcomeErrors = this.validateQuestOutcomes(quest);

    errors.push(...questErrors.filter(e => e.severity === 'error'));
    errors.push(...prerequisiteErrors.filter(e => e.severity === 'error'));
    errors.push(...outcomeErrors.filter(e => e.severity === 'error'));

    warnings.push(...questErrors.filter(e => e.severity === 'warning'));
    warnings.push(...prerequisiteErrors.filter(e => e.severity === 'warning'));
    warnings.push(...outcomeErrors.filter(e => e.severity === 'warning'));

    const summary = {
      totalNodes: 1,
      totalEdges: (quest.prerequisites?.length || 0) + (quest.outcomes?.length || 0),
      orphanNodes: 0,
      unreachableNodes: 0,
      brokenChains: 0,
      circularDependencies: 0
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      exportReady: errors.length === 0,
      summary
    };
  }

  /**
   * Build graph representation from entities
   */
  private buildGraph(storyArcs: StoryArc[], quests: Quest[], dialogues: Dialogue[]) {
    const nodes = new Map<string, any>();
    const edges = new Map<string, any>();

    // Add story arcs as nodes
    storyArcs.forEach(arc => {
      nodes.set(arc.id, {
        id: arc.id,
        type: 'story_arc',
        label: arc.title,
        data: arc,
        incoming: [],
        outgoing: []
      });
    });

    // Add quests as nodes
    quests.forEach(quest => {
      nodes.set(quest.id, {
        id: quest.id,
        type: 'quest',
        label: quest.title,
        data: quest,
        incoming: [],
        outgoing: []
      });
    });

    // Add dialogues as nodes
    dialogues.forEach(dialogue => {
      nodes.set(dialogue.id, {
        id: dialogue.id,
        type: 'dialogue',
        label: dialogue.title,
        data: dialogue,
        incoming: [],
        outgoing: []
      });
    });

    // Build edges from relationships
    quests.forEach(quest => {
      // Quest to story arc
      if (quest.storyArcId) {
        const edgeId = `${quest.id}_to_${quest.storyArcId}`;
        edges.set(edgeId, {
          id: edgeId,
          source: quest.id,
          target: quest.storyArcId,
          type: 'belongs_to'
        });
        this.addEdgeToNodes(nodes, quest.id, quest.storyArcId);
      }

      // Quest prerequisites
      quest.prerequisites?.forEach(prereq => {
        const edgeId = `${prereq.id}_to_${quest.id}`;
        edges.set(edgeId, {
          id: edgeId,
          source: prereq.id,
          target: quest.id,
          type: 'prerequisite',
          data: prereq
        });
        this.addEdgeToNodes(nodes, prereq.id, quest.id);
      });

      // Quest outcomes
      quest.outcomes?.forEach(outcome => {
        if (outcome.nextQuestId) {
          const edgeId = `${quest.id}_to_${outcome.nextQuestId}`;
          edges.set(edgeId, {
            id: edgeId,
            source: quest.id,
            target: outcome.nextQuestId,
            type: 'outcome',
            data: outcome
          });
          this.addEdgeToNodes(nodes, quest.id, outcome.nextQuestId);
        }
      });
    });

    // Dialogue connections
    dialogues.forEach(dialogue => {
      if (dialogue.questId) {
        const edgeId = `${dialogue.id}_to_${dialogue.questId}`;
        edges.set(edgeId, {
          id: edgeId,
          source: dialogue.id,
          target: dialogue.questId,
          type: 'belongs_to'
        });
        this.addEdgeToNodes(nodes, dialogue.id, dialogue.questId);
      }
    });

    return { nodes, edges };
  }

  private addEdgeToNodes(nodes: Map<string, any>, sourceId: string, targetId: string) {
    const sourceNode = nodes.get(sourceId);
    const targetNode = nodes.get(targetId);

    if (sourceNode) {
      sourceNode.outgoing.push(targetId);
    }
    if (targetNode) {
      targetNode.incoming.push(sourceId);
    }
  }

  /**
   * Detect orphan nodes (no incoming or outgoing connections)
   */
  private detectOrphanNodes(graph: { nodes: Map<string, any>; edges: Map<string, any> }): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [nodeId, node] of graph.nodes) {
      if (node.incoming.length === 0 && node.outgoing.length === 0) {
        errors.push({
          type: 'orphan',
          nodeId,
          message: `${node.type} "${node.label}" has no connections`,
          severity: 'warning',
          suggestions: [
            'Connect this node to other story elements',
            'Add prerequisites or outcomes',
            'Consider removing if not needed'
          ]
        });
      }
    }

    return errors;
  }

  /**
   * Detect unreachable nodes (no path from start)
   */
  private detectUnreachableNodes(graph: { nodes: Map<string, any>; edges: Map<string, any> }): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<string>();

    // Find start nodes (story arcs with no incoming connections)
    const startNodes = Array.from(graph.nodes.values()).filter(node => 
      node.type === 'story_arc' && node.incoming.length === 0
    );

    // DFS from start nodes
    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        node.outgoing.forEach(outgoingId => {
          dfs(outgoingId);
        });
      }
    };

    startNodes.forEach(startNode => {
      dfs(startNode.id);
    });

    // Check for unreachable nodes
    for (const [nodeId, node] of graph.nodes) {
      if (!visited.has(nodeId)) {
        errors.push({
          type: 'unreachable',
          nodeId,
          message: `${node.type} "${node.label}" is unreachable from any start point`,
          severity: 'error',
          suggestions: [
            'Add a connection from a story arc',
            'Create a prerequisite relationship',
            'Ensure there is a path from the beginning'
          ]
        });
      }
    }

    return errors;
  }

  /**
   * Detect broken chains (nodes with missing prerequisites)
   */
  private detectBrokenChains(graph: { nodes: Map<string, any>; edges: Map<string, any> }): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [nodeId, node] of graph.nodes) {
      if (node.type === 'quest' && node.incoming.length === 0) {
        // Check if this quest has prerequisites defined but no connections
        const quest = node.data as Quest;
        if (quest.prerequisites && quest.prerequisites.length > 0) {
          errors.push({
            type: 'broken_chain',
            nodeId,
            message: `Quest "${node.label}" has prerequisites but no incoming connections`,
            severity: 'error',
            suggestions: [
              'Connect prerequisite quests to this quest',
              'Remove prerequisites if not needed',
              'Create the missing prerequisite quests'
            ]
          });
        }
      }
    }

    return errors;
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: { nodes: Map<string, any>; edges: Map<string, any> }): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        for (const outgoingId of node.outgoing) {
          if (hasCycle(outgoingId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const [nodeId] of graph.nodes) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          const node = graph.nodes.get(nodeId);
          errors.push({
            type: 'circular_dependency',
            nodeId,
            message: `Circular dependency detected involving ${node.type} "${node.label}"`,
            severity: 'error',
            suggestions: [
              'Remove one of the circular connections',
              'Restructure the quest flow',
              'Use conditional outcomes instead of direct cycles'
            ]
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate prerequisites exist and are properly connected
   */
  private validatePrerequisites(graph: { nodes: Map<string, any>; edges: Map<string, any> }): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [nodeId, node] of graph.nodes) {
      if (node.type === 'quest') {
        const quest = node.data as Quest;
        if (quest.prerequisites) {
          quest.prerequisites.forEach(prereq => {
            if (!graph.nodes.has(prereq.id)) {
              errors.push({
                type: 'missing_prerequisites',
                nodeId,
                message: `Quest "${node.label}" references non-existent prerequisite`,
                severity: 'error',
                suggestions: [
                  'Create the missing prerequisite quest',
                  'Remove the invalid prerequisite reference',
                  'Update the prerequisite ID'
                ]
              });
            }
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate conditions in quests and outcomes
   */
  private validateConditions(graph: { nodes: Map<string, any>; edges: Map<string, any> }): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [nodeId, node] of graph.nodes) {
      if (node.type === 'quest') {
        const quest = node.data as Quest;
        
        // Validate quest prerequisites conditions
        quest.prerequisites?.forEach(prereq => {
          if (prereq.conditions) {
            prereq.conditions.forEach(condition => {
              if (!this.isValidCondition(condition)) {
                errors.push({
                  type: 'invalid_condition',
                  nodeId,
                  message: `Invalid condition in quest "${node.label}" prerequisites`,
                  severity: 'error',
                  suggestions: [
                    'Check condition syntax and values',
                    'Ensure all referenced items/stats exist',
                    'Validate condition operators'
                  ]
                });
              }
            });
          }
        });

        // Validate quest outcomes conditions
        quest.outcomes?.forEach(outcome => {
          if (outcome.conditions) {
            outcome.conditions.forEach(condition => {
              if (!this.isValidCondition(condition)) {
                errors.push({
                  type: 'invalid_condition',
                  nodeId,
                  message: `Invalid condition in quest "${node.label}" outcomes`,
                  severity: 'error',
                  suggestions: [
                    'Check condition syntax and values',
                    'Ensure all referenced items/stats exist',
                    'Validate condition operators'
                  ]
                });
              }
            });
          }
        });
      }
    }

    return errors;
  }

  /**
   * Validate quest structure and completeness
   */
  private validateQuestStructure(quest: Quest): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for required fields
    if (!quest.title || quest.title.trim().length === 0) {
      errors.push({
        type: 'broken_chain',
        nodeId: quest.id,
        message: 'Quest title is required',
        severity: 'error'
      });
    }

    if (!quest.description || quest.description.trim().length === 0) {
      errors.push({
        type: 'broken_chain',
        nodeId: quest.id,
        message: 'Quest description is required',
        severity: 'error'
      });
    }

    // Check for at least one outcome
    if (!quest.outcomes || quest.outcomes.length === 0) {
      errors.push({
        type: 'broken_chain',
        nodeId: quest.id,
        message: 'Quest must have at least one outcome',
        severity: 'error'
      });
    }

    // Validate outcome probabilities sum to 100%
    if (quest.outcomes && quest.outcomes.length > 0) {
      const totalProbability = quest.outcomes.reduce((sum, outcome) => sum + (outcome.probability || 0), 0);
      if (Math.abs(totalProbability - 100) > 0.01) {
        errors.push({
          type: 'broken_chain',
          nodeId: quest.id,
          message: `Outcome probabilities must sum to 100% (current: ${totalProbability}%)`,
          severity: 'warning'
        });
      }
    }

    return errors;
  }

  /**
   * Validate quest prerequisites
   */
  private validateQuestPrerequisites(quest: Quest): ValidationError[] {
    const errors: ValidationError[] = [];

    if (quest.prerequisites) {
      quest.prerequisites.forEach(prereq => {
        if (!prereq.id) {
          errors.push({
            type: 'missing_prerequisites',
            nodeId: quest.id,
            message: 'Prerequisite quest ID is required',
            severity: 'error'
          });
        }
      });
    }

    return errors;
  }

  /**
   * Validate quest outcomes
   */
  private validateQuestOutcomes(quest: Quest): ValidationError[] {
    const errors: ValidationError[] = [];

    if (quest.outcomes) {
      quest.outcomes.forEach((outcome, index) => {
        if (!outcome.description || outcome.description.trim().length === 0) {
          errors.push({
            type: 'broken_chain',
            nodeId: quest.id,
            message: `Outcome ${index + 1} description is required`,
            severity: 'error'
          });
        }

        if (outcome.probability !== undefined && (outcome.probability < 0 || outcome.probability > 100)) {
          errors.push({
            type: 'broken_chain',
            nodeId: quest.id,
            message: `Outcome ${index + 1} probability must be between 0 and 100`,
            severity: 'error'
          });
        }
      });
    }

    return errors;
  }

  /**
   * Validate individual condition
   */
  private isValidCondition(condition: any): boolean {
    if (!condition.type || !condition.operator || !condition.value) {
      return false;
    }

    const validTypes = ['stat', 'inventory', 'flag', 'quest'];
    const validOperators = ['eq', 'gt', 'lt', 'gte', 'lte', 'ne', 'has', 'not_has'];

    if (!validTypes.includes(condition.type)) {
      return false;
    }

    if (!validOperators.includes(condition.operator)) {
      return false;
    }

    // Additional validation based on type and operator
    if (condition.type === 'stat' && ['has', 'not_has'].includes(condition.operator)) {
      return false; // Stats don't support has/not_has operators
    }

    return true;
  }

  /**
   * Generate validation summary
   */
  private generateSummary(
    graph: { nodes: Map<string, any>; edges: Map<string, any> },
    errors: ValidationError[],
    warnings: ValidationError[]
  ) {
    const orphanNodes = errors.filter(e => e.type === 'orphan').length;
    const unreachableNodes = errors.filter(e => e.type === 'unreachable').length;
    const brokenChains = errors.filter(e => e.type === 'broken_chain').length;
    const circularDependencies = errors.filter(e => e.type === 'circular_dependency').length;

    return {
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.size,
      orphanNodes,
      unreachableNodes,
      brokenChains,
      circularDependencies
    };
  }
}
