'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  ExclamationTriangleIcon,
  BookOpenIcon,
  MapIcon,
  UserGroupIcon,
  ClockIcon,
  TagIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

// Schema definitions
const loreEntrySchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.enum(['character', 'location', 'item', 'event', 'faction', 'concept', 'timeline']),
  tags: z.array(z.string()).default([]),
  related_entries: z.array(z.string()).default([]),
  related_quests: z.array(z.string()).default([]),
  related_dialogues: z.array(z.string()).default([]),
  canon_status: z.enum(['canon', 'semi_canon', 'non_canon', 'contradictory']).default('canon'),
  version: z.number().default(1),
  created_at: z.string(),
  updated_at: z.string(),
  warnings: z.array(z.string()).default([]),
});

type LoreEntry = z.infer<typeof loreEntrySchema>;

interface LoreBrowserProps {
  loreEntries: LoreEntry[];
  onSave: (entry: LoreEntry) => void;
  onDelete: (entryId: string) => void;
  onLinkToQuest: (entryId: string, questId: string) => void;
  onLinkToDialogue: (entryId: string, dialogueId: string) => void;
  quests?: Array<{ id: string; title: string }>;
  dialogues?: Array<{ id: string; title: string }>;
}

const LoreBrowser: React.FC<LoreBrowserProps> = ({
  loreEntries,
  onSave,
  onDelete,
  onLinkToQuest,
  onLinkToDialogue,
  quests = [],
  dialogues = [],
}) => {
  const [selectedEntry, setSelectedEntry] = useState<LoreEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoreEntry>({
    resolver: zodResolver(loreEntrySchema),
    defaultValues: {
      id: '',
      title: '',
      content: '',
      category: 'concept',
      tags: [],
      related_entries: [],
      related_quests: [],
      related_dialogues: [],
      canon_status: 'canon',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      warnings: [],
    },
  });

  const categories = [
    { id: 'character', name: 'Characters', icon: UserGroupIcon, color: 'bg-blue-100 text-blue-700' },
    { id: 'location', name: 'Locations', icon: MapIcon, color: 'bg-green-100 text-green-700' },
    { id: 'item', name: 'Items', icon: TagIcon, color: 'bg-yellow-100 text-yellow-700' },
    { id: 'event', name: 'Events', icon: ClockIcon, color: 'bg-purple-100 text-purple-700' },
    { id: 'faction', name: 'Factions', icon: UserGroupIcon, color: 'bg-red-100 text-red-700' },
    { id: 'concept', name: 'Concepts', icon: BookOpenIcon, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'timeline', name: 'Timeline', icon: ClockIcon, color: 'bg-gray-100 text-gray-700' },
  ];

  // Filter and search logic
  const filteredEntries = useMemo(() => {
    return loreEntries.filter(entry => {
      const matchesSearch = searchQuery === '' || 
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [loreEntries, searchQuery, selectedCategory]);

  // Group entries by category
  const entriesByCategory = useMemo(() => {
    const grouped = categories.reduce((acc, category) => {
      acc[category.id] = filteredEntries.filter(entry => entry.category === category.id);
      return acc;
    }, {} as Record<string, LoreEntry[]>);
    
    // Add "all" category
    grouped.all = filteredEntries;
    
    return grouped;
  }, [filteredEntries, categories]);

  const handleCreateEntry = useCallback((data: LoreEntry) => {
    const newEntry: LoreEntry = {
      ...data,
      id: `lore_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onSave(newEntry);
    reset();
    setShowCreateForm(false);
  }, [onSave, reset]);

  const handleEditEntry = useCallback((entry: LoreEntry) => {
    setSelectedEntry(entry);
    reset(entry);
  }, [reset]);

  const handleSaveEdit = useCallback((data: LoreEntry) => {
    if (selectedEntry) {
      const updatedEntry: LoreEntry = {
        ...data,
        updated_at: new Date().toISOString(),
        version: selectedEntry.version + 1,
      };
      onSave(updatedEntry);
      setSelectedEntry(null);
      reset();
    }
  }, [selectedEntry, onSave, reset]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }, []);

  const getCanonStatusColor = (status: string) => {
    const colors = {
      canon: 'bg-green-100 text-green-700',
      semi_canon: 'bg-yellow-100 text-yellow-700',
      non_canon: 'bg-gray-100 text-gray-700',
      contradictory: 'bg-red-100 text-red-700',
    };
    return colors[status as keyof typeof colors] || colors.canon;
  };

  const getWarningIcon = (warnings: string[]) => {
    if (warnings.length === 0) return null;
    
    return (
      <div className="flex items-center space-x-1 text-orange-600">
        <ExclamationTriangleIcon className="w-4 h-4" />
        <span className="text-xs">{warnings.length}</span>
      </div>
    );
  };

  const renderEntryCard = (entry: LoreEntry) => (
    <div
      key={entry.id}
      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
        selectedEntry?.id === entry.id
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={() => handleEditEntry(entry)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 flex-1">{entry.title}</h3>
        <div className="flex items-center space-x-2">
          {getWarningIcon(entry.warnings)}
          <span className={`px-2 py-1 text-xs rounded ${getCanonStatusColor(entry.canon_status)}`}>
            {entry.canon_status.replace('_', ' ')}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {entry.content.substring(0, 150)}...
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded ${categories.find(c => c.id === entry.category)?.color}`}>
            {categories.find(c => c.id === entry.category)?.name}
          </span>
          {entry.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-2 py-1 bg-gray-100 rounded">
              {tag}
            </span>
          ))}
          {entry.tags.length > 2 && (
            <span className="text-gray-400">+{entry.tags.length - 2}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <LinkIcon className="w-3 h-3" />
          <span>{entry.related_quests.length + entry.related_dialogues.length}</span>
        </div>
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Create New Lore Entry</h3>
      
      <form onSubmit={handleSubmit(handleCreateEntry)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter lore entry title"
                />
              )}
            />
            {errors.title && (
              <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <Controller
            name="content"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                rows={4}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter lore content..."
              />
            )}
          />
          {errors.content && (
            <p className="text-red-600 text-sm mt-1">{errors.content.message}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Entry
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  const renderEditForm = () => {
    if (!selectedEntry) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Edit Lore Entry</h3>
        
        <form onSubmit={handleSubmit(handleSaveEdit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={6}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            />
            {errors.content && (
              <p className="text-red-600 text-sm mt-1">{errors.content.message}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canon Status</label>
              <Controller
                name="canon_status"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="canon">Canon</option>
                    <option value="semi_canon">Semi-Canon</option>
                    <option value="non_canon">Non-Canon</option>
                    <option value="contradictory">Contradictory</option>
                  </select>
                )}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    value={field.value.join(', ')}
                    onChange={(e) => field.onChange(e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter tags separated by commas"
                  />
                )}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedEntry(null);
                reset();
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedEntry.id)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold mb-4">Lore Browser</h1>
          
          {/* Search */}
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search lore entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Create Button */}
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Entry</span>
          </button>
        </div>
        
        {/* Categories */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {categories.map(category => {
              const entries = entriesByCategory[category.id] || [];
              const isExpanded = expandedCategories[category.id];
              
              return (
                <div key={category.id}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 rounded"
                  >
                    <div className="flex items-center space-x-2">
                      <category.icon className="w-4 h-4" />
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-gray-500">({entries.length})</span>
                    </div>
                    {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-6 space-y-1">
                      {entries.map(entry => (
                        <button
                          key={entry.id}
                          onClick={() => handleEditEntry(entry)}
                          className={`w-full text-left p-2 text-sm rounded ${
                            selectedEntry?.id === entry.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {entry.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create/Edit Forms */}
          {showCreateForm && renderCreateForm()}
          {renderEditForm()}
          
          {/* Entries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntries.map(renderEntryCard)}
          </div>
          
          {filteredEntries.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <BookOpenIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">No lore entries found</p>
              <p className="text-sm mb-4">
                {searchQuery || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or category filter'
                  : 'Create your first lore entry to get started'
                }
              </p>
              {!searchQuery && selectedCategory === 'all' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <PlusIcon className="w-4 h-4 inline mr-1" />
                  Create First Entry
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoreBrowser;
