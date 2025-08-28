'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

// Schema definitions
const conditionSchema = z.object({
  type: z.enum(['stat', 'flag', 'item', 'quest']),
  target: z.string().min(1, 'Target is required'),
  operator: z.enum(['equals', 'greater_than', 'less_than', 'has', 'not_has']),
  value: z.string().min(1, 'Value is required'),
});

const dialogueNodeSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Dialogue text is required'),
  character_id: z.string().optional(),
  emotion: z.enum(['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted']).default('neutral'),
  tone: z.enum(['formal', 'casual', 'friendly', 'hostile', 'mysterious', 'humorous', 'serious']).default('casual'),
  conditions: z.array(conditionSchema).default([]),
  responses: z.array(z.object({
    id: z.string(),
    text: z.string().min(1, 'Response text is required'),
    next_node_id: z.string().optional(),
    conditions: z.array(conditionSchema).default([]),
  })).default([]),
  is_root: z.boolean().default(false),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0, y: 0 }),
});

const dialogueTreeSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  nodes: z.array(dialogueNodeSchema),
  metadata: z.object({
    character_id: z.string().optional(),
    quest_id: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }).default({}),
});

type DialogueNode = z.infer<typeof dialogueNodeSchema>;
type DialogueTree = z.infer<typeof dialogueTreeSchema>;
type Condition = z.infer<typeof conditionSchema>;

interface DialogueTreeProps {
  dialogueTree: DialogueTree;
  onSave: (tree: DialogueTree) => void;
  onCancel: () => void;
  characters?: Array<{ id: string; name: string; voice_tone: string }>;
  quests?: Array<{ id: string; title: string }>;
  stats?: Array<{ id: string; name: string }>;
  flags?: Array<{ id: string; name: string }>;
  items?: Array<{ id: string; name: string }>;
}

