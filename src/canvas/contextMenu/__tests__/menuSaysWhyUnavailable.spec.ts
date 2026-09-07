/**
 * THE CONTEXT MENU MUST SAY WHY A GESTURE IS UNAVAILABLE, NOT DELETE IT.
 *
 * `applyContextMenuMutationAuthority` used to remove all 13
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` outright, so a user could not tell
 * "this product cannot do that" from "this product is broken" — the sharpest
 * case being a node menu that offers Copy and Delete while Cut, Duplicate and
 * Paste have vanished.
 *
 * ⭐ THE DENSITY CHOICE IS MEASURED, NOT ASSERTED — see the
 * "menu density" block at the foot of this file, which builds every menu under
 * BOTH candidate policies and pins the counts. Rendering all thirteen disabled
 * makes the factor-node menu 11 rows with 7 greyed (64%); the shipped policy
 * makes it 7 rows with 3 non-actionable (43%). That measurement is why the
 * all-disabled policy lost.
 *
 * ⚠ THE VACUITY TRAP THIS FILE IS BUILT AGAINST: an assertion that an item is
 * ABSENT passes trivially when the whole menu fails to render. Every case below
 * pins the menu's PRESENCE first (`expectMenuRendered`), so a builder that
 * throws or returns [] REDs instead of quietly agreeing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useMenuItems,
  applyContextMenuMutationAuthority,
  LOCAL_SEMANTIC_CONTEXT_MENU_IDS,
  KEYBOARD_REACHABLE_SEMANTIC_IDS,
  STRUCTURAL_EDITS_NOTE_ID,
} from '../useMenuItems'
import { CANVAS_STRUCTURAL_EDIT_NOTICE } from '../../mutations/mutationAuthority'
import type { PaneTarget, NodeTarget, EdgeTarget, MultiTarget, MenuItemDef, MenuEntry } from '../types'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'

vi.mock('../../store', () => {
  const mockState = {
    clipboard: null,
    nodes: [],
    edges: [],
    currentScenarioId: null,
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
  deleteAction: vi.fn(), addNodeAction: vi.fn(), addConnectedFactorAction: vi.fn(),
  addConnectedOutcomeAction: vi.fn(), addConnectedRiskAction: vi.fn(),
  reverseEdgeAction: vi.fn(), insertFactorBetweenAction: vi.fn(),
  selectPathToGoalAction: vi.fn(), markAsAssumption: vi.fn(), traceToGoal: vi.fn(),
  askAI: vi.fn(), copyAction: vi.fn(), cutAction: vi.fn(), pasteAction: vi.fn(),
  duplicateAction: vi.fn(), setValueBestCase: vi.fn(), setValueWorstCase: vi.fn(),
  setValueReset: vi.fn(),
}))

/**
 * Spread the original rather than hand-listing exports: a `vi.mock` factory
 * REPLACES the module and a hand-written allowlist goes stale silently.
 * Flipping this to 'server_graph' yields the PRISTINE menu from the real
 * builders, which is what makes the density comparison like-for-like.
 */
const authorityValue = { current: 'disabled' as string }
vi.mock('../../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: authorityValue.current }
    },
  }
})

const showToast = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)
const onClose = vi.fn()

const PANE: PaneTarget = { kind: 'pane', screenPos: { x: 1, y: 2 } }
const FACTOR_NODE: NodeTarget = {
  kind: 'node', nodeId: 'f1', nodeType: 'factor', screenPos: { x: 1, y: 2 },
  node: { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'F' } } as Node,
}
const CAUSAL_EDGE: EdgeTarget = {
  kind: 'edge', edgeId: 'e1', isStructural: false, screenPos: { x: 1, y: 2 },
  edge: { id: 'e1', source: 'f1', target: 'g1', data: {} } as Edge<EdgeData>,
}
const MULTI: MultiTarget = { kind: 'multi', nodeIds: ['f1', 'f2'], edgeIds: [], screenPos: { x: 1, y: 2 } }

function items(target: any): MenuEntry[] {
  const { result } = renderHook(() => useMenuItems({ target, showToast, screenToFlowPosition, onClose }))
  return result.current
}
function menuItemsOnly(entries: MenuEntry[]): MenuItemDef[] {
  return entries.filter((e): e is MenuItemDef => !('type' in e))
}
function findItem(entries: MenuEntry[], id: string): MenuItemDef | undefined {
  for (const entry of entries) {
    if ('id' in entry && (entry as MenuItemDef).id === id) return entry as MenuItemDef
    const sub = (entry as MenuItemDef).submenuItems
    if (sub) { const hit = findItem(sub, id); if (hit) return hit }
  }
  return undefined
}
/**
 * ⚠ NON-VACUITY PIN. Absence assertions below are only meaningful if the menu
 * built at all — this is the positive control for every one of them.
 */
