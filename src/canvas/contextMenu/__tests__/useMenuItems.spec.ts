import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { CHALLENGE_KINDS, LOCAL_SEMANTIC_CONTEXT_MENU_IDS, useMenuItems } from '../useMenuItems'
import { challengeTooltipFor } from '../challengeCopy'
import { NodeTypeEnum } from '../../domain/nodes'
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

  /** The four kinds that already shipped keep their witnessed wording — this
   *  change adds kinds, it does not reword the ones already on screen. */
  it('keeps the shipped generic tooltip for factor', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    expect(findItem(result.current, 'ask-ai-challenge')?.tooltip)
      .toBe("Ask AI to argue against this element's current setup")
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

  /**
   * THE GAP THIS CLOSES. A Question node is the thing the whole model is
   * about, and it was the one element a team could not argue with. Bound by
   * the control's ID, never by a label another entry could carry.
   */
  it('Ask AI offers Challenge — the question itself is contestable', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const askAI = findItem(result.current, 'ask-ai')
    const subIds = askAI?.submenuItems?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })

  /**
   * The tooltip must read true for THIS kind. "argue against this element's
   * current setup" is false of a question — a question has no setup, it has a
   * framing. Derived from the one copy producer, so a reword moves both
   * surfaces or REDs here; pinned non-vacuous first, so a producer that
   * silently stopped discriminating cannot make this pass by agreeing with
   * itself (the fallback string is asserted DIFFERENT in the same test).
   */
  it('gives Challenge a tooltip written for a question, not the generic element wording', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const challenge = findItem(result.current, 'ask-ai-challenge')
    expect(challenge).toBeDefined()
    expect(challengeTooltipFor('decision')).not.toBe(challengeTooltipFor('factor'))
    expect(challenge!.tooltip).toBe(challengeTooltipFor('decision'))
  })

  /**
   * ⭐ THE NONSENSE CONTROL. Widening `FULL_MENU_KINDS` would have bought the
   * challenge entry AND three things that are nonsense here: Explore ▸ trace
   * to goal, Set value ▸ best/worst case (a question carries no range, so
   * these render permanently disabled with "Set a range first"), and Mark as
   * assumption. This test REDs the moment someone takes that shortcut.
   */
  it('gains Challenge WITHOUT gaining the range-bearing full-menu items', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const all = new Set(getAllItemIds(result.current))
    expect(all.has('ask-ai-challenge')).toBe(true)
    expect(all.has('explore')).toBe(false)
    expect(all.has('trace-to-goal')).toBe(false)
    expect(all.has('select-path-to-goal')).toBe(false)
    expect(all.has('set-value')).toBe(false)
    expect(all.has('set-value-best')).toBe(false)
    expect(all.has('set-value-worst')).toBe(false)
    expect(all.has('mark-assumption')).toBe(false)
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

  it('Ask AI offers Challenge — a constraint carries the most challengeable setup of the three', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const subIds = findItem(result.current, 'ask-ai')?.submenuItems
      ?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-challenge')
  })

  it('gives Challenge the constraint-specific tooltip', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const challenge = findItem(result.current, 'ask-ai-challenge')
    expect(challengeTooltipFor('constraint')).not.toBe(challengeTooltipFor('factor'))
    expect(challenge?.tooltip).toBe(challengeTooltipFor('constraint'))
  })

  it('gains Challenge WITHOUT gaining the range-bearing full-menu items', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const all = new Set(getAllItemIds(result.current))
    expect(all.has('ask-ai-challenge')).toBe(true)
    expect(all.has('explore')).toBe(false)
    expect(all.has('set-value')).toBe(false)
    expect(all.has('mark-assumption')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Node menu — option
// ---------------------------------------------------------------------------

describe('option node menu', () => {
  const node = {
    id: 'o1', type: 'option', position: { x: 0, y: 0 },
    data: { label: 'Hire in-house', kind: 'option' },
  } as Node
  const target: NodeTarget = {
    kind: 'node', nodeId: 'o1', nodeType: 'option', node, screenPos: { x: 0, y: 0 },
  }

  it('Ask AI offers Challenge — the choices are contestable', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const subIds = findItem(result.current, 'ask-ai')?.submenuItems
      ?.filter((e): e is MenuItemDef => !('type' in e)).map((i) => i.id) ?? []
    expect(subIds).toContain('ask-ai-explain')
    expect(subIds).toContain('ask-ai-challenge')
  })

  it('gives Challenge the option-specific tooltip', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const challenge = findItem(result.current, 'ask-ai-challenge')
    expect(challengeTooltipFor('option')).not.toBe(challengeTooltipFor('factor'))
    expect(challenge?.tooltip).toBe(challengeTooltipFor('option'))
  })

  it('gains Challenge WITHOUT gaining the range-bearing full-menu items', () => {
    const { result } = renderHook(() =>
      useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
    )
    const all = new Set(getAllItemIds(result.current))
    expect(all.has('ask-ai-challenge')).toBe(true)
    expect(all.has('explore')).toBe(false)
    expect(all.has('set-value')).toBe(false)
    expect(all.has('mark-assumption')).toBe(false)
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

// ---------------------------------------------------------------------------
// CHALLENGE_KINDS — the gate itself
// ---------------------------------------------------------------------------

/**
 * ⭐ A DERIVED GUARD PROVES AGREEMENT AND CAN NEVER PROVE THE LIST IS RIGHT
 * (trap 12d). Every other test here derives its expectation from
 * `CHALLENGE_KINDS`, so all of them would stay green if a kind quietly left
 * the Set. This block is the hand-written corpus that notices a SHORT list —
 * it is deliberately NOT derived, and it is the only place in this file where
 * the membership is spelled out.
 */
describe('CHALLENGE_KINDS membership', () => {
  it('offers challenge to every node kind a user can create, and to constraint', () => {
    expect([...CHALLENGE_KINDS].sort()).toEqual(
      ['constraint', 'decision', 'factor', 'goal', 'option', 'outcome', 'risk'],
    )
  })

  /** `action` is in `NodeTypeEnum` but not in `NODE_TYPE_ITEMS`; nobody has
   *  verified whether CEE ever emits one, so it is deliberately out of scope
   *  rather than silently included. Stated, not hidden. */
  it('leaves `action` out — an unverified kind is out of scope, not assumed in', () => {
    expect(CHALLENGE_KINDS.has('action')).toBe(false)
    const unoffered = NodeTypeEnum.options.filter(k => !CHALLENGE_KINDS.has(k))
    expect(unoffered).toEqual(['action'])
  })
})
