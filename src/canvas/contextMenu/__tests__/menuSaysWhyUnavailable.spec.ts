/**
 * THE CONTEXT MENU MUST SAY WHY A GESTURE IS UNAVAILABLE, NOT DELETE IT.
 *
 * `applyContextMenuMutationAuthority` used to remove all 13
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` outright, so a user could not tell
 * "this product cannot do that" from "this product is broken" — the sharpest
 * case being a node menu that offers Delete while Cut and Duplicate have
 * vanished.
 *
 * ⚠ A20 (25 Sep 2026): `Copy` and `Paste` are no longer part of this story at
 * all. `paste` left `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` because the row itself
 * is gone — hidden structurally in `useMenuItems.ts`, not authority-gated —
 * and `Copy` was never gated here (it was always enabled, see the header
 * above this file's density block); it too is now simply absent from the
 * entry lists the builders return. The density counts below reflect that.
 *
 * ⭐ THE DENSITY CHOICE IS MEASURED, NOT ASSERTED — see the
 * "menu density" block at the foot of this file, which builds every menu under
 * BOTH candidate policies and pins the counts. That measurement is why the
 * all-disabled policy lost; the exact figures are re-pinned at each case as
 * the entry lists change, most recently by A20's removal of Copy and Paste.
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

/**
 * ⚠ MUTABLE ON PURPOSE. Measuring menu density against an EMPTY canvas would
 * measure the fixture, not the policy: with zero nodes `auto-arrange` is
 * disabled for its own honest reason ("No nodes to arrange") and with a null
 * clipboard so is `paste`, so an empty store inflates the inert count of BOTH
 * policies equally and hides the difference between them. The density block
 * below therefore loads a canvas that has nodes and a filled clipboard.
 */
const storeState = {
  clipboard: null as null | { nodes: unknown[] },
  nodes: [] as unknown[],
}

vi.mock('../../store', () => {
  const mockState = {
    get clipboard() { return storeState.clipboard },
    get nodes() { return storeState.nodes },
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
  const mockStore: any = vi.fn((selector: any) => selector(mockState))
  mockStore.getState = () => mockState
  mockStore.setState = (_partial: any) => {}
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (state: any) => state.results.status,
    selectReport: (state: any) => state.results.report,
  }
})

/**
 * ⚠ SPREAD THE ORIGINAL — DO NOT HAND-LIST THESE EXPORTS.
 *
 * This factory previously listed the action functions and nothing else. A
 * `vi.mock` factory REPLACES the module, so every export the list did not name
 * was absent at runtime — and `buildNodeMenu` reads more than the actions it
 * dispatches. When `#1292` ("a team can argue with the question and the
 * choices") landed `CHALLENGE_KINDS` on this module and `useMenuItems.ts:432`
 * began reading it, the hand-listed factory made it `undefined` and every test
 * mounting a node menu threw at `CHALLENGE_KINDS.has(...)`.
 *
 * The failure was invisible until a rebase: the list was complete on the day it
 * was written, and nothing fails when a NEW export is added — it simply is not
 * there. That is the hand-maintained-mirror defect, and the sibling spec
 * `useMenuItems.spec.ts` already carries this same importOriginal fix.
 *
 * Spreading the original keeps the stubs (nothing dispatches for real) while
 * every non-action export stays live and future additions arrive on their own.
 */
vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
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

beforeEach(() => {
  authorityValue.current = 'disabled'
  storeState.clipboard = null
  storeState.nodes = []
})

