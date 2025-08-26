import React, { createContext, useContext, useState } from 'react';
import { vi } from 'vitest';

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
  addNode: (node: SandboxNode) => void;
  updateNode: (updated: Partial<SandboxNode> & { id: string }) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (updated: Partial<Edge> & { id: string }) => void;
  deleteEdge: (id: string) => void;
  isLoading: boolean;
  listSnapshots: () => any[];
  saveSnapshot: () => void;
  loadSnapshot: () => void;
  onShowComments: () => void;
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
  const addNode = (node: SandboxNode): void => setNodes(prev => [...prev, node]);
  const updateNode = (updated: Partial<SandboxNode> & { id: string }): void => setNodes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
  const deleteNode = (id: string): void => setNodes(prev => prev.filter(n => n.id !== id));
  const addEdge = (edge: Edge): void => setEdges(prev => [...prev, edge]);
  const updateEdge = (updated: Partial<Edge> & { id: string }): void => setEdges(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  const deleteEdge = (id: string): void => setEdges(prev => prev.filter(e => e.id !== id));
  const value: BoardStateContextType = {
    board: { nodes, edges, title: 'Test Board' },
    addNode, updateNode, deleteNode, addEdge, updateEdge, deleteEdge,
    isLoading: false,
    listSnapshots: () => [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
    onShowComments: vi.fn(),
  };
  return <BoardStateContext.Provider value={value}>{children}</BoardStateContext.Provider>;
}
export function useBoardStateMock(): BoardStateContextType {
  const ctx = useContext(BoardStateContext);
  if (!ctx) throw new Error('useBoardStateMock must be used within BoardStateTestProvider');
  return ctx;
}

// --- Comments state mocks ---
type CommentType = { id: string; nodeId: string; text: string; author: string };
let commentsState: CommentType[] = [
  { id: 'c1', nodeId: 'n1', text: 'Initial comment', author: 'User' },
];
function addCommentMock(comment: CommentType): void { commentsState.push(comment); }
function editCommentMock(id: string, text: string): void { commentsState = commentsState.map(c => c.id === id ? { ...c, text } : c); }
function deleteCommentMock(id: string): void { commentsState = commentsState.filter(c => c.id !== id); }
function listCommentsMock(nodeId: string): CommentType[] { return commentsState.filter(c => c.nodeId === nodeId); }

// --- Vitest mocks must be hoisted and reference only top-level code ---
vi.mock('../state/boardState', () => ({ useBoardState: useBoardStateMock }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDraft: true, toggleDraft: vi.fn() }) }));
vi.mock('../state/useCommentState', () => ({
  useCommentState: () => ({
    comments: commentsState,
    addComment: addCommentMock,
    editComment: editCommentMock,
    deleteComment: deleteCommentMock,
    listComments: listCommentsMock,
  })
}));

vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDraft: true, toggleDraft: vi.fn() }) }));
vi.mock('../state/useCommentState', () => ({
  useCommentState: () => ({
    comments: commentsState,
    addComment: addCommentMock,
    editComment: editCommentMock,
    deleteComment: deleteCommentMock,
    listComments: listCommentsMock,
  })
}));

/**
 * TEST UTILITY PATTERN: renderWithSandboxBoard
 *
 * All tests in this file must render components using the `renderWithSandboxBoard` utility,
 * which wraps the tested component in the local BoardStateTestProvider context.
 * This ensures all stateful board logic is properly mocked and triggers UI re-renders.
 * Do NOT use plain render().
 */
import React, { ReactNode } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { describe, it, expect } from 'vitest';

function renderWithSandboxBoard(ui: ReactElement): ReturnType<typeof render> {
  // Wrap tested UI in a BoardStateTestProvider and inject a mock onShowComments prop if rendering SandboxCanvas or similar
  const onShowComments = vi.fn();
  if ((ui as any)?.type?.name === 'SandboxCanvas') {
    return render(
      <BoardStateTestProvider>
        {React.cloneElement(ui, { onShowComments })}
      </BoardStateTestProvider>
    );
  }
  // Otherwise, render as usual
  return render(<BoardStateTestProvider>{ui}</BoardStateTestProvider>);
}

describe('Comments panel', () => {
  it('opens and closes comments panel', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const commentBtn = screen.getAllByLabelText(/Show comments/)[0];
    fireEvent.click(commentBtn);
    expect(screen.getByText('Initial comment')).toBeInTheDocument();
    // Close panel
    const closeBtn = screen.getByLabelText(/close/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Initial comment')).not.toBeInTheDocument();
  });
  it('adds a comment', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const commentBtn = screen.getAllByLabelText(/Show comments/)[0];
    fireEvent.click(commentBtn);
    // Simulate add comment logic (UI specifics depend on implementation)
    addCommentMock({ id: 'c2', nodeId: 'n1', text: 'Another comment', author: 'User' });
    expect(screen.getByText('Another comment')).toBeInTheDocument();
  });
  it('edits and deletes a comment', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const commentBtn = screen.getAllByLabelText(/Show comments/)[0];
    fireEvent.click(commentBtn);
    // Simulate edit
    editCommentMock('c1', 'Edited comment');
    expect(screen.getByText('Edited comment')).toBeInTheDocument();
    // Simulate delete
    deleteCommentMock('c1');
    expect(screen.queryByText('Edited comment')).not.toBeInTheDocument();
  });
});
