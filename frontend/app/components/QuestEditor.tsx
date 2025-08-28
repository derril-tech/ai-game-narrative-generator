'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  PlusIcon, 
  TrashIcon, 
  ChevronDownIcon, 
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const conditionSchema = z.object({
  type: z.enum(['stat', 'inventory', 'flag', 'quest']),
  operator: z.enum(['eq', 'gt', 'lt', 'gte', 'lte', 'ne', 'has', 'not_has']),
  value: z.string(),
  target: z.string().optional(),
  description: z.string()
});

const rewardSchema = z.object({
  type: z.enum(['experience', 'gold', 'item', 'stat', 'flag', 'quest']),
  value: z.string(),
  amount: z.number().min(1),
  description: z.string()
});

const outcomeSchema = z.object({
  id: z.string(),
  type: z.enum(['success', 'failure', 'partial', 'branch']),
  conditions: z.array(conditionSchema).optional(),
  rewards: z.array(rewardSchema).optional(),
  nextQuestId: z.string().optional(),
  description: z.string(),
  probability: z.number().min(0).max(100).optional()
});

const questSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['escort', 'fetch', 'puzzle', 'boss', 'diplomacy', 'betrayal', 'custom']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'epic']),
  prerequisites: z.array(conditionSchema).optional(),
  rewards: z.array(rewardSchema).optional(),
  outcomes: z.array(outcomeSchema).min(1, 'At least one outcome is required'),
  estimatedDuration: z.number().min(1),
  tags: z.array(z.string()).optional()
});

type QuestFormData = z.infer<typeof questSchema>;

interface QuestEditorProps {
  quest?: Partial<QuestFormData>;
  onSave: (quest: QuestFormData) => void;
  onCancel: () => void;
  availableQuests?: Array<{ id: string; title: string }>;
  availableItems?: Array<{ id: string; name: string; type: string }>;
  availableStats?: Array<{ id: string; name: string; type: string }>;
}

const questTemplates = {
  escort: {
    title: 'Escort Mission',
    description: 'Protect and guide a character to a destination',
    outcomes: [
      {
        id: 'success',
        type: 'success' as const,
        description: 'Successfully escorted the target to destination',
        probability: 70
      },
      {
        id: 'failure',
        type: 'failure' as const,
        description: 'Failed to protect the target',
        probability: 30
      }
    ]
  },
  fetch: {
    title: 'Fetch Quest',
    description: 'Retrieve an item from a specific location',
    outcomes: [
      {
        id: 'success',
        type: 'success' as const,
        description: 'Successfully retrieved the item',
        probability: 80
      },
      {
        id: 'partial',
        type: 'partial' as const,
        description: 'Retrieved a similar but inferior item',
        probability: 15
      },
      {
        id: 'failure',
        type: 'failure' as const,
        description: 'Failed to find the item',
        probability: 5
      }
    ]
  },
  puzzle: {
    title: 'Puzzle Quest',
    description: 'Solve a complex puzzle or riddle',
    outcomes: [
      {
        id: 'success',
        type: 'success' as const,
        description: 'Solved the puzzle correctly',
        probability: 60
      },
      {
        id: 'partial',
        type: 'partial' as const,
        description: 'Solved with hints or partial solution',
        probability: 30
      },
      {
        id: 'failure',
        type: 'failure' as const,
        description: 'Failed to solve the puzzle',
        probability: 10
      }
    ]
  },
  boss: {
    title: 'Boss Battle',
    description: 'Defeat a powerful enemy in combat',
    outcomes: [
      {
        id: 'success',
        type: 'success' as const,
        description: 'Defeated the boss',
        probability: 50
      },
      {
        id: 'partial',
        type: 'partial' as const,
        description: 'Drove the boss away but didn\'t kill it',
        probability: 35
      },
      {
        id: 'failure',
        type: 'failure' as const,
        description: 'Defeated by the boss',
        probability: 15
      }
    ]
  },
  diplomacy: {
    title: 'Diplomatic Mission',
    description: 'Resolve conflict through negotiation',
    outcomes: [
      {
        id: 'success',
        type: 'success' as const,
        description: 'Successfully negotiated a peaceful resolution',
        probability: 65
      },
      {
        id: 'partial',
        type: 'partial' as const,
        description: 'Reached a compromise',
        probability: 25
      },
      {
        id: 'failure',
        type: 'failure' as const,
        description: 'Negotiations failed, conflict escalated',
        probability: 10
      }
    ]
  },
  betrayal: {
    title: 'Betrayal Quest',
    description: 'Navigate a situation involving deception',
    outcomes: [
      {
        id: 'success',
        type: 'success' as const,
        description: 'Successfully uncovered the betrayal',
        probability: 40
      },
      {
        id: 'branch',
        type: 'branch' as const,
        description: 'Joined the betrayer\'s side',
        probability: 30
      },
      {
        id: 'failure',
        type: 'failure' as const,
        description: 'Fell victim to the betrayal',
        probability: 30
      }
    ]
  }
};

