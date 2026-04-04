import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMenuItems } from '../useMenuItems'
import type { PaneTarget, NodeTarget, EdgeTarget, MultiTarget, MenuItemDef, MenuEntry } from '../types'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../store', () => {
  const mockState = {
    clipboard: null,
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle', report: null },
    canUndo: () => false,
    canRedo: () => false,
    undo: vi.fn(),
    redo: vi.fn(),
    viewMode: 'standard' as const,
    setViewMode: vi.fn(),
    applyLayout: vi.fn(),
  }
  const mockStore = vi.fn((selector: any) => selector(mockState))
  mockStore.getState = () => mockState
  mockStore.setState = (_partial: any) => {}
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (state: any) => state.results.status,
    selectReport: (state: any) => state.results.report,
  }
})

vi.mock('../actions', () => ({
  deleteAction: vi.fn(),
  addNodeAction: vi.fn(),
  addConnectedFactorAction: vi.fn(),
  markAsAssumption: vi.fn(),
  traceToGoal: vi.fn(),
  askAI: vi.fn(),
  copyAction: vi.fn(),
  cutAction: vi.fn(),
  pasteAction: vi.fn(),
  duplicateAction: vi.fn(),
  setValueBestCase: vi.fn(),
  setValueWorstCase: vi.fn(),
  setValueReset: vi.fn(),
}))

const showToast = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)
const onClose = vi.fn()

function getItemIds(items: MenuEntry[]): string[] {
  return items.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id)
}

function findItem(items: MenuEntry[], id: string): MenuItemDef | undefined {
  for (const entry of items) {
    if ('id' in entry && entry.id === id) return entry as MenuItemDef
    if ('submenuItems' in entry && (entry as MenuItemDef).submenuItems) {
      const sub = findItem((entry as MenuItemDef).submenuItems!, id)
      if (sub) return sub
    }
  }
  return undefined
}

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// Pane menu
// ---------------------------------------------------------------------------

describe('pane menu', () => {
  const target: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

  it('includes add node, ask AI, and paste', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('add-node')
    expect(ids).toContain('ask-ai-pane')
    expect(ids).toContain('paste')
  })

  it('paste is disabled when clipboard is empty', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const paste = findItem(result.current, 'paste')
    expect(paste?.enabled).toBe(false)
  })

  it('add node submenu has 5 node types', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const addNode = findItem(result.current, 'add-node')
    expect(addNode?.submenuItems).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// Node menu — factor (full)
// ---------------------------------------------------------------------------

describe('factor node menu (full)', () => {
  const node = {
    id: 'f1', type: 'factor', position: { x: 0, y: 0 },
    data: { label: 'Revenue', kind: 'factor', observedState: { value: 50 } },
  } as Node
  const target: NodeTarget = {
    kind: 'node', nodeId: 'f1', nodeType: 'factor', node, screenPos: { x: 0, y: 0 },
  }

  it('includes ask AI, explore, set value, add connected factor, mark as assumption, clipboard, delete', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('explore')
    expect(ids).toContain('set-value')
    expect(ids).toContain('add-connected-factor')
    expect(ids).toContain('mark-assumption')
    expect(ids).toContain('cut')
    expect(ids).toContain('copy')
    expect(ids).toContain('duplicate')
    expect(ids).toContain('delete')
  })

  it('Ask AI has Explain and Challenge submenu items', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })
})

// ---------------------------------------------------------------------------
// Node menu — decision (reduced)
// ---------------------------------------------------------------------------

describe('decision node menu (reduced)', () => {
  const node = {
    id: 'd1', type: 'decision', position: { x: 0, y: 0 },
    data: { label: 'Strategy', kind: 'decision' },
  } as Node
  const target: NodeTarget = {
    kind: 'node', nodeId: 'd1', nodeType: 'decision', node, screenPos: { x: 0, y: 0 },
  }

  it('does NOT include explore, set value, or trace to goal', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('explore')
    expect(ids).not.toContain('set-value')
  })

  it('Ask AI only has Explain (no Challenge)', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).not.toContain('ask-ai-challenge')
  })

  it('includes add connected factor', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('add-connected-factor')
  })
})

// ---------------------------------------------------------------------------
// Node menu — constraint (most restricted)
// ---------------------------------------------------------------------------

