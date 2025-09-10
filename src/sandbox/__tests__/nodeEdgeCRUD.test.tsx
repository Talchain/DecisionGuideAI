import React, { createContext, useContext, useState } from 'react';
import { vi } from 'vitest';

// --- Inline test board state context/provider ---
const BoardStateContext = createContext<any>(undefined as any);
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
  const addNode = (node: { label: string; type: string; x: number; y: number }) => {
    const created = { id: `n${nodes.length + 1}`, ...node } as any;
    setNodes((prev: typeof nodes) => [...prev, created]);
    return created;
  };
  const updateNode = (nodeId: string, updates: Partial<{ label: string; type: string; x: number; y: number }>) =>
    setNodes((prev: typeof nodes) => prev.map(n => (n.id === nodeId ? { ...n, ...updates } : n)));
  const deleteNode = (id: string) => setNodes((prev: typeof nodes) => prev.filter(n => n.id !== id));
  const addEdge = (edge: { source: string; target: string; label?: string }) => {
    const created = { id: `e${edges.length + 1}`, label: edge.label ?? '', source: edge.source, target: edge.target } as any;
    setEdges((prev: typeof edges) => [...prev, created]);
    return created;
  };
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
  return render(<BoardStateTestProvider>{ui}</BoardStateTestProvider>);
}

describe('Node/Edge CRUD', () => {
  it('creates a new node via edge handle + type selection', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Click an edge handle on the first node
    const handleBtn = screen.getAllByRole('button', { name: /add node/i })[0];
    fireEvent.click(handleBtn);
    // Choose a type in the contextual menu
    const typeBtn = await screen.findByRole('button', { name: 'Decision' });
    fireEvent.click(typeBtn);
    // New node enters edit mode; a textarea should be present (value may be empty initially)
    const textboxes = await screen.findAllByRole('textbox');
    const editField = textboxes.find(el => el.tagName.toLowerCase() === 'textarea') as HTMLTextAreaElement;
    expect(editField).toBeTruthy();
    // Commit edit (Enter) to exit edit mode
    fireEvent.keyDown(editField, { key: 'Enter', code: 'Enter' });
    // Now the static label should be visible
    expect(await screen.findByText('Decision')).toBeInTheDocument();
  });

  it('edits a node label via click and Enter', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    const node = screen.getByText('Node 1');
    fireEvent.click(node);
    const input = screen.getByDisplayValue('Node 1');
    fireEvent.change(input, { target: { value: 'Edited Node' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(await screen.findByText('Edited Node')).toBeInTheDocument();
  });

  it('deletes a node via toolbar button + confirm modal', async () => {
    renderWithSandboxBoard(<SandboxCanvas />);
    // Click the delete button in the node toolbar
    const deleteBtn = screen.getAllByRole('button', { name: /delete node/i })[0];
    fireEvent.click(deleteBtn);
    // Modal should open with heading/title "Delete Node"
    expect(await screen.findByRole('heading', { name: /delete node/i })).toBeInTheDocument();
    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(screen.queryByText('Node 1')).not.toBeInTheDocument());
  });
});