const QuestEditor: React.FC<QuestEditorProps> = ({
  quest,
  onSave,
  onCancel,
  availableQuests = [],
  availableItems = [],
  availableStats = []
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'outcomes']));
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<QuestFormData>({
    resolver: zodResolver(questSchema),
    defaultValues: {
      id: quest?.id || `quest_${Date.now()}`,
      title: quest?.title || '',
      description: quest?.description || '',
      type: quest?.type || 'custom',
      difficulty: quest?.difficulty || 'medium',
      prerequisites: quest?.prerequisites || [],
      rewards: quest?.rewards || [],
      outcomes: quest?.outcomes || [],
      estimatedDuration: quest?.estimatedDuration || 30,
      tags: quest?.tags || []
    }
  });

  const watchedType = watch('type');

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const applyTemplate = (templateType: string) => {
    const template = questTemplates[templateType as keyof typeof questTemplates];
    if (template) {
      setValue('title', template.title);
      setValue('description', template.description);
      setValue('outcomes', template.outcomes);
      setSelectedTemplate(templateType);
    }
  };

  const addCondition = (type: 'prerequisites' | 'outcomes', outcomeIndex?: number) => {
    const newCondition = {
      type: 'stat' as const,
      operator: 'eq' as const,
      value: '',
      description: ''
    };

    if (type === 'prerequisites') {
      const current = watch('prerequisites') || [];
      setValue('prerequisites', [...current, newCondition]);
    } else if (outcomeIndex !== undefined) {
      const current = watch('outcomes') || [];
      const updatedOutcomes = [...current];
      updatedOutcomes[outcomeIndex] = {
        ...updatedOutcomes[outcomeIndex],
        conditions: [...(updatedOutcomes[outcomeIndex].conditions || []), newCondition]
      };
      setValue('outcomes', updatedOutcomes);
    }
  };

  const removeCondition = (type: 'prerequisites' | 'outcomes', index: number, outcomeIndex?: number) => {
    if (type === 'prerequisites') {
      const current = watch('prerequisites') || [];
      setValue('prerequisites', current.filter((_, i) => i !== index));
    } else if (outcomeIndex !== undefined) {
      const current = watch('outcomes') || [];
      const updatedOutcomes = [...current];
      updatedOutcomes[outcomeIndex] = {
        ...updatedOutcomes[outcomeIndex],
        conditions: updatedOutcomes[outcomeIndex].conditions?.filter((_, i) => i !== index) || []
      };
      setValue('outcomes', updatedOutcomes);
    }
  };

  const addReward = (type: 'quest' | 'outcomes', outcomeIndex?: number) => {
    const newReward = {
      type: 'experience' as const,
      value: '',
      amount: 1,
      description: ''
    };

    if (type === 'quest') {
      const current = watch('rewards') || [];
      setValue('rewards', [...current, newReward]);
    } else if (outcomeIndex !== undefined) {
      const current = watch('outcomes') || [];
      const updatedOutcomes = [...current];
      updatedOutcomes[outcomeIndex] = {
        ...updatedOutcomes[outcomeIndex],
        rewards: [...(updatedOutcomes[outcomeIndex].rewards || []), newReward]
      };
      setValue('outcomes', updatedOutcomes);
    }
  };

  const removeReward = (type: 'quest' | 'outcomes', index: number, outcomeIndex?: number) => {
    if (type === 'quest') {
      const current = watch('rewards') || [];
      setValue('rewards', current.filter((_, i) => i !== index));
    } else if (outcomeIndex !== undefined) {
      const current = watch('outcomes') || [];
      const updatedOutcomes = [...current];
      updatedOutcomes[outcomeIndex] = {
        ...updatedOutcomes[outcomeIndex],
        rewards: updatedOutcomes[outcomeIndex].rewards?.filter((_, i) => i !== index) || []
      };
      setValue('outcomes', updatedOutcomes);
    }
  };

  const addOutcome = () => {
    const current = watch('outcomes') || [];
    const newOutcome = {
      id: `outcome_${Date.now()}`,
      type: 'success' as const,
      description: '',
      probability: 100
    };
    setValue('outcomes', [...current, newOutcome]);
  };

  const removeOutcome = (index: number) => {
    const current = watch('outcomes') || [];
    setValue('outcomes', current.filter((_, i) => i !== index));
  };

  const onSubmit = (data: QuestFormData) => {
    onSave(data);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {quest?.id ? 'Edit Quest' : 'Create New Quest'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={!isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Quest
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Template Selection */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Quest Template</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(questTemplates).map(([key, template]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key)}
                className={`p-3 text-left rounded-lg border-2 transition-colors ${
                  selectedTemplate === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{template.title}</div>
                <div className="text-xs text-gray-600 mt-1">{template.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Basic Information */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('basic')}
            className="w-full p-4 text-left flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-semibold">Basic Information</h3>
            {expandedSections.has('basic') ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </button>
          
          {expandedSections.has('basic') && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter quest title"
                      />
                    )}
                  />
                  {errors.title && (
                    <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="custom">Custom</option>
                        <option value="escort">Escort</option>
                        <option value="fetch">Fetch</option>
                        <option value="puzzle">Puzzle</option>
                        <option value="boss">Boss Battle</option>
                        <option value="diplomacy">Diplomacy</option>
                        <option value="betrayal">Betrayal</option>
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <Controller
                    name="difficulty"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                        <option value="epic">Epic</option>
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Duration (minutes)
                  </label>
                  <Controller
                    name="estimatedDuration"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="number"
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe the quest objectives and context"
                    />
                  )}
                />
                {errors.description && (
                  <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Prerequisites */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('prerequisites')}
            className="w-full p-4 text-left flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-semibold">Prerequisites</h3>
            {expandedSections.has('prerequisites') ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </button>
          
          {expandedSections.has('prerequisites') && (
            <div className="p-4">
              <ConditionList
                conditions={watch('prerequisites') || []}
                onAdd={() => addCondition('prerequisites')}
                onRemove={(index) => removeCondition('prerequisites', index)}
                control={control}
                name="prerequisites"
                availableQuests={availableQuests}
                availableItems={availableItems}
                availableStats={availableStats}
              />
            </div>
          )}
        </div>

        {/* Quest Rewards */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('rewards')}
            className="w-full p-4 text-left flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-semibold">Quest Rewards</h3>
            {expandedSections.has('rewards') ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </button>
          
          {expandedSections.has('rewards') && (
            <div className="p-4">
              <RewardList
                rewards={watch('rewards') || []}
                onAdd={() => addReward('quest')}
                onRemove={(index) => removeReward('quest', index)}
                control={control}
                name="rewards"
                availableQuests={availableQuests}
                availableItems={availableItems}
              />
            </div>
          )}
        </div>

        {/* Outcomes */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => toggleSection('outcomes')}
            className="w-full p-4 text-left flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-lg font-semibold">Outcomes</h3>
            {expandedSections.has('outcomes') ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </button>
          
          {expandedSections.has('outcomes') && (
            <div className="p-4">
              <OutcomeList
                outcomes={watch('outcomes') || []}
                onAdd={addOutcome}
                onRemove={removeOutcome}
                onAddCondition={addCondition}
                onRemoveCondition={removeCondition}
                onAddReward={addReward}
                onRemoveReward={removeReward}
                control={control}
                availableQuests={availableQuests}
                availableItems={availableItems}
                availableStats={availableStats}
              />
              {errors.outcomes && (
                <p className="text-red-600 text-sm mt-2">{errors.outcomes.message}</p>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

// Condition List Component
const ConditionList: React.FC<{
  conditions: any[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  control: any;
  name: string;
  availableQuests?: Array<{ id: string; title: string }>;
  availableItems?: Array<{ id: string; name: string; type: string }>;
  availableStats?: Array<{ id: string; name: string; type: string }>;
}> = ({ conditions, onAdd, onRemove, control, name, availableQuests, availableItems, availableStats }) => (
  <div className="space-y-4">
    {conditions.map((condition, index) => (
      <div key={index} className="border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium">Condition {index + 1}</h4>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-800"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Controller
              name={`${name}.${index}.type`}
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="stat">Stat</option>
                  <option value="inventory">Inventory</option>
                  <option value="flag">Flag</option>
                  <option value="quest">Quest</option>
                </select>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
            <Controller
              name={`${name}.${index}.operator`}
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="eq">Equals</option>
                  <option value="gt">Greater Than</option>
                  <option value="lt">Less Than</option>
                  <option value="gte">Greater Than or Equal</option>
                  <option value="lte">Less Than or Equal</option>
                  <option value="ne">Not Equal</option>
                  <option value="has">Has</option>
                  <option value="not_has">Does Not Have</option>
                </select>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            <Controller
              name={`${name}.${index}.value`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter condition value"
                />
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Controller
              name={`${name}.${index}.description`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Human readable description"
                />
              )}
            />
          </div>
        </div>
      </div>
    ))}
    
    <button
      type="button"
      onClick={onAdd}
      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
    >
      <PlusIcon className="w-4 h-4" />
      Add Condition
    </button>
  </div>
);

// Reward List Component
const RewardList: React.FC<{
  rewards: any[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  control: any;
  name: string;
  availableQuests?: Array<{ id: string; title: string }>;
  availableItems?: Array<{ id: string; name: string; type: string }>;
}> = ({ rewards, onAdd, onRemove, control, name, availableQuests, availableItems }) => (
  <div className="space-y-4">
    {rewards.map((reward, index) => (
      <div key={index} className="border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium">Reward {index + 1}</h4>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-800"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Controller
              name={`${name}.${index}.type`}
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="experience">Experience</option>
                  <option value="gold">Gold</option>
                  <option value="item">Item</option>
                  <option value="stat">Stat</option>
                  <option value="flag">Flag</option>
                  <option value="quest">Quest</option>
                </select>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <Controller
              name={`${name}.${index}.amount`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            <Controller
              name={`${name}.${index}.value`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter reward value"
                />
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Controller
              name={`${name}.${index}.description`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Human readable description"
                />
              )}
            />
          </div>
        </div>
      </div>
    ))}
    
    <button
      type="button"
      onClick={onAdd}
      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
    >
      <PlusIcon className="w-4 h-4" />
      Add Reward
    </button>
  </div>
);

// Outcome List Component
const OutcomeList: React.FC<{
  outcomes: any[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onAddCondition: (type: 'outcomes', outcomeIndex: number) => void;
  onRemoveCondition: (type: 'outcomes', conditionIndex: number, outcomeIndex: number) => void;
  onAddReward: (type: 'outcomes', outcomeIndex: number) => void;
  onRemoveReward: (type: 'outcomes', rewardIndex: number, outcomeIndex: number) => void;
  control: any;
  availableQuests?: Array<{ id: string; title: string }>;
  availableItems?: Array<{ id: string; name: string; type: string }>;
  availableStats?: Array<{ id: string; name: string; type: string }>;
}> = ({ 
  outcomes, 
  onAdd, 
  onRemove, 
  onAddCondition, 
  onRemoveCondition, 
  onAddReward, 
  onRemoveReward, 
  control,
  availableQuests,
  availableItems,
  availableStats
}) => (
  <div className="space-y-6">
    {outcomes.map((outcome, index) => (
      <div key={index} className="border rounded-lg p-4 bg-blue-50">
        <div className="flex justify-between items-start mb-4">
          <h4 className="font-medium text-lg">Outcome {index + 1}</h4>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-800"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Controller
              name={`outcomes.${index}.type`}
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="partial">Partial Success</option>
                  <option value="branch">Branch</option>
                </select>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
            <Controller
              name={`outcomes.${index}.probability`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Controller
              name={`outcomes.${index}.description`}
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe what happens in this outcome"
                />
              )}
            />
          </div>
        </div>

        {/* Outcome Conditions */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h5 className="font-medium text-gray-700">Conditions</h5>
            <button
              type="button"
              onClick={() => onAddCondition('outcomes', index)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              <PlusIcon className="w-4 h-4 inline mr-1" />
              Add Condition
            </button>
          </div>
          <ConditionList
            conditions={outcome.conditions || []}
            onAdd={() => onAddCondition('outcomes', index)}
            onRemove={(conditionIndex) => onRemoveCondition('outcomes', conditionIndex, index)}
            control={control}
            name={`outcomes.${index}.conditions`}
            availableQuests={availableQuests}
            availableItems={availableItems}
            availableStats={availableStats}
          />
        </div>

        {/* Outcome Rewards */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h5 className="font-medium text-gray-700">Rewards</h5>
            <button
              type="button"
              onClick={() => onAddReward('outcomes', index)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              <PlusIcon className="w-4 h-4 inline mr-1" />
              Add Reward
            </button>
          </div>
          <RewardList
            rewards={outcome.rewards || []}
            onAdd={() => onAddReward('outcomes', index)}
            onRemove={(rewardIndex) => onRemoveReward('outcomes', rewardIndex, index)}
            control={control}
            name={`outcomes.${index}.rewards`}
            availableQuests={availableQuests}
            availableItems={availableItems}
          />
        </div>
      </div>
    ))}
    
    <button
      type="button"
      onClick={onAdd}
      className="w-full p-4 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-400 hover:text-blue-800 transition-colors flex items-center justify-center gap-2 bg-blue-50"
    >
      <PlusIcon className="w-5 h-5" />
      Add Outcome
    </button>
  </div>
);

export default QuestEditor;