describe('constraint node menu', () => {
  const node = {
    id: 'c1', type: 'constraint', position: { x: 0, y: 0 },
    data: { label: 'Budget limit', kind: 'constraint' },
  } as Node
  const target: NodeTarget = {
    kind: 'node', nodeId: 'c1', nodeType: 'constraint', node, screenPos: { x: 0, y: 0 },
  }

  it('does NOT include add connected factor or mark as assumption', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('add-connected-factor')
    expect(ids).not.toContain('mark-assumption')
  })
})

// ---------------------------------------------------------------------------
// Node menu — goal
// ---------------------------------------------------------------------------

describe('goal node menu', () => {
  const node = {
    id: 'g1', type: 'goal', position: { x: 0, y: 0 },
    data: { label: 'Profit', kind: 'goal' },
  } as Node
  const target: NodeTarget = {
    kind: 'node', nodeId: 'g1', nodeType: 'goal', node, screenPos: { x: 0, y: 0 },
  }

  it('does NOT include explore or set value', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('explore')
    expect(ids).not.toContain('set-value')
  })

  it('Ask AI has both Explain and Challenge', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })
})

// ---------------------------------------------------------------------------
// Edge menus
// ---------------------------------------------------------------------------

describe('causal edge menu', () => {
  const edge = { id: 'e1', source: 'f1', target: 'g1', type: 'styled', data: { ...DEFAULT_EDGE_DATA } } as Edge<EdgeData>
  const target: EdgeTarget = {
    kind: 'edge', edgeId: 'e1', edge, isStructural: false, screenPos: { x: 0, y: 0 },
  }

  it('includes ask AI (explain + challenge), mark as assumption, and delete', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('mark-assumption')
    expect(ids).toContain('delete')

    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-challenge')
  })
})

describe('structural edge menu', () => {
  const edge = { id: 'e2', source: 'd1', target: 'o1', type: 'styled', data: { ...DEFAULT_EDGE_DATA } } as Edge<EdgeData>
  const target: EdgeTarget = {
    kind: 'edge', edgeId: 'e2', edge, isStructural: true, screenPos: { x: 0, y: 0 },
  }

  it('includes only explain and delete (no challenge, no mark as assumption)', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('delete')
    expect(ids).not.toContain('mark-assumption')

    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).not.toContain('ask-ai-challenge')
  })
})

// ---------------------------------------------------------------------------
// Multi-select menu
// ---------------------------------------------------------------------------

describe('multi-select menu', () => {
  const target: MultiTarget = {
    kind: 'multi', nodeIds: ['f1', 'g1'], edgeIds: ['e1'], screenPos: { x: 0, y: 0 },
  }

  it('includes ask AI, cut, copy, duplicate, delete', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('cut')
    expect(ids).toContain('copy')
    expect(ids).toContain('duplicate')
    expect(ids).toContain('delete')
  })
})

// ---------------------------------------------------------------------------
// Edge case: assumption flag label toggles
// ---------------------------------------------------------------------------

describe('assumption flag label', () => {
  it('shows "Remove assumption flag" when already flagged', () => {
    const node = {
      id: 'f1', type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Revenue', kind: 'factor', flagged_as_assumption: true },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'f1', nodeType: 'factor', node, screenPos: { x: 0, y: 0 },
    }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const item = findItem(result.current, 'mark-assumption')
    expect(item?.label).toBe('Remove assumption flag')
  })
})

// ---------------------------------------------------------------------------
// P0.8: Org nodes must NOT show Mark as assumption
// ---------------------------------------------------------------------------

describe('org node assumption exclusion', () => {
  it('decision node does NOT include mark-assumption', () => {
    const node = {
      id: 'd1', type: 'decision', position: { x: 0, y: 0 },
      data: { label: 'Strategy', kind: 'decision' },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'd1', nodeType: 'decision', node, screenPos: { x: 0, y: 0 },
    }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('mark-assumption')
  })

  it('option node does NOT include mark-assumption', () => {
    const node = {
      id: 'o1', type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Option A', kind: 'option' },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'o1', nodeType: 'option', node, screenPos: { x: 0, y: 0 },
    }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('mark-assumption')
  })

  it('goal node DOES include mark-assumption', () => {
    const node = {
      id: 'g1', type: 'goal', position: { x: 0, y: 0 },
      data: { label: 'Profit', kind: 'goal' },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'g1', nodeType: 'goal', node, screenPos: { x: 0, y: 0 },
    }
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('mark-assumption')
  })
})
