import React, { createContext, useContext, useState, ReactNode } from 'react';
import { vi } from 'vitest';

// Types
export type SandboxNode = {
  id: string;
  label: string;
  type: 'decision' | 'option';
  x: number;
  y: number;
  data?: Record<string, any>;
};
export type Edge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export interface BoardState {
  nodes: SandboxNode[];
  edges: Edge[];
  title: string;
}

interface BoardStateContextType {
  board: BoardState;
  addNode: (node: SandboxNode) => void;
  updateNode: (node: SandboxNode) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (edge: Edge) => void;
  deleteEdge: (id: string) => void;
  isLoading: boolean;
  listSnapshots: () => any[];
  saveSnapshot: () => void;
  loadSnapshot: () => void;
  onShowComments: (nodeId: string) => void;
}

const BoardStateContext = createContext<BoardStateContextType | undefined>(undefined);

function getDefaultNodes(): SandboxNode[] {
  return [
    { id: 'n1', label: 'Node 1', type: 'decision', x: 100, y: 100 },
    { id: 'n2', label: 'Node 2', type: 'option', x: 300, y: 200 },
  ];
}
function getDefaultEdges(): Edge[] {
  return [
    { id: 'e1', source: 'n1', target: 'n2', label: '50%' },
  ];
}

export function BoardStateTestProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<SandboxNode[]>(getDefaultNodes());
  const [edges, setEdges] = useState<Edge[]>(getDefaultEdges());

  const addNode = (node: SandboxNode) => setNodes(prev => [...prev, node]);
  const updateNode = (updated: SandboxNode) => setNodes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
  const deleteNode = (id: string) => setNodes(prev => prev.filter(n => n.id !== id));

  const addEdge = (edge: Edge) => setEdges(prev => [...prev, edge]);
  const updateEdge = (updated: Edge) => setEdges(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  const deleteEdge = (id: string) => setEdges(prev => prev.filter(e => e.id !== id));

  const value: BoardStateContextType = {
    board: {
      nodes,
      edges,
      title: 'Test Board',
    },
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    isLoading: false,
    listSnapshots: () => [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
    onShowComments: vi.fn(), // Always provide a valid mock
  };

  return (
    <BoardStateContext.Provider value={value}>
      {children}
    </BoardStateContext.Provider>
  );
}

export function useBoardStateMock() {
  const ctx = useContext(BoardStateContext);
  if (!ctx) throw new Error('useBoardStateMock must be used within BoardStateTestProvider');
  return ctx;
}
