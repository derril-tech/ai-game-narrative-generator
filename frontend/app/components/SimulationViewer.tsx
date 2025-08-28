'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  StopIcon, 
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  HeartIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

// Schema definitions
interface SimulationState {
  player_stats: {
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

interface SimulationEvent {
  id: string;
  timestamp: number;
  type: 'quest_start' | 'quest_complete' | 'dialogue' | 'stat_change' | 'reputation_change' | 'alignment_change' | 'item_gain' | 'item_loss' | 'flag_set' | 'location_change';
  description: string;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'success';
}

interface SimulationResult {
  id: string;
  project_id: string;
  story_arc_id: string;
  initial_state: SimulationState;
  final_state: SimulationState;
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

interface SimulationViewerProps {
  simulation: SimulationResult;
  onRunSimulation: (initialState?: SimulationState) => Promise<SimulationResult>;
  onSaveSimulation: (simulation: SimulationResult) => void;
  onExportResults: (simulation: SimulationResult) => void;
  quests?: Array<{ id: string; title: string; type: string }>;
  dialogues?: Array<{ id: string; title: string; character_id: string }>;
  characters?: Array<{ id: string; name: string; faction: string }>;
  locations?: Array<{ id: string; name: string; description: string }>;
}

const SimulationViewer: React.FC<SimulationViewerProps> = ({
  simulation,
  onRunSimulation,
  onSaveSimulation,
  onExportResults,
  quests = [],
  dialogues = [],
  characters = [],
  locations = [],
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [filteredEvents, setFilteredEvents] = useState<SimulationEvent[]>([]);
  const [eventFilters, setEventFilters] = useState<Record<string, boolean>>({
    quest_start: true,
    quest_complete: true,
    dialogue: true,
    stat_change: true,
    reputation_change: true,
    alignment_change: true,
    item_gain: true,
    item_loss: true,
    flag_set: true,
    location_change: true,
  });
  const [severityFilters, setSeverityFilters] = useState<Record<string, boolean>>({
    info: true,
    warning: true,
    error: true,
    success: true,
  });

  // Filter events based on current filters
  useEffect(() => {
    const filtered = simulation.events.filter(event => {
      const typeMatch = eventFilters[event.type];
      const severityMatch = severityFilters[event.severity];
      return typeMatch && severityMatch;
    });
    setFilteredEvents(filtered);
  }, [simulation.events, eventFilters, severityFilters]);

  const handleRunSimulation = useCallback(async () => {
    setIsRunning(true);
    setCurrentEventIndex(0);
    
    try {
      const result = await onRunSimulation();
      onSaveSimulation(result);
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [onRunSimulation, onSaveSimulation]);

  const handlePlayback = useCallback(() => {
    if (currentEventIndex < filteredEvents.length) {
      const nextIndex = currentEventIndex + 1;
      setCurrentEventIndex(nextIndex);
      
      if (nextIndex < filteredEvents.length) {
        setTimeout(() => {
          handlePlayback();
        }, 1000 / playbackSpeed);
      }
    }
  }, [currentEventIndex, filteredEvents.length, playbackSpeed]);

  const handlePlay = useCallback(() => {
    if (currentEventIndex < filteredEvents.length) {
      handlePlayback();
    }
  }, [currentEventIndex, filteredEvents.length, handlePlayback]);

  const handlePause = useCallback(() => {
    // Pause is handled by not calling handlePlayback again
  }, []);

  const handleStop = useCallback(() => {
    setCurrentEventIndex(0);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentEventIndex(0);
    setShowDetails({});
  }, []);

  const toggleEventDetails = useCallback((eventId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  }, []);

  const getEventIcon = (type: string) => {
    const icons = {
      quest_start: PlayIcon,
      quest_complete: CheckCircleIcon,
      dialogue: UserIcon,
      stat_change: ShieldCheckIcon,
      reputation_change: HeartIcon,
      alignment_change: ShieldCheckIcon,
      item_gain: CheckCircleIcon,
      item_loss: XCircleIcon,
      flag_set: ExclamationTriangleIcon,
      location_change: ClockIcon,
    };
    return icons[type as keyof typeof icons] || ClockIcon;
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      info: 'text-blue-600 bg-blue-100',
      warning: 'text-yellow-600 bg-yellow-100',
      error: 'text-red-600 bg-red-100',
      success: 'text-green-600 bg-green-100',
    };
    return colors[severity as keyof typeof colors] || colors.info;
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = timestamp % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderStatCard = (title: string, value: number, maxValue?: number, unit?: string) => (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <div className="flex items-center space-x-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {maxValue && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderReputationBar = (faction: string, value: number) => {
    const maxReputation = 100;
    const percentage = Math.max(-100, Math.min(100, value));
    const color = percentage >= 50 ? 'bg-green-600' : percentage >= 0 ? 'bg-yellow-600' : 'bg-red-600';
    
    return (
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{faction}</span>
        <span className="text-sm text-gray-500">{value}</span>
        <div className="flex-1 mx-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`${color} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.abs(percentage)}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderAlignmentChart = () => {
    const { good, neutral, evil } = simulation.final_state.alignment;
    const total = good + neutral + evil;
    
    if (total === 0) return null;
    
    const goodPercent = (good / total) * 100;
    const neutralPercent = (neutral / total) * 100;
    const evilPercent = (evil / total) * 100;
    
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Alignment</h3>
        <div className="flex h-4 rounded-full overflow-hidden">
          <div 
            className="bg-green-600 transition-all duration-300"
            style={{ width: `${goodPercent}%` }}
            title={`Good: ${good}`}
          />
          <div 
            className="bg-gray-400 transition-all duration-300"
            style={{ width: `${neutralPercent}%` }}
            title={`Neutral: ${neutral}`}
          />
          <div 
            className="bg-red-600 transition-all duration-300"
            style={{ width: `${evilPercent}%` }}
            title={`Evil: ${evil}`}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Good ({good})</span>
          <span>Neutral ({neutral})</span>
          <span>Evil ({evil})</span>
        </div>
      </div>
    );
  };

  const renderEventDetails = (event: SimulationEvent) => {
    if (!showDetails[event.id]) return null;

    return (
      <div className="ml-8 mt-2 p-3 bg-gray-50 rounded border-l-2 border-blue-500">
        <div className="text-sm text-gray-600 mb-2">
          <strong>Data:</strong>
        </div>
        <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      </div>
    );
  };

  const renderTimelineEvent = (event: SimulationEvent, index: number) => {
    const Icon = getEventIcon(event.type);
    const isCurrent = index === currentEventIndex;
    const isPast = index < currentEventIndex;
    
    return (
      <div key={event.id} className={`flex items-start space-x-3 p-3 rounded-lg transition-all ${
        isCurrent ? 'bg-blue-50 border border-blue-200' : 
        isPast ? 'bg-gray-50' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isCurrent ? 'bg-blue-600 text-white' : 
          isPast ? 'bg-gray-400 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">{event.description}</span>
              <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(event.severity)}`}>
                {event.severity}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
              <button
                onClick={() => toggleEventDetails(event.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showDetails[event.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {renderEventDetails(event)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Simulation Controls & Stats */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold mb-4">Simulation Viewer</h1>
          
          {/* Playback Controls */}
          <div className="flex items-center space-x-2 mb-4">
            <button
              onClick={handlePlay}
              disabled={isRunning || currentEventIndex >= filteredEvents.length}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <PlayIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              className="p-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              <PauseIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleStop}
              className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <StopIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>
          
          {/* Playback Speed */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
          </div>
          
          {/* Run New Simulation */}
          <button
            onClick={handleRunSimulation}
            disabled={isRunning}
            className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isRunning ? 'Running...' : 'Run New Simulation'}
          </button>
        </div>
        
        {/* Stats Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Player Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Player Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              {renderStatCard('Health', simulation.final_state.player_stats.health, 100)}
              {renderStatCard('Mana', simulation.final_state.player_stats.mana, 100)}
              {renderStatCard('Level', simulation.final_state.player_stats.level)}
              {renderStatCard('Experience', simulation.final_state.player_stats.experience)}
              {renderStatCard('Gold', simulation.final_state.player_stats.gold)}
            </div>
          </div>
          
          {/* Reputation */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Reputation</h2>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              {Object.entries(simulation.final_state.reputation).map(([faction, value]) => 
                renderReputationBar(faction, value)
              )}
            </div>
          </div>
          
          {/* Alignment */}
          {renderAlignmentChart()}
          
          {/* Quest Progress */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Quest Progress</h2>
            <div className="space-y-2">
              {Object.entries(simulation.final_state.quest_progress).map(([questId, progress]) => {
                const quest = quests.find(q => q.id === questId);
                const statusColor = {
                  not_started: 'text-gray-500',
                  in_progress: 'text-yellow-600',
                  completed: 'text-green-600',
                  failed: 'text-red-600',
                }[progress.status];
                
                return (
                  <div key={questId} className="bg-white p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{quest?.title || questId}</span>
                      <span className={`text-xs ${statusColor}`}>
                        {progress.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Current State */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Current State</h2>
            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-600">Location: </span>
                <span className="text-sm text-gray-900">
                  {locations.find(l => l.id === simulation.final_state.current_location)?.name || simulation.final_state.current_location}
                </span>
              </div>
              {simulation.final_state.current_quest && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Current Quest: </span>
                  <span className="text-sm text-gray-900">
                    {quests.find(q => q.id === simulation.final_state.current_quest)?.title || simulation.final_state.current_quest}
                  </span>
                </div>
              )}
              {simulation.final_state.current_dialogue && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Current Dialogue: </span>
                  <span className="text-sm text-gray-900">
                    {dialogues.find(d => d.id === simulation.final_state.current_dialogue)?.title || simulation.final_state.current_dialogue}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Export Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => onExportResults(simulation)}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Export Results
          </button>
        </div>
      </div>
      
      {/* Right Panel - Timeline */}
      <div className="flex-1 flex flex-col">
        {/* Timeline Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Simulation Timeline</h2>
            <div className="flex items-center space-x-4">
              {/* Event Type Filters */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Events:</span>
                {Object.keys(eventFilters).map(type => (
                  <label key={type} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      checked={eventFilters[type]}
                      onChange={(e) => setEventFilters(prev => ({ ...prev, [type]: e.target.checked }))}
                      className="text-blue-600 rounded"
                    />
                    <span className="text-xs text-gray-600">{type.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
              
              {/* Severity Filters */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Severity:</span>
                {Object.keys(severityFilters).map(severity => (
                  <label key={severity} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      checked={severityFilters[severity]}
                      onChange={(e) => setSeverityFilters(prev => ({ ...prev, [severity]: e.target.checked }))}
                      className="text-blue-600 rounded"
                    />
                    <span className="text-xs text-gray-600">{severity}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Progress: {currentEventIndex} / {filteredEvents.length}</span>
              <span>{filteredEvents.length > 0 ? Math.round((currentEventIndex / filteredEvents.length) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${filteredEvents.length > 0 ? (currentEventIndex / filteredEvents.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Timeline Events */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredEvents.map((event, index) => renderTimelineEvent(event, index))}
          </div>
          
          {filteredEvents.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ClockIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">No events to display</p>
              <p className="text-sm">Try adjusting your filters or run a new simulation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationViewer;
