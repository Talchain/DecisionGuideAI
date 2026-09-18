/**
 * ⭐⭐⭐ A PERSON CAN GROW THEIR OWN MODEL FROM A NODE — "Add connected factor /
 * outcome / risk", and the honest limit of what those three save.
 *
 * Before this, right-clicking a factor offered none of them. They were built,
 * they had handlers, and `applyContextMenuMutationAuthority` stripped all three
 * before the menu rendered, because they sat in
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` — a set gated on `canvasSemanticMutations`,
 * which is `'disabled'`. That gate was RIGHT until 13 Sep 2026: CEE held
 * `structural_add_edge` at `'reader_only_refusal'`, so a durable emit would have
 * saved the node and silently dropped the link. **CEE #1443 shipped the writer
 * and promoted the kind to `'mutating'`; `canvasEdgeAddWithServerHash` has said
 * `'server_graph'` since.** The blocker cleared and the door stayed shut,
 * because the prose recording the blocker outlived it (CLAUDE.md trap 12 — a
 * hand-maintained mirror, and its drift reads as green).
 *
 * ⚠⚠ THIS FILE IS A HAND-WRITTEN CORPUS ON PURPOSE (CLAUDE.md trap 12d). The
 * audit in `useMenuItems.spec.ts` ITERATES `LOCAL_SEMANTIC_CONTEXT_MENU_IDS`, so
 * it proves the filter AGREES with that set and can never prove the set is
 * RIGHT — an id removed from it makes the derived audit adapt in silence, which
 * is exactly how `add-node` stayed shut for weeks and how these three followed.
 * The ids below are spelled out so a future shrink REDs here instead.
 *
 * ⚠ WHAT THIS FILE DOES NOT CLAIM. It is about the DOOR. That the gesture behind
 * it captures a durable intent, and that the link honestly discloses it still
 * needs a strength, is a different claim measured against the REAL store in
 * `mutations/__tests__/structuralAdd.connectedAddIsDurable.spec.ts`. Neither
 * file restates the other's scope: a menu item that renders is not a save.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMenuItems, LOCAL_SEMANTIC_CONTEXT_MENU_IDS } from '../useMenuItems'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../../mutations/mutationAuthority'
import type { NodeTarget, MenuEntry, MenuItemDef } from '../types'
import type { Node } from '@xyflow/react'

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
  // `Object.assign` rather than property writes — a bare `vi.fn()` has no
  // `getState`/`setState` in its type, and assigning them is a TS2339 the
  // typecheck ratchet REDs on.
  const mockStore = Object.assign(vi.fn((selector: any) => selector(mockState)), {
    getState: () => mockState,
    setState: (_partial: any) => {},
  })
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (state: any) => state.results.status,
    selectReport: (state: any) => state.results.report,
  }
})

/**
 * ⚠ `importOriginal`-SPREAD, NEVER A HAND-LISTED ALLOWLIST. A `vi.mock` factory
 * REPLACES the module; a list of the exports the menu happens to read today goes
 * stale the moment it reads one more, and `useMenuItems.spec.ts` records that
 * failure by name. Only the side-effecting actions are stubbed, because this
 * file asserts menu SHAPE and letting them run would drive the store.
 */
vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
  deleteAction: vi.fn(),
  addNodeAction: vi.fn(),
  addConnectedFactorAction: vi.fn(),
  addConnectedOutcomeAction: vi.fn(),
  addConnectedRiskAction: vi.fn(),
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

const FACTOR_NODE = {
  id: 'f1',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Revenue', kind: 'factor', observedState: { value: 50 } },
} as Node

const FACTOR_TARGET: NodeTarget = {
  kind: 'node', nodeId: 'f1', nodeType: 'factor', node: FACTOR_NODE, screenPos: { x: 0, y: 0 },
}

/** The CONSTRAINT node, whose exclusion is structural rather than about authority. */
const CONSTRAINT_NODE = {
  id: 'c1', type: 'constraint', position: { x: 0, y: 0 },
  data: { label: 'Budget limit', kind: 'constraint' },
} as Node

const CONSTRAINT_TARGET: NodeTarget = {
  kind: 'node', nodeId: 'c1', nodeType: 'constraint', node: CONSTRAINT_NODE, screenPos: { x: 0, y: 0 },
}

function flatten(list: readonly MenuEntry[]): MenuItemDef[] {
  return list.flatMap(entry => {
    if ('type' in entry) return []
    const e = entry as MenuItemDef
    return [e, ...flatten((e.submenuItems ?? []) as readonly MenuEntry[])]
  })
}

function menuFor(target: NodeTarget): MenuItemDef[] {
  const { result } = renderHook(() =>
    useMenuItems({ target, showToast, screenToFlowPosition, onClose }),
  )
  return flatten(result.current as readonly MenuEntry[])
}

const CONNECTED_ADD_IDS = [
  'add-connected-factor',
  'add-connected-outcome',
  'add-connected-risk',
] as const

