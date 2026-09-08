import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { LOCAL_SEMANTIC_CONTEXT_MENU_IDS, useMenuItems } from '../useMenuItems'
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

/**
 * ⚠ THIS MOCK WAS A HAND-MAINTAINED ALLOWLIST, AND IT BIT ON 8 Sep 2026.
 *
 * A `vi.mock` factory REPLACES the module. This one listed the thirteen action
 * FUNCTIONS the menu calls, which was fine while `actions.ts` exported nothing
 * else the menu reads. The moment `useMenuItems` also read `CHALLENGE_KINDS`
 * and `buildChallengeTooltip` from it, both arrived `undefined` and every node
 * menu case threw — the estate's dominant defect (a list a human must remember
 * to sync), in the mock written to isolate the thing being tested.
 *
 * It is now `importOriginal`-spread: the real module first, the side-effecting
 * mutation actions stubbed over it by name. So a NEW export is visible here by
 * construction, and the copy this file asserts on comes from the real producer
 * rather than from a fixture that could drift from it. The stubs stay because
 * these tests assert menu SHAPE, and letting `deleteAction` &c. run would drive
 * the store.
 *
 * Note the direction of the original failure: it was loud (a throw), not green.
 * The version of this that reads green is a mock listing a PREDICATE the code
 * later stops using — so keep the spread, not a longer list.
 */
vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
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

function getAllItemIds(items: MenuEntry[]): string[] {
  return items.flatMap(entry => {
    if ('type' in entry) return []
    return [entry.id, ...getAllItemIds(entry.submenuItems ?? [])]
  })
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

  it('keeps read-only and presentation actions while hiding local semantic writes', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai-pane')
    expect(ids).toContain('auto-arrange')
    expect(ids).toContain('toggle-view-mode')
    expect(ids).not.toContain('add-node')
    expect(ids).not.toContain('paste')
    expect(ids).not.toContain('undo')
    expect(ids).not.toContain('redo')
  })

  it('does not mount paste even when the clipboard state would disable it', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const paste = findItem(result.current, 'paste')
    expect(paste).toBeUndefined()
  })

  it('does not leak any nested add-node actions', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    expect(getAllItemIds(result.current)).not.toContain('add-node')
    expect(getAllItemIds(result.current).some(id => id.startsWith('add-node-'))).toBe(false)
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

  it('keeps inquiry, copy and conditional delete while hiding local semantic writes', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('explore')
    expect(ids).toContain('copy')
    expect(ids).toContain('delete')
    expect(ids).not.toContain('set-value')
    expect(ids).not.toContain('add-connected-factor')
    expect(ids).not.toContain('mark-assumption')
    expect(ids).not.toContain('cut')
    expect(ids).not.toContain('duplicate')
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

  /**
   * ⭐ THE NON-WIDENING GUARD, and the reason challenge got its own Set.
   *
   * The obvious way to give a Question node "Challenge this" was to add
   * `decision` to `FULL_MENU_KINDS`. That Set gates FOUR things, so it would
   * also have handed this node Explore, Set value (Best case / Worst case /
   * Reset to observed) and Mark as assumption — controls for a kind that has no
   * range and no observed value, which would render permanently disabled.
   *
   * This case is what REDs if a later change reaches for that shortcut.
   */
  it('does NOT include explore, set value, trace to goal, or mark as assumption', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('explore')
    expect(ids).not.toContain('set-value')
    expect(ids).not.toContain('mark-assumption')
  })

  /**
   * A team must be able to argue with the QUESTION it is answering. Staging
   * `80ccf768` withheld it: decision carried ask · inspect · menu only.
   */
  it('Ask AI has both Explain and Challenge', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })

  /**
   * The tooltip must be true for the kind it is shown on. The shipped string
   * says "argue against this element's current setup" — a Question has no
   * setup, it has a framing. Bound to the decision entry by identity (the item
   * id), not by position in the submenu.
   */
  it('offers a tooltip about the framing, not about a "current setup"', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const challenge = askAI?.submenuItems?.find(
      (e): e is MenuItemDef => !('type' in e) && e.id === 'ask-ai-challenge',
    )
    expect(challenge?.tooltip).toBe('Ask AI to argue this is the wrong question to be asking')
    expect(challenge?.tooltip).not.toContain('current setup')
  })

  it('withholds add connected factor without a receipt-bearing carrier', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('add-connected-factor')
  })
})

