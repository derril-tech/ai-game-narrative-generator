// Shared types and utilities for AI Narrative Generator

export interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
}

export interface StoryArc {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  meta: Record<string, any>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Quest {
  id: string;
  projectId: string;
  storyArcId?: string;
  title: string;
  description?: string;
  conditions: any[];
  rewards: any[];
  outcomes: any[];
  questType: string;
  difficulty: number;
  estimatedDuration: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Dialogue {
  id: string;
  projectId: string;
  questId?: string;
  characterId?: string;
  nodeGraph: Record<string, any>;
  conditions: any[];
  nextNodes: any[];
  emotion?: string;
  tone?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface LoreEntry {
  id: string;
  projectId: string;
  category: string;
  name: string;
  description?: string;
  content?: string;
  embedding?: number[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  faction?: string;
  traits: any[];
  backstory?: string;
  personality: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Simulation {
  id: string;
  projectId: string;
  playerProfile: Record<string, any>;
  results: Record<string, any>;
  reputationChanges: Record<string, any>;
  alignmentChanges: Record<string, any>;
  timeline: any[];
  createdAt: Date;
  createdBy: string;
}

export interface Export {
  id: string;
  projectId: string;
  kind: string;
  s3Key?: string;
  meta: Record<string, any>;
  status: string;
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Agent request/response types
export interface StoryGenerationRequest {
  projectId: string;
  title: string;
  description?: string;
  genre?: string;
  targetAudience?: string;
  complexityLevel?: string;
  userId: string;
}

export interface StoryGenerationResponse {
  storyArcId: string;
  status: string;
  storyArc?: Record<string, any>;
  reasoningTrace?: string;
  error?: string;
}

export interface QuestGenerationRequest {
  projectId: string;
  storyArcId: string;
  questType?: string;
  difficulty?: number;
  userId: string;
}

export interface QuestGenerationResponse {
  questId: string;
  status: string;
  quest?: Record<string, any>;
  reasoningTrace?: string;
  error?: string;
}

export interface DialogueGenerationRequest {
  projectId: string;
  questId: string;
  characterId?: string;
  emotion?: string;
  tone?: string;
  userId: string;
}

export interface DialogueGenerationResponse {
  dialogueId: string;
  status: string;
  dialogue?: Record<string, any>;
  reasoningTrace?: string;
  error?: string;
}

// Utility types
export type ContentPolicy = {
  ageRating: string;
  themes: string[];
  tone: string;
  maxViolenceLevel: string;
  maxLanguageLevel: string;
};

export type AgentType = 
  | 'story-architect'
  | 'quest-designer'
  | 'dialogue-writer'
  | 'lore-keeper'
  | 'simulator'
  | 'exporter';

export type ExportFormat = 'json' | 'yaml' | 'pdf' | 'html';

// Constants
export const AGENT_TYPES: AgentType[] = [
  'story-architect',
  'quest-designer',
  'dialogue-writer',
  'lore-keeper',
  'simulator',
  'exporter'
];

export const EXPORT_FORMATS: ExportFormat[] = ['json', 'yaml', 'pdf', 'html'];

export const CONTENT_POLICY_DEFAULTS: ContentPolicy = {
  ageRating: 'teen',
  themes: ['fantasy', 'adventure', 'mystery'],
  tone: 'neutral',
  maxViolenceLevel: 'moderate',
  maxLanguageLevel: 'mild'
};