describe('the removed gestures are surfaced with a reason, not deleted', () => {
  // A20 (25 Sep 2026): `paste` left this list — it is hidden entirely now,
  // not surfaced disabled-with-a-reason. See `useMenuItems.A20.noDeadClipboard.spec.ts`.
  it.each(['undo', 'redo'])('pane menu shows %s as present-but-disabled', id => {
    const menu = items(PANE)
    expectMenuRendered(menu, 'ask-ai-pane')
    const item = findItem(menu, id)
    expect(item, `${id} was deleted from the pane menu`).toBeDefined()
    expect(item!.enabled).toBe(false)
    expect(item!.disabledReason).toBeTruthy()
  })

  /**
   * ⛔ `duplicate` REMOVED FROM THIS LIST 13 Sep 2026 — inverted below, not
   * deleted. It failed both clauses of KEYBOARD_REACHABLE_SEMANTIC_IDS's own
   * criterion: ⌘D reaches the Documents drawer, not duplicate, and
   * `isClipboardMutationGesture` raises no toast for a row to agree with.
   */
  it.each(['cut'])('factor node menu shows %s as present-but-disabled', id => {
    const menu = items(FACTOR_NODE)
    expectMenuRendered(menu, 'delete')
    const item = findItem(menu, id)
    expect(item, `${id} was deleted from the node menu`).toBeDefined()
    expect(item!.enabled).toBe(false)
    expect(item!.disabledReason).toBeTruthy()
  })

  it('cut carries the structural notice as its tooltip, and duplicate is not a row', () => {
    const menu = items(FACTOR_NODE)
    expectMenuRendered(menu, 'delete')
    for (const id of ['cut']) {
      expect(findItem(menu, id)!.tooltip).toBe(CANVAS_STRUCTURAL_EDIT_NOTICE)
    }
    // ⛔ AND `duplicate` MUST NOT BE A ROW AT ALL. Asserting its absence here,
    // beside its surviving sibling, is what stops it being quietly re-added:
    // a row saying "duplicate is unavailable" over a ⌘D that opened a drawer is
    // the defect `isClipboardMutationGesture`'s header already refused.
    expect(findItem(menu, 'duplicate'), 'duplicate must be menu-only').toBeUndefined()
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
    // ⚠ PANE DROPPED ON REBASE, 13 Sep 2026, and it is the note working as
    // designed rather than a regression. The note is SELF-RETIRING: appended
    // only where a menu-only gesture was actually hidden. `add-node` was the
    // pane's only such casualty, and #1538 authorised it, so the pane now hides
    // nothing and correctly grows no note — the same property the MULTI twin
    // below exists to pin. The pane has joined that twin's case.
    for (const [target, anchor] of [[FACTOR_NODE, 'delete'], [CAUSAL_EDGE, 'delete']] as const) {
      const menu = items(target)
      expectMenuRendered(menu, anchor)
      const note = findItem(menu, STRUCTURAL_EDITS_NOTE_ID)
      expect(note, `note missing for ${(target as any).kind}`).toBeDefined()
      expect(note!.enabled).toBe(false)
      expect(note!.tooltip).toBe(CANVAS_STRUCTURAL_EDIT_NOTICE)
    }
  })

  it('TWIN, PREMISE OVERTURNED: the multi menu now hides one, so it DOES get a note', () => {
    // ⚠ INVERTED 13 Sep 2026, not deleted. This read "hides no menu-only
    // gesture, so it gets NO note", on the reasoning that its only removals
    // (cut, duplicate) were both surfaced as disabled rows. Moving `duplicate`
    // to menu-only makes that false: the multi menu now hides exactly one, so
    // the self-retiring note correctly appears.
    //
    // ⭐ THE PROPERTY THIS CASE EXISTS TO PIN IS UNCHANGED and is asserted by
    // the PANE case above, which now hides nothing and grows no note: the note
    // is appended only where something was actually hidden. The two menus have
    // simply swapped sides of that test, which is stronger evidence than either
    // alone — it could not be satisfied by a note that is always or never added.
    const menu = items(MULTI)
    expectMenuRendered(menu, 'delete')
    expect(findItem(menu, STRUCTURAL_EDITS_NOTE_ID), 'duplicate is now hidden here').toBeDefined()
    expect(findItem(menu, 'cut'), 'cut is still surfaced').toBeDefined()
    expect(findItem(menu, 'duplicate'), 'duplicate is menu-only').toBeUndefined()
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
  beforeEach(() => {
    // A canvas a user would actually be looking at, so `auto-arrange` and the
    // pristine `paste` are enabled for their own reasons and the counts
    // reflect the POLICY rather than an empty fixture.
    storeState.nodes = [{ id: 'f1' }, { id: 'f2' }]
    storeState.clipboard = { nodes: [{ id: 'f1' }] }
  })

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

    // ⚠ TUPLES RE-MEASURED ON REBASE, 13 Sep 2026. They moved because #1538
    // moved `add-node` out of `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` and into its own
    // per-id authority, so one row that policy A counted as inert is now simply
    // enabled. ⭐ The ABSOLUTE numbers are the measurement of the day; the
    // LOAD-BEARING claims are the two relations below, and they are unchanged by
    // the rebase. Re-pinning the tuples keeps the record honest without letting
    // the test agree with whatever the code happens to produce.
    //
    // ⚠⚠ RE-PINNED 18 Sep 2026 BY DERIVATION, NOT BY MEASUREMENT, AND SAYING SO
    // IS PART OF THE CHANGE. The lane that moved `add-connected-*` out of
    // `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` could not run this suite (a load guard
    // was active; any local number would have been void), so writing "measured"
    // here would be a fabrication. **CI is the authority on these four digits.**
    //
    // ⭐ THE DERIVATION, WRITTEN OUT SO A RED IS DIAGNOSABLE IN ONE READ. It is
    // checkable against the numbers it replaces rather than invented:
    //   · `pristine` opens `canvasSemanticMutations` only, so `base` is
    //     unchanged by the move — `rows: 12` stands.
    //   · 12 pristine rows − 7 shipped rows + 1 grouped note = SIX ids hidden by
    //     the shipped policy, and on a factor node those six are exactly
    //     set-value, add-connected-{factor,outcome,risk}, mark-assumption,
    //     duplicate. The old `inert: 7` is those six plus `cut`. Both old
    //     figures reconcile exactly, which is what makes this a derivation.
    //   · Three of the six left the set, so policy A now disables four:
    //     inert 7 -> 4, pct round(4/12*100) = 33.
    //   · The same three become enabled rows under the shipped policy:
    //     rows 7 -> 10, inert unchanged at 2 (`cut` + the note),
    //     pct round(2/10*100) = 20.
    // ⚠ RE-PINNED 25 Sep 2026 (A20): `copy` left the pristine entry list
    // entirely — it is hidden structurally now, not authority-gated — so the
    // baseline lost one always-enabled row: rows 12 -> 11, inert unchanged at
    // 4, pct round(4/11*100) = 36.
    expect(a).toEqual({ rows: 11, inert: 4, pct: 36 })
    // Same reason on the shipped side: one fewer always-enabled row.
    expect(shipped).toEqual({ rows: 9, inert: 2, pct: 22 })
    expect(shipped.inert).toBeLessThan(a.inert)
    expect(shipped.rows).toBeLessThan(a.rows)
  })

  it('the pane menu: the two policies TIE, and that is worth recording', () => {
    // ⚠ TUPLES RE-MEASURED ON REBASE, 13 Sep 2026. The CONCLUSION is unchanged:
    // the pane still cannot discriminate between the policies. Both moved from
    // 4 inert to 3 for the same reason — #1538 took `add-node` out of
    // `LOCAL_SEMANTIC_CONTEXT_MENU_IDS`, so NEITHER policy disables it any more.
    //
    // ⛔ The rebasing seat first wrote this up as "the tie is BROKEN", having
    // seen the shipped side move from 4 inert to 3 and not re-measured policy A.
    // One side of a comparison moving is not a change in the comparison. Left
    // recorded because the error is cheaper to read than to repeat.
    //
    // ⭐ The original note's honest half stands and is why this case is kept at
    // all: a measurement that only reports the case favouring the shipped
    // choice is not a measurement.
    const base = pristine(PANE)
    expectMenuRendered(base, 'ask-ai-pane')
    const a = density(policyAllDisabled(base))
    const shipped = density(items(PANE))
    // ⚠ RE-PINNED 25 Sep 2026 (A20): `paste` left the pristine entry list
    // entirely — it is hidden structurally now, not authority-gated — so both
    // policies lost the same always-present row: rows 7 -> 6, inert 3 -> 2,
    // pct round(2/6*100) = 33. The tie is unchanged; only the tied value moved.
    expect(a).toEqual({ rows: 6, inert: 2, pct: 33 })
    expect(shipped).toEqual({ rows: 6, inert: 2, pct: 33 })
    expect(shipped).toEqual(a) // the tie, asserted as a relation rather than twice by value
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