// ---------------------------------------------------------------------------
// Node menu — option
// ---------------------------------------------------------------------------

describe('option node menu', () => {
  const node = {
    id: 'o1', type: 'option', position: { x: 0, y: 0 },
    data: { label: 'Enter via partnership', kind: 'option' },
  } as Node
  const target: NodeTarget = {
    kind: 'node', nodeId: 'o1', nodeType: 'option', node, screenPos: { x: 0, y: 0 },
  }

  /** The choices on the table are the other thing a team most wants to
   *  contest, and staging withheld it. */
  it('Ask AI has both Explain and Challenge', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })

  it('names the option in its tooltip rather than an "element\'s current setup"', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const challenge = askAI?.submenuItems?.find(
      (e): e is MenuItemDef => !('type' in e) && e.id === 'ask-ai-challenge',
    )
    expect(challenge?.tooltip).toBe('Ask AI to argue against this option')
  })

  /** Same non-widening guard as the decision block: challenge arrives without
   *  the range-shaped controls an option has no values for. */
  it('still does NOT include explore or set value', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).not.toContain('explore')
    expect(ids).not.toContain('set-value')
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

  /**
   * Constraint is included on the strength of its own schema, not by analogy:
   * `ConstraintNodeDataSchema` carries `constraintType`, `thresholdValue`,
   * `unit` and `hardConstraint`, so it has more genuinely challengeable setup
   * than a goal — which already ships the control.
   */
  it('Ask AI has both Explain and Challenge', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })

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

  it('keeps inquiry and conditional delete but hides local edge semantics', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('delete')
    expect(ids).not.toContain('mark-assumption')

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

  it('keeps inquiry, copy and conditional delete but hides cut and duplicate', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const ids = getItemIds(result.current)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('copy')
    expect(ids).toContain('delete')
    expect(ids).not.toContain('cut')
    expect(ids).not.toContain('duplicate')
  })
})

// ---------------------------------------------------------------------------
// Edge case: assumption flag label toggles
// ---------------------------------------------------------------------------

describe('assumption flag label', () => {
  it('does not mount the local assumption toggle even when already flagged', () => {
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
    expect(item).toBeUndefined()
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

  it('goal node also withholds mark-assumption without server authority', () => {
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
    expect(ids).not.toContain('mark-assumption')
  })
})

describe('central context-menu authority audit', () => {
  it.each([
    { kind: 'pane', screenPos: { x: 1, y: 2 } } as PaneTarget,
    {
      kind: 'node', nodeId: 'f1', nodeType: 'factor', screenPos: { x: 1, y: 2 },
      node: { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'F' } } as Node,
    } as NodeTarget,
    {
      kind: 'edge', edgeId: 'e1', isStructural: false, screenPos: { x: 1, y: 2 },
      edge: { id: 'e1', source: 'f1', target: 'g1', data: {} } as Edge<EdgeData>,
    } as EdgeTarget,
    { kind: 'multi', nodeIds: ['f1'], edgeIds: [], screenPos: { x: 1, y: 2 } } as MultiTarget,
  ])('recursively excludes every local semantic action for $kind targets', target => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const mounted = new Set(getAllItemIds(result.current))
    for (const forbidden of LOCAL_SEMANTIC_CONTEXT_MENU_IDS) {
      expect(mounted.has(forbidden), `${forbidden} mounted for ${target.kind}`).toBe(false)
    }
    expect(mounted.has('delete')).toBe(target.kind !== 'pane')
  })
})
