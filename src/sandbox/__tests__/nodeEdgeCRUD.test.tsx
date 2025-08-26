import React, { createContext, useContext, useState } from 'react';
import { vi } from 'vitest';

// --- Inline test board state context/provider ---
const BoardStateContext = createContext(undefined);
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
export function BoardStateTestProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState(getDefaultNodes());
  const [edges, setEdges] = useState(getDefaultEdges());
  const addNode = (node: { id: string; label: string; type: string; x: number; y: number }) => setNodes((prev: typeof nodes) => [...prev, node]);
  const updateNode = (updated: { id: string; label?: string; type?: string; x?: number; y?: number }) => setNodes((prev: typeof nodes) => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
  const deleteNode = (id: string) => setNodes((prev: typeof nodes) => prev.filter(n => n.id !== id));
  const addEdge = (edge: { id: string; source: string; target: string; label: string }) => setEdges((prev: typeof edges) => [...prev, edge]);
  const updateEdge = (updated: { id: string; source?: string; target?: string; label?: string }) => setEdges((prev: typeof edges) => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  const deleteEdge = (id: string) => setEdges((prev: typeof edges) => prev.filter(e => e.id !== id));
  const value = {
    board: { nodes, edges, title: 'Test Board' },
    addNode, updateNode, deleteNode, addEdge, updateEdge, deleteEdge,
    isLoading: false,
    listSnapshots: () => [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
  };
  // Always provide a mock onShowComments to children
  const onShowComments = vi.fn();
  // If the child is a SandboxCanvas, inject the prop
  if (React.isValidElement(children) && (children.type as any)?.name === 'SandboxCanvas') {
    return (
      <BoardStateContext.Provider value={value}>
        {React.cloneElement(children, { onShowComments })}
      </BoardStateContext.Provider>
    );
  }
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
vi.mock('../state/useCommentState', () => ({ useCommentState: () => ({ comments: [], addComment: vi.fn(), editComment: vi.fn(), deleteComment: vi.fn(), listComments: () => [] }) }));

/**
 * TEST UTILITY PATTERN: renderWithSandboxBoard
 *
 * All tests in this file must render components using the `renderWithSandboxBoard` utility,
 * which wraps the tested component in the local BoardStateTestProvider context.
 * This ensures all stateful board logic is properly mocked and triggers UI re-renders.
 * Do NOT use plain render().
 */
import { fireEvent, screen, waitFor, render } from '@testing-library/react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { beforeEach, describe, it, expect } from 'vitest';

function renderWithSandboxBoard(ui: React.ReactElement) {
  // Always provide a mock onShowComments to SandboxCanvas
  const onShowComments = vi.fn();
  if ((ui as any)?.type?.name === 'SandboxCanvas') {
    return render(
      <BoardStateTestProvider>
        {React.cloneElement(ui, { onShowComments })}
      </BoardStateTestProvider>
    );
  }
  return render(<BoardStateTestProvider>{ui}</BoardStateTestProvider>);
}

describe('Node/Edge CRUD', () => {
  it('creates a new node via Add Node button', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Find Add Node button in empty state (role/button + name for robustness)
    const btn = screen.getByRole('button', { name: /add node/i });
    fireEvent.click(btn);
    expect(screen.getByText('New Decision')).toBeInTheDocument();
  });
  it('edits a node label via double-click and Enter', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const node = screen.getByText('Node 1');
    fireEvent.doubleClick(node);
    const input = screen.getByDisplayValue('Node 1');
    fireEvent.change(input, { target: { value: 'Edited Node' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText('Edited Node')).toBeInTheDocument();
  });
  it('deletes a node via modal', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Log initial node state
    console.log('BEFORE DELETE:', Array.from(document.querySelectorAll('[data-coach="add-node"]')).map(el => el.textContent));
    // Open modal by right-click
    const node = screen.getByText('Node 1');
    fireEvent.contextMenu(node);
    expect(screen.getByText('Delete Node')).toBeInTheDocument();
    // Confirm delete
    const confirmBtn = screen.getByText('Delete Node');
    fireEvent.click(confirmBtn);
    // Log DOM after delete click but before wait
    console.log('AFTER DELETE CLICK:', Array.from(document.querySelectorAll('[data-coach="add-node"]')).map(el => el.textContent));
    screen.debug();
    // Wait for node to be removed from DOM (async state update)
    await waitFor(() => {
      expect(screen.queryByText('Node 1')).not.toBeInTheDocument();
    });
    // Log DOM after wait
    console.log('AFTER WAIT:', Array.from(document.querySelectorAll('[data-coach="add-node"]')).map(el => el.textContent));
    screen.debug();
  });
  // Edge CRUD can be similarly tested if UI exposes add/delete
});