const DialogueTree: React.FC<DialogueTreeProps> = ({
  dialogueTree,
  onSave,
  onCancel,
  characters = [],
  quests = [],
  stats = [],
  flags = [],
  items = [],
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [showConditions, setShowConditions] = useState<Record<string, boolean>>({});
  const [showResponses, setShowResponses] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<DialogueTree>({
    resolver: zodResolver(dialogueTreeSchema),
    defaultValues: dialogueTree,
  });

  const { fields: nodes, append: addNode, remove: removeNode } = useFieldArray({
    control,
    name: 'nodes',
  });

  const watchedNodes = watch('nodes');

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedNodeId) return;

      const currentIndex = nodes.findIndex(node => node.id === selectedNodeId);
      if (currentIndex === -1) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < nodes.length - 1) {
            setSelectedNodeId(nodes[currentIndex + 1].id);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedNodeId(nodes[currentIndex - 1].id);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (e.ctrlKey) {
            handleSubmit(onSave)();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedNodeId(null);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, handleSubmit, onSave]);

  const addNewNode = useCallback(() => {
    const newNodeId = `node_${Date.now()}`;
    const newNode: DialogueNode = {
      id: newNodeId,
      text: '',
      emotion: 'neutral',
      tone: 'casual',
      conditions: [],
      responses: [],
      is_root: nodes.length === 0,
      position: { x: 100, y: nodes.length * 120 },
    };
    addNode(newNode);
    setSelectedNodeId(newNodeId);
  }, [addNode, nodes.length]);

  const removeSelectedNode = useCallback(() => {
    if (selectedNodeId) {
      const index = nodes.findIndex(node => node.id === selectedNodeId);
      if (index !== -1) {
        removeNode(index);
        setSelectedNodeId(null);
      }
    }
  }, [selectedNodeId, nodes, removeNode]);

  const getConditionOptions = (type: string) => {
    switch (type) {
      case 'stat':
        return stats.map(stat => ({ value: stat.id, label: stat.name }));
      case 'flag':
        return flags.map(flag => ({ value: flag.id, label: flag.name }));
      case 'item':
        return items.map(item => ({ value: item.id, label: item.name }));
      case 'quest':
        return quests.map(quest => ({ value: quest.id, label: quest.title }));
      default:
        return [];
    }
  };

  const getPreviewNode = (nodeId: string): DialogueNode | null => {
    return watchedNodes.find(node => node.id === nodeId) || null;
  };

  const getAvailableResponses = (nodeId: string) => {
    const node = getPreviewNode(nodeId);
    if (!node) return [];

    return node.responses.filter(response => {
      // Check if response conditions are met (simplified preview logic)
      return response.conditions.length === 0 || response.conditions.some(condition => {
        // In preview mode, we'll assume conditions are met for demonstration
        return true;
      });
    });
  };

  const handlePreviewResponse = (response: any) => {
    if (response.next_node_id) {
      setPreviewNodeId(response.next_node_id);
    }
  };

  const renderConditionEditor = (nodeId: string, conditions: Condition[], onChange: (conditions: Condition[]) => void) => {
    const addCondition = () => {
      const newCondition: Condition = {
        type: 'stat',
        target: '',
        operator: 'equals',
        value: '',
      };
      onChange([...conditions, newCondition]);
    };

    const removeCondition = (index: number) => {
      onChange(conditions.filter((_, i) => i !== index));
    };

    const updateCondition = (index: number, field: keyof Condition, value: any) => {
      const updated = [...conditions];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowConditions(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            {showConditions[nodeId] ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            Conditions ({conditions.length})
          </button>
          <button
            type="button"
            onClick={addCondition}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            <PlusIcon className="w-4 h-4 inline mr-1" />
            Add
          </button>
        </div>
        
        {showConditions[nodeId] && (
          <div className="space-y-2 pl-4">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <select
                  value={condition.type}
                  onChange={(e) => updateCondition(index, 'type', e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="stat">Stat</option>
                  <option value="flag">Flag</option>
                  <option value="item">Item</option>
                  <option value="quest">Quest</option>
                </select>
                
                <select
                  value={condition.target}
                  onChange={(e) => updateCondition(index, 'target', e.target.value)}
                  className="text-sm border rounded px-2 py-1 flex-1"
                >
                  <option value="">Select target...</option>
                  {getConditionOptions(condition.type).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="equals">Equals</option>
                  <option value="greater_than">Greater than</option>
                  <option value="less_than">Less than</option>
                  <option value="has">Has</option>
                  <option value="not_has">Not has</option>
                </select>
                
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="text-sm border rounded px-2 py-1 flex-1"
                />
                
                <button
                  type="button"
                  onClick={() => removeCondition(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderResponseEditor = (nodeId: string, responses: any[], onChange: (responses: any[]) => void) => {
    const addResponse = () => {
      const newResponse = {
        id: `response_${Date.now()}`,
        text: '',
        next_node_id: '',
        conditions: [],
      };
      onChange([...responses, newResponse]);
    };

    const removeResponse = (index: number) => {
      onChange(responses.filter((_, i) => i !== index));
    };

    const updateResponse = (index: number, field: string, value: any) => {
      const updated = [...responses];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowResponses(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            {showResponses[nodeId] ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            Responses ({responses.length})
          </button>
          <button
            type="button"
            onClick={addResponse}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            <PlusIcon className="w-4 h-4 inline mr-1" />
            Add
          </button>
        </div>
        
        {showResponses[nodeId] && (
          <div className="space-y-2 pl-4">
            {responses.map((response, index) => (
              <div key={response.id} className="p-3 bg-blue-50 rounded border">
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={response.text}
                    onChange={(e) => updateResponse(index, 'text', e.target.value)}
                    placeholder="Response text"
                    className="text-sm border rounded px-2 py-1 flex-1"
                  />
                  
                  <select
                    value={response.next_node_id || ''}
                    onChange={(e) => updateResponse(index, 'next_node_id', e.target.value || undefined)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">No next node</option>
                    {nodes.map(node => (
                      <option key={node.id} value={node.id}>{node.text || `Node ${node.id}`}</option>
                    ))}
                  </select>
                  
                  <button
                    type="button"
                    onClick={() => removeResponse(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                
                {renderConditionEditor(nodeId, response.conditions, (conditions) => 
                  updateResponse(index, 'conditions', conditions)
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPreviewPanel = () => {
    if (!previewMode) return null;

    const currentNode = previewNodeId ? getPreviewNode(previewNodeId) : watchedNodes.find(node => node.is_root);
    if (!currentNode) return null;

    const availableResponses = getAvailableResponses(currentNode.id);

    return (
      <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Dialogue Preview</h3>
          <button
            onClick={() => setPreviewMode(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <EyeSlashIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-100 rounded">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-gray-600">
                {characters.find(c => c.id === currentNode.character_id)?.name || 'Unknown'}
              </span>
              <span className={`px-2 py-1 text-xs rounded ${getEmotionColor(currentNode.emotion)}`}>
                {currentNode.emotion}
              </span>
              <span className={`px-2 py-1 text-xs rounded ${getToneColor(currentNode.tone)}`}>
                {currentNode.tone}
              </span>
            </div>
            <p className="text-gray-800">{currentNode.text}</p>
          </div>
          
          {availableResponses.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Responses:</h4>
              {availableResponses.map((response, index) => (
                <button
                  key={response.id}
                  onClick={() => handlePreviewResponse(response)}
                  className="w-full text-left p-3 border rounded hover:bg-blue-50 transition-colors"
                >
                  {response.text}
                </button>
              ))}
            </div>
          )}
          
          {availableResponses.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No responses available
            </div>
          )}
        </div>
      </div>
    );
  };

  const getEmotionColor = (emotion: string) => {
    const colors = {
      neutral: 'bg-gray-200 text-gray-700',
      happy: 'bg-green-200 text-green-700',
      sad: 'bg-blue-200 text-blue-700',
      angry: 'bg-red-200 text-red-700',
      surprised: 'bg-yellow-200 text-yellow-700',
      fearful: 'bg-purple-200 text-purple-700',
      disgusted: 'bg-orange-200 text-orange-700',
    };
    return colors[emotion as keyof typeof colors] || colors.neutral;
  };

  const getToneColor = (tone: string) => {
    const colors = {
      formal: 'bg-gray-200 text-gray-700',
      casual: 'bg-blue-200 text-blue-700',
      friendly: 'bg-green-200 text-green-700',
      hostile: 'bg-red-200 text-red-700',
      mysterious: 'bg-purple-200 text-purple-700',
      humorous: 'bg-yellow-200 text-yellow-700',
      serious: 'bg-gray-300 text-gray-800',
    };
    return colors[tone as keyof typeof colors] || colors.casual;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className={`flex-1 flex flex-col ${previewMode ? 'mr-96' : ''}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold">Dialogue Tree Editor</h1>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                {previewMode ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                <span>Preview</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={addNewNode}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <PlusIcon className="w-4 h-4 inline mr-1" />
                Add Node
              </button>
              {selectedNodeId && (
                <button
                  onClick={removeSelectedNode}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <TrashIcon className="w-4 h-4 inline mr-1" />
                  Delete
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit(onSave)}
                disabled={!isDirty}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save (Ctrl+Enter)
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div ref={containerRef} className="flex-1 overflow-auto p-6">
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <div className="mb-6">
                <input
                  {...field}
                  type="text"
                  placeholder="Dialogue tree title"
                  className="w-full text-2xl font-bold border-none outline-none bg-transparent"
                />
                {errors.title && (
                  <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
                )}
              </div>
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <div className="mb-6">
                <textarea
                  {...field}
                  placeholder="Description (optional)"
                  className="w-full p-2 border border-gray-300 rounded resize-none"
                  rows={2}
                />
              </div>
            )}
          />

          {/* Nodes */}
          <div className="space-y-6">
            {nodes.map((node, index) => (
              <div
                key={node.id}
                className={`p-4 border rounded-lg transition-all ${
                  selectedNodeId === node.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Controller
                      name={`nodes.${index}.text`}
                      control={control}
                      render={({ field }) => (
                        <textarea
                          {...field}
                          placeholder="Enter dialogue text..."
                          className="w-full p-2 border border-gray-300 rounded resize-none"
                          rows={2}
                        />
                      )}
                    />
                    {errors.nodes?.[index]?.text && (
                      <p className="text-red-600 text-sm mt-1">{errors.nodes?.[index]?.text?.message}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Controller
                      name={`nodes.${index}.character_id`}
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">No character</option>
                          {characters.map(char => (
                            <option key={char.id} value={char.id}>{char.name}</option>
                          ))}
                        </select>
                      )}
                    />
                    
                    <Controller
                      name={`nodes.${index}.emotion`}
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="neutral">Neutral</option>
                          <option value="happy">Happy</option>
                          <option value="sad">Sad</option>
                          <option value="angry">Angry</option>
                          <option value="surprised">Surprised</option>
                          <option value="fearful">Fearful</option>
                          <option value="disgusted">Disgusted</option>
                        </select>
                      )}
                    />
                    
                    <Controller
                      name={`nodes.${index}.tone`}
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="formal">Formal</option>
                          <option value="casual">Casual</option>
                          <option value="friendly">Friendly</option>
                          <option value="hostile">Hostile</option>
                          <option value="mysterious">Mysterious</option>
                          <option value="humorous">Humorous</option>
                          <option value="serious">Serious</option>
                        </select>
                      )}
                    />
                  </div>
                </div>

                {/* Conditions */}
                <Controller
                  name={`nodes.${index}.conditions`}
                  control={control}
                  render={({ field }) => (
                    <div className="mb-4">
                      {renderConditionEditor(node.id, field.value, field.onChange)}
                    </div>
                  )}
                />

                {/* Responses */}
                <Controller
                  name={`nodes.${index}.responses`}
                  control={control}
                  render={({ field }) => (
                    <div>
                      {renderResponseEditor(node.id, field.value, field.onChange)}
                    </div>
                  )}
                />
              </div>
            ))}
          </div>

          {nodes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No dialogue nodes yet</p>
              <p className="text-sm mb-4">Click "Add Node" to start building your dialogue tree</p>
              <button
                onClick={addNewNode}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <PlusIcon className="w-4 h-4 inline mr-1" />
                Add First Node
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      {renderPreviewPanel()}
    </div>
  );
};

export default DialogueTree;
