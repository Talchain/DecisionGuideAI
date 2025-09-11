import React, { createContext, useContext, useState } from 'react';
import { vi } from 'vitest';
// Ensure the feature flag is on so CommentPanel renders in tests
vi.stubEnv('VITE_FEATURE_SCENARIO_SANDBOX', 'true');
// Mock useFlags to return sandbox enabled; others false by default
vi.mock('@/lib/flags', () => ({
  useFlags: () => ({
    sandbox: true,
    strategyBridge: false,
    voting: false,
    realtime: false,
    deltaReapplyV2: false,
    projections: false,
    scenarioSnapshots: false,
    optionHandles: false,
    decisionCTA: false,
  })
}))

// --- Inline test board state context/provider ---
import type { ReactNode, ReactElement } from 'react';

interface SandboxNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  data?: Record<string, unknown>;
}
interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
}
interface BoardState {
  nodes: SandboxNode[];
  edges: Edge[];
  title: string;
}
interface BoardStateContextType {
  board: BoardState;
  addNode: (node: Omit<SandboxNode, 'id'>) => SandboxNode;
  updateNode: (id: string, updates: Partial<SandboxNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: { source: string; target: string; label?: string }) => Edge;
  updateEdge: (updated: Partial<Edge> & { id: string }) => void;
  deleteEdge: (id: string) => void;
  isLoading: boolean;
  listSnapshots: () => any[];
  saveSnapshot: () => void;
  loadSnapshot: () => void;
  updateEdgeLikelihood: (edgeId: string, delta: number) => void;
}
const BoardStateContext = createContext<BoardStateContextType | undefined>(undefined);
function getDefaultNodes() {
  return [
    { id: 'n1', label: 'Node 1', type: 'decision', x: 100, y: 100 },
    { id: 'n2', label: 'Node 2', type: 'option', x: 300, y: 200 },
  ];
}
function getDefaultEdges() {
  return [
    { id: 'e1', source: 'n1', target: 'n2', label: '50%' },
  ];
}
export const BoardStateTestProvider: React.FC<{ children: ReactNode }> = ({ children }: { children: ReactNode }) => {
  const [nodes, setNodes] = useState<SandboxNode[]>(getDefaultNodes());
  const [edges, setEdges] = useState<Edge[]>(getDefaultEdges());
  const addNode = (node: Omit<SandboxNode, 'id'>): SandboxNode => {
    const created = { id: `n${nodes.length + 1}`, ...node } as SandboxNode;
    setNodes(prev => [...prev, created]);
    return created;
  };
  const updateNode = (id: string, updates: Partial<SandboxNode>): void => setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  const deleteNode = (id: string): void => setNodes(prev => prev.filter(n => n.id !== id));
  const addEdge = (edge: { source: string; target: string; label?: string }): Edge => {
    const created = { id: `e${edges.length + 1}`, source: edge.source, target: edge.target, label: edge.label ?? '' } as Edge;
    setEdges(prev => [...prev, created]);
    return created;
  };
  const updateEdge = (updated: Partial<Edge> & { id: string }): void => setEdges(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  const deleteEdge = (id: string): void => setEdges(prev => prev.filter(e => e.id !== id));
  const value: BoardStateContextType = {
    board: { nodes, edges, title: 'Test Board' },
    addNode, updateNode, deleteNode, addEdge, updateEdge, deleteEdge,
    isLoading: false,
    listSnapshots: () => [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
    updateEdgeLikelihood: vi.fn(),
  };
  return <BoardStateContext.Provider value={value}>{children}</BoardStateContext.Provider>;
}
export function useBoardStateMock(): BoardStateContextType {
  const ctx = useContext(BoardStateContext);
  if (!ctx) throw new Error('useBoardStateMock must be used within BoardStateTestProvider');
  return ctx;
}

// --- Vitest mocks must be hoisted and reference only top-level code ---
vi.mock('../state/boardState', () => ({ useBoardState: useBoardStateMock }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDraft: true, toggleDraft: vi.fn() }) }));
// Mock Yjs-backed comments hook with a simple local-state implementation for tests
vi.mock('../state/useYjsComments', () => {
  const React = require('react') as typeof import('react');
  return {
    useYjsComments: (targetId: string) => {
      const [comments, setComments] = React.useState([
        { id: 'c1', targetId, text: 'Initial comment', author: 'User', createdAt: Date.now() },
      ]);
      const roots = React.useMemo(() => comments.filter((c: any) => !c.parentId), [comments]);
      const repliesByParent = React.useMemo(() => {
        const m = new Map<string, any[]>();
        comments.forEach((c: any) => { if (c.parentId) { const arr = m.get(c.parentId) || []; arr.push(c); m.set(c.parentId, arr); } });
        return m;
      }, [comments]);
      const addComment = ({ targetId, author, text, parentId }: any) => {
        const created = { id: `c${comments.length + 1}`, targetId, text, author, parentId, createdAt: Date.now() };
        setComments((prev: any[]) => [...prev, created]);
        return created;
      };
      const editComment = (id: string, text: string) => setComments((prev: any[]) => prev.map((c: any) => c.id === id ? { ...c, text, updatedAt: Date.now() } : c));
      const deleteComment = (id: string) => setComments((prev: any[]) => prev.filter((c: any) => c.id !== id));
      const toggleReaction = () => {};
      const lastCommentAt = React.useMemo(() => Math.max(0, ...comments.map((c: any) => c.updatedAt ?? c.createdAt)), [comments]);
      return { comments, addComment, editComment, deleteComment, toggleReaction, lastCommentAt, roots, repliesByParent };
    }
  };
});