function expectMenuRendered(entries: MenuEntry[], anchorId: string) {
  expect(menuItemsOnly(entries).length).toBeGreaterThan(0)
  expect(findItem(entries, anchorId), `anchor ${anchorId} missing — menu did not render`).toBeDefined()
}

beforeEach(() => { authorityValue.current = 'disabled' })

describe('the removed gestures are surfaced with a reason, not deleted', () => {
  it.each(['undo', 'redo', 'paste'])('pane menu shows %s as present-but-disabled', id => {
    const menu = items(PANE)
    expectMenuRendered(menu, 'ask-ai-pane')
    const item = findItem(menu, id)
    expect(item, `${id} was deleted from the pane menu`).toBeDefined()
    expect(item!.enabled).toBe(false)
    expect(item!.disabledReason).toBeTruthy()
  })

  it.each(['cut', 'duplicate'])('factor node menu shows %s as present-but-disabled', id => {
    const menu = items(FACTOR_NODE)
    expectMenuRendered(menu, 'delete')
    const item = findItem(menu, id)
    expect(item, `${id} was deleted from the node menu`).toBeDefined()
    expect(item!.enabled).toBe(false)
    expect(item!.disabledReason).toBeTruthy()
  })

  it('cut/duplicate carry the structural notice as their tooltip, by identity', () => {
    const menu = items(FACTOR_NODE)
    expectMenuRendered(menu, 'delete')
    for (const id of ['cut', 'duplicate']) {
      expect(findItem(menu, id)!.tooltip).toBe(CANVAS_STRUCTURAL_EDIT_NOTICE)
    }
  })

  it('undo/redo do NOT claim the structural notice — they point at Version history', () => {
    // ⭐ THE HONESTY SPLIT, and the reason this is not one constant. ⌘Z is
    // already answered by `canvasUndoUnavailableNotice()` (#954), which names
    // Version history. If the menu row said "ask Olumi" instead, the key and
    // the menu would answer the same question two different ways — the estate's
    // signature defect (one name, two questions).
    const menu = items(PANE)
    expectMenuRendered(menu, 'ask-ai-pane')
    for (const id of ['undo', 'redo']) {
      expect(findItem(menu, id)!.tooltip).not.toBe(CANVAS_STRUCTURAL_EDIT_NOTICE)
      expect(findItem(menu, id)!.tooltip).toContain('Version history')
    }
  })

  it('the note names Olumi and appears on menus that still hide menu-only gestures', () => {
    for (const [target, anchor] of [[PANE, 'ask-ai-pane'], [FACTOR_NODE, 'delete'], [CAUSAL_EDGE, 'delete']] as const) {
      const menu = items(target)
      expectMenuRendered(menu, anchor)
      const note = findItem(menu, STRUCTURAL_EDITS_NOTE_ID)
      expect(note, `note missing for ${(target as any).kind}`).toBeDefined()
      expect(note!.enabled).toBe(false)
      expect(note!.tooltip).toBe(CANVAS_STRUCTURAL_EDIT_NOTICE)
    }
  })

  it('TWIN: the multi menu hides no menu-only gesture, so it gets NO note', () => {
    // Its only removals (cut, duplicate) are surfaced as disabled rows, so a
    // note would be redundant furniture. This is the case that REDs if the note
    // is appended unconditionally.
    const menu = items(MULTI)
    expectMenuRendered(menu, 'delete')
    expect(findItem(menu, STRUCTURAL_EDITS_NOTE_ID)).toBeUndefined()
  })
})

