'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Register the dagre layout
cytoscape.use(dagre);

interface StoryNode {
  id: string;
  type: 'arc' | 'quest' | 'outcome';
  label: string;
  data: any;
  position?: { x: number; y: number };
}

interface StoryEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'branch' | 'sequence' | 'condition';
}

interface StoryMapProps {
  nodes: StoryNode[];
  edges: StoryEdge[];
  onNodeAdd?: (type: 'arc' | 'quest' | 'outcome', position: { x: number; y: number }) => void;
  onNodeEdit?: (nodeId: string, data: any) => void;
  onNodeDelete?: (nodeId: string) => void;
  onEdgeAdd?: (source: string, target: string, type: 'branch' | 'sequence' | 'condition') => void;
  onEdgeDelete?: (edgeId: string) => void;
  validationErrors?: Array<{
    type: 'orphan' | 'unreachable' | 'broken_chain' | 'invalid_condition';
    nodeId?: string;
    edgeId?: string;
    message: string;
  }>;
}

const StoryMap: React.FC<StoryMapProps> = ({
  nodes,
  edges,
  onNodeAdd,
  onNodeEdit,
  onNodeDelete,
  onEdgeAdd,
  onEdgeDelete,
  validationErrors = []
}) => {
  const cyRef = useRef<Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: {
        nodes: nodes.map(node => ({
          data: {
            id: node.id,
            label: node.label,
            type: node.type,
            ...node.data
          },
          position: node.position,
          classes: getNodeClasses(node.id, validationErrors)
        })),
        edges: edges.map(edge => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            type: edge.type
          },
          classes: getEdgeClasses(edge.id, validationErrors)
        }))
      },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3b82f6',
            'border-color': '#1e40af',
            'border-width': 2,
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': 120,
            'font-size': 12,
            'font-weight': 'bold',
            'width': 80,
            'height': 80,
            'shape': 'ellipse'
          }
        },
        {
          selector: 'node[type = "arc"]',
          style: {
            'background-color': '#8b5cf6',
            'border-color': '#6d28d9',
            'width': 100,
            'height': 100
          }
        },
        {
          selector: 'node[type = "quest"]',
          style: {
            'background-color': '#f59e0b',
            'border-color': '#d97706',
            'width': 90,
            'height': 90
          }
        },
        {
          selector: 'node[type = "outcome"]',
          style: {
            'background-color': '#10b981',
            'border-color': '#059669',
            'width': 70,
            'height': 70
          }
        },
        {
          selector: 'node.error',
          style: {
            'border-color': '#ef4444',
            'border-width': 3,
            'border-style': 'dashed'
          }
        },
        {
          selector: 'node.warning',
          style: {
            'border-color': '#f59e0b',
            'border-width': 3,
            'border-style': 'dotted'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#6b7280',
            'target-arrow-color': '#6b7280',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'text-rotation': 'autorotate',
            'text-margin-y': -10,
            'font-size': 10,
            'color': '#374151'
          }
        },
        {
          selector: 'edge[type = "branch"]',
          style: {
            'line-color': '#8b5cf6',
            'target-arrow-color': '#8b5cf6',
            'line-style': 'dashed'
          }
        },
        {
          selector: 'edge[type = "condition"]',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'line-style': 'dotted'
          }
        },
        {
          selector: 'edge.error',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'line-width': 4
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#3b82f6',
            'border-width': 4
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'line-width': 5
          }
        }
      ],
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 50,
        edgeSep: 20,
        rankSep: 80
      }
    });

    // Event handlers
    cyRef.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.id());
    });

    cyRef.current.on('tap', (evt) => {
      if (evt.target === cyRef.current) {
        setSelectedNode(null);
      }
    });

    cyRef.current.on('cxttap', 'node', (evt) => {
      evt.preventDefault();
      const node = evt.target;
      if (onNodeEdit) {
        onNodeEdit(node.id(), node.data());
      }
    });

    cyRef.current.on('cxttap', 'edge', (evt) => {
      evt.preventDefault();
      const edge = evt.target;
      if (onEdgeDelete) {
        onEdgeDelete(edge.id());
      }
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [nodes, edges, validationErrors, onNodeEdit, onEdgeDelete]);

  // Update graph when data changes
  useEffect(() => {
    if (!cyRef.current) return;

    cyRef.current.elements().remove();
    
    const cyNodes = nodes.map(node => ({
      group: 'nodes',
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        ...node.data
      },
      position: node.position,
      classes: getNodeClasses(node.id, validationErrors)
    }));

    const cyEdges = edges.map(edge => ({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type
      },
      classes: getEdgeClasses(edge.id, validationErrors)
    }));

    cyRef.current.add([...cyNodes, ...cyEdges]);
    cyRef.current.layout({ name: 'dagre' }).run();
  }, [nodes, edges, validationErrors]);

  const getNodeClasses = (nodeId: string, errors: any[]) => {
    const nodeErrors = errors.filter(e => e.nodeId === nodeId);
    if (nodeErrors.some(e => e.type === 'orphan' || e.type === 'unreachable')) {
      return 'error';
    }
    if (nodeErrors.some(e => e.type === 'broken_chain')) {
      return 'warning';
    }
    return '';
  };

  const getEdgeClasses = (edgeId: string, errors: any[]) => {
    const edgeErrors = errors.filter(e => e.edgeId === edgeId);
    if (edgeErrors.some(e => e.type === 'invalid_condition')) {
      return 'error';
    }
    return '';
  };

  const handleAddNode = useCallback((type: 'arc' | 'quest' | 'outcome') => {
    if (!cyRef.current || !onNodeAdd) return;

    const center = cyRef.current.pan();
    const zoom = cyRef.current.zoom();
    const container = cyRef.current.container();
    
    const x = (container.width / 2 - center.x) / zoom;
    const y = (container.height / 2 - center.y) / zoom;

    onNodeAdd(type, { x, y });
  }, [onNodeAdd]);

  const handleStartEdge = useCallback((nodeId: string) => {
    setEdgeSource(nodeId);
    setIsAddingEdge(true);
  }, []);

  const handleCompleteEdge = useCallback((targetId: string) => {
    if (edgeSource && onEdgeAdd) {
      onEdgeAdd(edgeSource, targetId, 'sequence');
    }
    setEdgeSource(null);
    setIsAddingEdge(false);
  }, [edgeSource, onEdgeAdd]);

  const handleCancelEdge = useCallback(() => {
    setEdgeSource(null);
    setIsAddingEdge(false);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-2 flex gap-2">
        <button
          onClick={() => handleAddNode('arc')}
          className="p-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          title="Add Story Arc"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAddNode('quest')}
          className="p-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          title="Add Quest"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAddNode('outcome')}
          className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          title="Add Outcome"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-sm">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
            Validation Issues
          </h3>
          <div className="space-y-2">
            {validationErrors.map((error, index) => (
              <div key={index} className="text-sm text-gray-700 p-2 bg-red-50 rounded border-l-4 border-red-400">
                {error.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Node Actions */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-2 flex gap-2">
          <button
            onClick={() => onNodeEdit?.(selectedNode, {})}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Edit Node"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleStartEdge(selectedNode)}
            className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            title="Connect to Another Node"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNodeDelete?.(selectedNode)}
            className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            title="Delete Node"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edge Creation Mode */}
      {isAddingEdge && (
        <div className="absolute inset-0 z-20 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-gray-700 mb-4">Click on a target node to create connection</p>
            <button
              onClick={handleCancelEdge}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cytoscape Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default StoryMap;