/**
 * TEST UTILITY PATTERN: renderWithSandboxBoard
 *
 * All tests in this file must render components using the `renderWithSandboxBoard` utility,
 * which wraps the tested component in the local BoardStateTestProvider context.
 * This ensures all stateful board logic is properly mocked and triggers UI re-renders.
 * Do NOT use plain render().
 */
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { describe, it, expect } from 'vitest';

function renderWithSandboxBoard(ui: ReactElement): ReturnType<typeof render> {
  return render(<BoardStateTestProvider>{ui}</BoardStateTestProvider>);
}

describe('Comments panel', () => {
  it('opens and closes comments panel', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const commentBtn = screen.getAllByLabelText(/add comment/i)[0];
    fireEvent.click(commentBtn);
    // Panel opens as a dialog labelled "Comments"
    expect(await screen.findByRole('dialog', { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByText('Initial comment')).toBeInTheDocument();
    // Close panel via header close button
    const closeBtn = screen.getByLabelText(/close comments/i);
    fireEvent.click(closeBtn);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /comments/i })).not.toBeInTheDocument());
  });
  it('adds a comment', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const commentBtn = screen.getAllByLabelText(/add comment/i)[0];
    fireEvent.click(commentBtn);
    // Ensure the panel is open and scope queries within it
    const panel = await screen.findByRole('dialog', { name: /comments/i });
    const composer = await within(panel).findByRole('textbox', { name: /add comment/i });
    fireEvent.change(composer, { target: { value: 'Another comment' } });
    const addBtn = within(panel).getByRole('button', { name: /add comment/i });
    fireEvent.click(addBtn);
    expect(await screen.findByText('Another comment')).toBeInTheDocument();
  });
  it('edits and deletes a comment', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const commentBtn = screen.getAllByLabelText(/add comment/i)[0];
    fireEvent.click(commentBtn);
    const panel = await screen.findByRole('dialog', { name: /comments/i });
    // Enter edit mode for the first root comment
    const editBtn = await within(panel).findAllByRole('button', { name: /edit/i });
    fireEvent.click(editBtn[0]);
    const [editArea] = await within(panel).findAllByLabelText(/edit comment/i);
    fireEvent.change(editArea, { target: { value: 'Edited comment' } });
    const saveBtn = within(panel).getByRole('button', { name: /save edit/i });
    fireEvent.click(saveBtn);
    expect(await screen.findByText('Edited comment')).toBeInTheDocument();
    // Delete the edited comment
    const deleteBtns = within(panel).getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(screen.queryByText('Edited comment')).not.toBeInTheDocument());
  });
});