describe('SAFETY: nothing gains an authority it does not have', () => {
  it.each([
    ['pane', PANE, 'ask-ai-pane'],
    ['node', FACTOR_NODE, 'delete'],
    ['edge', CAUSAL_EDGE, 'delete'],
    ['multi', MULTI, 'delete'],
  ] as const)('no local-semantic id is ENABLED for %s targets', (_k, target, anchor) => {
    const menu = items(target)
    expectMenuRendered(menu, anchor)
    for (const id of LOCAL_SEMANTIC_CONTEXT_MENU_IDS) {
      const item = findItem(menu, id)
      if (item) expect(item.enabled, `${id} is actionable with no writer`).toBe(false)
    }
  })

  it.each([
    ['pane', PANE, 'ask-ai-pane'],
    ['node', FACTOR_NODE, 'delete'],
    ['edge', CAUSAL_EDGE, 'delete'],
    ['multi', MULTI, 'delete'],
  ] as const)('the menu-only gestures stay hidden for %s targets', (_k, target, anchor) => {
    const menu = items(target)
    expectMenuRendered(menu, anchor)
    for (const id of LOCAL_SEMANTIC_CONTEXT_MENU_IDS) {
      if (KEYBOARD_REACHABLE_SEMANTIC_IDS.has(id)) continue
      expect(findItem(menu, id), `${id} should stay hidden`).toBeUndefined()
    }
  })

  it('TWIN: when the authority IS granted, everything returns enabled and the note disappears', () => {
    // Self-retiring by construction — the day `canvasSemanticMutations` becomes
    // `'server_graph'` this whole policy stands down with no second edit.
    const entries: MenuEntry[] = [
      { id: 'cut', label: 'Cut', tooltip: 'Cut selected elements', enabled: true, action: () => {} },
      { id: 'copy', label: 'Copy', tooltip: 'Copy', enabled: true, action: () => {} },
    ]
    const out = applyContextMenuMutationAuthority(entries, { connected: true })
    expect(out).toEqual(entries)
    expect(findItem(out, STRUCTURAL_EDITS_NOTE_ID)).toBeUndefined()
  })
})

describe('menu density — the measurement that chose the policy', () => {
  /**
   * Policy A, applied to the SAME pristine entry list the shipped policy sees:
   * surface all thirteen ids as disabled rows instead of hiding any.
   */
  function policyAllDisabled(entries: MenuEntry[]): MenuEntry[] {
    return entries.map(e => {
      if ('type' in e) return e
      const item = e as MenuItemDef
      return LOCAL_SEMANTIC_CONTEXT_MENU_IDS.has(item.id) ? { ...item, enabled: false } : item
    })
  }

  function density(entries: MenuEntry[]) {
    const rows = menuItemsOnly(entries)
    const inert = rows.filter(r => !r.enabled).length
    return { rows: rows.length, inert, pct: Math.round((inert / rows.length) * 100) }
  }

  /** The menu the real builders produce with the gate OPEN — the common baseline. */
  function pristine(target: any): MenuEntry[] {
    authorityValue.current = 'server_graph'
    const menu = items(target)
    authorityValue.current = 'disabled'
    return menu
  }

  it('the factor node menu is the deciding case', () => {
    const base = pristine(FACTOR_NODE)
    expectMenuRendered(base, 'delete') // non-vacuity on the baseline itself
    const a = density(policyAllDisabled(base))
    const shipped = density(items(FACTOR_NODE))

    // Policy A leaves two thirds of the menu greyed out — the wall of grey.
    expect(a).toEqual({ rows: 11, inert: 7, pct: 64 })
    // The shipped policy surfaces the keyboard-reachable pair and folds the
    // five menu-only gestures into one note.
    expect(shipped).toEqual({ rows: 7, inert: 3, pct: 43 })
    expect(shipped.inert).toBeLessThan(a.inert)
    expect(shipped.rows).toBeLessThan(a.rows)
  })

  it('the pane menu: the same comparison, where Add node is the casualty', () => {
    const base = pristine(PANE)
    expectMenuRendered(base, 'ask-ai-pane')
    expect(density(policyAllDisabled(base))).toEqual({ rows: 7, inert: 4, pct: 57 })
    expect(density(items(PANE))).toEqual({ rows: 7, inert: 4, pct: 57 })
  })

  it('no menu exceeds 60% inert rows under the shipped policy', () => {
    // The wall-of-grey ceiling, stated as a rule rather than left to taste.
    for (const [name, target, anchor] of [
      ['pane', PANE, 'ask-ai-pane'],
      ['node', FACTOR_NODE, 'delete'],
      ['edge', CAUSAL_EDGE, 'delete'],
      ['multi', MULTI, 'delete'],
    ] as const) {
      const menu = items(target)
      expectMenuRendered(menu, anchor)
      const d = density(menu)
      expect(d.pct, `${name} is a wall of grey at ${d.pct}%`).toBeLessThanOrEqual(60)
    }
  })
})
