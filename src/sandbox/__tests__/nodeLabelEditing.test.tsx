import React, { createContext, useContext, useState } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { vi } from 'vitest';

// --- Inline test board state context/provider ---
const BoardStateContext = createContext(undefined);
function getDefaultNodes() {
  return [
    { id: 'n1', label: 'Node 1', type: 'decision', x: 100, y: 100, data: {} },
  ];
}
function getDefaultEdges() {
  return [];
}
export function BoardStateTestProvider({ children }) {
  const [nodes, setNodes] = useState(getDefaultNodes());
  const [edges] = useState(getDefaultEdges());
  const updateNode = updated => setNodes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
  const value = {
    board: { nodes, edges, title: 'Test Board' },
    addNode: vi.fn(),
    updateNode,
    deleteNode: vi.fn(),
    updateEdgeLikelihood: vi.fn(),
    addEdge: vi.fn(),
    deleteEdge: vi.fn(),
    isLoading: false,
    listSnapshots: () => [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
  };
  return <BoardStateContext.Provider value={value}>{children}</BoardStateContext.Provider>;
}
export function useBoardStateMock() {
  const ctx = useContext(BoardStateContext);
  if (!ctx) throw new Error('useBoardStateMock must be used within BoardStateTestProvider');
  return ctx;
}

// --- Vitest mocks must be hoisted and reference only top-level code ---
vi.mock('../state/boardState', () => ({ useBoardState: useBoardStateMock }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDraft: true, toggleDraft: vi.fn() }) }));
vi.mock('../state/useCommentState', () => ({
  useCommentState: () => ({
    comments: [],
    addComment: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(),
    listComments: () => [],
  }),
}));

/**
 * TEST UTILITY PATTERN: renderWithSandboxBoard
 *
 * All tests in this file must render components using the `renderWithSandboxBoard` utility,
 * which wraps the tested component in the local BoardStateTestProvider context.
 * This ensures all stateful board logic is properly mocked and triggers UI re-renders.
 * Do NOT use plain render().
 */
function renderWithSandboxBoard(ui: React.ReactElement) {
  return render(<BoardStateTestProvider>{ui}</BoardStateTestProvider>);
}

describe('Node label editing', () => {
  it('allows editing and saving a node label', () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Double-click node to edit
    const node = screen.getByText('Node 1');
    fireEvent.doubleClick(node);
    // Input appears with old label
    const input = screen.getByDisplayValue('Node 1');
    fireEvent.change(input, { target: { value: 'New Label' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    // Label updated
    expect(screen.getByText('New Label')).toBeInTheDocument();
  });

  it('reverts on empty label', () => {
    render(<SandboxCanvas />);
    const node = screen.getByText('Node 1');
    fireEvent.doubleClick(node);
    const input = screen.getByDisplayValue('Node 1');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    // Old label remains
    expect(screen.getByText('Node 1')).toBeInTheDocument();
  });

  it('saves on blur', () => {
    render(<SandboxCanvas />);
    const node = screen.getByText('Node 1');
    fireEvent.doubleClick(node);
    const input = screen.getByDisplayValue('Node 1');
    fireEvent.change(input, { target: { value: 'Blur Save' } });
    fireEvent.blur(input);
    expect(screen.getByText('Blur Save')).toBeInTheDocument();
  });
});