/**
 * ⚠ BRACES, NOT A CONCISE BODY, AND THE REASON IS A REAL TYPE ERROR RATHER
 * THAN STYLE. `vi.clearAllMocks()` returns `VitestUtils` for chaining, so a
 * concise arrow body RETURNS it and TypeScript reads the hook as promising a
 * cleanup callback: `TS2322: Type 'VitestUtils' is not assignable to type
 * 'Awaitable<HookCleanupCallback>'`. Braces discard the value.
 *
 * ⭐ THIS FILE COPIED THE BROKEN SHAPE FROM `useMenuItems.spec.ts:105`, WHERE
 * THE SAME LINE IS ALREADY IN `scripts/ci/typecheck-baseline.txt` (that file
 * carries 3 baselined errors). So the sibling is not evidence that the shape
 * typechecks — it is evidence that it was accepted once. The ratchet caught it
 * here only because a NEW file gets no baseline, which is exactly the defect
 * class `--update-baseline` would have laundered: the gate offered that escape
 * and it was declined, because `baseline=2081 current=2082 (+1)` was a real new
 * error and not intended drift.
 */
beforeEach(() => { vi.clearAllMocks() })

describe('the node context menu offers the connected adds', () => {
  /**
   * ⚠ BOUND BY MENU ID, NEVER BY LABEL OR COUNT (CLAUDE.md trap 19). A length
   * check passes on any three rows; a label check passes on whatever copy the
   * builder currently happens to use. The id is the thing
   * `applyContextMenuMutationAuthority` judges, so it is the thing to bind to.
   */
  it.each(CONNECTED_ADD_IDS)('mounts %s on a factor node', id => {
    expect(menuFor(FACTOR_TARGET).some(e => e.id === id)).toBe(true)
  })

  /**
   * ⭐ PRESENCE IS NOT THE PROPERTY. The policy this menu ships renders an
   * unauthorised keyboard-reachable gesture as a DISABLED row with a reason, so
   * an id can be present and still do nothing. Both halves asserted, because
   * either alone passes on the state this PR exists to leave behind.
   */
  it.each(CONNECTED_ADD_IDS)('renders %s as an ACTIONABLE row, not a disabled one', id => {
    const entry = menuFor(FACTOR_TARGET).find(e => e.id === id)
    expect(entry, `${id} should be mounted`).toBeDefined()
    expect(entry?.enabled ?? false, `${id} actionable`).toBe(true)
  })

  /**
   * ⚠ PINS ITS OWN PRECONDITION IN-TEST (CLAUDE.md trap 13b). Everything above
   * is evidence about a DURABLE door only while BOTH carriers really are
   * `server_graph`. If either key were flipped back, the assertions above would
   * still pass for the wrong reason and the menu would be presenting a local-only
   * write as a saved shared-model edit — which is the exact lie
   * `CANONICAL_EDIT_AUTHORITY` exists to forbid.
   *
   * ⭐ BOTH, NOT EITHER. The gesture creates a node AND a link; a node saved with
   * its link silently dropped is the half-loss the old exclusion refused, and it
   * is why `menuIdIsAuthorised` reads the two keys in conjunction.
   */
  it('rests on TWO carriers the authority table calls server_graph', () => {
    expect(
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash),
      'the NODE half',
    ).toBe(true)
    expect(
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasEdgeAddWithServerHash),
      'the LINK half',
    ).toBe(true)
  })

  /**
   * ⚠ THE CONTRAST CONTROL, and without it this whole block would pass on a menu
   * that had simply stopped filtering anything (CLAUDE.md trap 13 — an absence
   * or presence probe needs a discrimination it is actually making).
   *
   * `mark-assumption` and `set-value` are still carrierless and still in
   * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS`; they must stay hidden on the very same
   * menu that now shows the three adds. That is what makes this a PER-ID split
   * rather than a blanket opening — the failure mode a flip of
   * `canvasSemanticMutations` would have produced, which
   * `applyContextMenuMutationAuthority`'s own header names as the thing to avoid.
   */
  it.each(['mark-assumption', 'set-value'])(
    'still withholds %s on the same menu — the split is per-id, not a blanket open',
    id => {
      expect(LOCAL_SEMANTIC_CONTEXT_MENU_IDS.has(id), `${id} precondition`).toBe(true)
      const entry = menuFor(FACTOR_TARGET).find(e => e.id === id)
      expect(entry?.enabled ?? false, `${id} must not be actionable`).toBe(false)
    },
  )

  /** Non-vacuity: this is a menu that renders read-only items at all. */
  it('is reading a menu that does render its ordinary items', () => {
    const ids = menuFor(FACTOR_TARGET).map(e => e.id)
    expect(ids).toContain('ask-ai')
    expect(ids).toContain('delete')
  })

  /**
   * ⚠ A DIFFERENT REASON, NAMED APART (CLAUDE.md trap 21). The constraint node
   * offers none of the three, and that has NOTHING to do with authority:
   * `buildNodeMenu` guards the whole block with `if (kind !== 'constraint')`,
   * and `constraint` is the one kind `WIRE_ADDABLE_NODE_KINDS` subtracts.
   * Asserted here so a later lane reading "constraint has no connected add"
   * does not conclude the authority gate is still shut.
   */
  it.each(CONNECTED_ADD_IDS)('still offers no %s on a constraint — structural, not authority', id => {
    expect(menuFor(CONSTRAINT_TARGET).some(e => e.id === id)).toBe(false)
  })
})
