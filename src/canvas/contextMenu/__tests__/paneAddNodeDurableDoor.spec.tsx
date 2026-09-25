/**
 * ⭐⭐ A HUMAN CAN ADD TO THEIR OWN MODEL — the pane "Add node" door, and the
 * reason each of its neighbours stays shut.
 *
 * Measured on deployed staging `fec043bf` (13 Sep 2026, seven probes): a user
 * could delete, copy, rename and set a value, and could not add a node or an
 * edge anywhere on the canvas. The `add_node` code for every kind was built and
 * reachable from no affordance. The cause was one stale entry in
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS`, stripping the item before it rendered,
 * while `CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash` — whose own
 * comment names the context-menu node add — has said `'server_graph'` since the
 * durable writer landed. CLAUDE.md trap 21: two keys, one concept.
 *
 * ⚠⚠ THIS FILE IS A HAND-WRITTEN CORPUS ON PURPOSE, AND THAT IS THE POINT
 * (CLAUDE.md trap 12d). The audit in `useMenuItems.spec.ts` ITERATES
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS`, so it proves the filter AGREES with that
 * set and can never prove the set is RIGHT — remove an id and the derived audit
 * adapts in silence, which is precisely how `add-node` stayed shut. The ids
 * below are spelled out so a future shrink of that set REDs here instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMenuItems } from '../useMenuItems'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../../mutations/mutationAuthority'
import { WIRE_ADDABLE_NODE_KINDS } from '../../mutations/structuralAdd'
import type { PaneTarget, MenuEntry, MenuItemDef } from '../types'

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
  // `Object.assign` rather than property writes: a bare `vi.fn()` has no
  // `getState`/`setState` in its type, and assigning them is a TS2339 the
  // typecheck ratchet REDs on. Same store double, typed.
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

const showToast = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)
const onClose = vi.fn()

const PANE: PaneTarget = { kind: 'pane', screenPos: { x: 1, y: 2 } }

function allIds(items: MenuEntry[]): string[] {
  return items.flatMap(entry => {
    if ('type' in entry) return []
    return [entry.id, ...allIds((entry as MenuItemDef).submenuItems ?? [])]
  })
}

/** The pane menu's ENTRIES, not just their ids — needed to assert a row is
 *  surfaced AND inert AND carries a reason, which an id set cannot express. */
function paneMenuEntries(): MenuItemDef[] {
  const { result } = renderHook(() =>
    useMenuItems({ target: PANE, showToast, screenToFlowPosition, onClose }),
  )
  const flat = (list: readonly unknown[]): MenuItemDef[] =>
    list.flatMap(entry => {
      if (entry && typeof entry === 'object' && 'type' in (entry as object)) return []
      const e = entry as MenuItemDef
      return [e, ...flat((e.submenuItems ?? []) as readonly unknown[])]
    })
  return flat(result.current as readonly unknown[])
}

function paneMenuIds(): Set<string> {
  const { result } = renderHook(() =>
    useMenuItems({ target: PANE, showToast, screenToFlowPosition, onClose }),
  )
  return new Set(allIds(result.current))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the pane context menu offers a durable node add', () => {
  it('mounts "Add node" on the canvas pane', () => {
    expect(paneMenuIds().has('add-node')).toBe(true)
  })

  /**
   * ⚠ BOUND BY IDENTITY, NEVER BY COUNT (CLAUDE.md trap 19). A `length` check
   * passes on any six ids; these are the six the product promises, each named.
   */
  it.each(['factor', 'risk', 'outcome', 'option'])(
    'offers %s as a thing the user may add',
    kind => {
      expect(paneMenuIds().has(`add-node-${kind}`)).toBe(true)
    },
  )

  /**
   * ⛔⛔ THIS LIST WAS SIX KINDS UNTIL 13 Sep 2026 AND INCLUDED `goal` AND
   * `decision`. Inverted, not deleted, so the overturned claim stays visible.
   *
   * ⚠ WIRE-PERSISTABILITY WAS THE WRONG QUESTION FOR THESE TWO, and the test
   * above (`offers no kind the wire cannot persist`) would have passed them
   * forever: a second goal persists perfectly well. It simply does nothing,
   * because every production consumer takes the FIRST match while a new node is
   * APPENDED — `islRequestAdapter.ts:498` is THE ANALYSIS REQUEST. The user
   * would add a Goal, watch it persist and render, and the analysis would go on
   * optimising the other one.
   *
   * ⭐ Bound to the two kinds BY NAME rather than left to the derivation,
   * deliberately. `ADDABLE_NODE_TYPE_ITEMS` filters them out, so a test that
   * merely re-read that filter would agree with it by construction and could
   * never notice the exclusion being dropped — a guard agreeing with itself
   * (CLAUDE.md trap 12d). This is the hand-written half.
   */
  it.each(['goal', 'decision'])(
    'does NOT offer %s — the product reads it with .find(), so a second one is inert',
    kind => {
      expect(paneMenuIds().has(`add-node-${kind}`)).toBe(false)
    },
  )

  /**
   * The door and the wire agree by DERIVATION, so a contract that drops a kind
   * closes its door with no edit here. `constraint` is the one documented
   * divergence — `CEE_UNPERSISTABLE_NODE_KIND` — and it must never gain a door.
   */
  it('offers no kind the wire cannot persist', () => {
    const offered = [...paneMenuIds()]
      .filter(id => id.startsWith('add-node-'))
      .map(id => id.slice('add-node-'.length))
    expect(offered.length).toBeGreaterThan(0)
    for (const kind of offered) {
      expect(WIRE_ADDABLE_NODE_KINDS.has(kind), `${kind} is not wire-addable`).toBe(true)
    }
    expect(offered).not.toContain('constraint')
  })

  /**
   * ⚠ PINS THE PRECONDITION IN-TEST (CLAUDE.md trap 13b). The assertions above
   * are only evidence about a DURABLE door while the carrier's authority really
   * is `server_graph`; if that key were flipped back, they would still pass for
   * the wrong reason and the menu would be presenting a local-only write as a
   * saved shared-model edit.
   */
  it('rests on a carrier the authority table calls server_graph', () => {
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash)).toBe(true)
  })
})

describe('the carrierless neighbours stay shut', () => {
  /**
   * ⚠⚠ THE GROUPED REASON THAT STOOD HERE HAS EXPIRED (18 Sep 2026), AND THE
   * ASSERTIONS BELOW STILL HOLD FOR REASONS THAT ARE NOT THE SAME AS EACH
   * OTHER'S. It read: "All three are blocked by the same missing writer:
   * `structural_add_edge` is `'reader_only_refusal'` in CEE." CEE #1443 shipped
   * that writer on 13 Sep, `store.addNodeWithEdge` now captures both halves, and
   * `add-connected-*` is offered and ACTIONABLE on the node menu.
   *
   * ⚠ SO THE `add-connected-*` ROWS BELOW ARE NOW PINNING SOMETHING ELSE, AND
   * IT IS WEAKER THAN IT LOOKS. Those three ids are built by `buildNodeMenu`,
   * never by `buildPaneMenu`, so their absence from the PANE menu has always
   * been about the TARGET KIND rather than about authority — this case could
   * not have discriminated the authority change in either direction. Kept, with
   * the reason corrected, rather than deleted: it still guards against the pane
   * menu quietly growing node-only rows. The authority claim it used to carry
   * now lives in `connectedAddDurableDoor.spec.tsx`, against a NODE target,
   * where it can actually fail.
   *
   *   · `add-connected-*` → node-target items; never built for the pane
   *   · `insert-factor-between` → edge-target item, and it has a SECOND writer
   *     (a bare `setState` localApply) so the chokepoint would not cover it
   *   · `duplicate` / `paste` → `duplicateSelected` / `pasteClipboard`, still
   *     carrierless: unexpressible node data, and no batched carrier
   *
   * Each is named rather than iterated so shrinking the set cannot pass in
   * silence.
   */
  /**
   * ⚠ SPLIT ON REBASE, 13 Sep 2026 — INVERTED, NOT DELETED, so the overturned
   * claim stays visible. This list held `paste`, `undo` and `redo` asserting
   * ABSENCE. #1304 changed the policy for keyboard-reachable gestures from
   * REMOVAL to a disabled row carrying an honest reason, so for those three the
   * true property became "not ACTIONABLE", not "not PRESENT".
   *
   * ⭐ Keeping both fixes required this split. Asserting absence would have
   * forced #1304's surfacing back out; dropping the assertion entirely would
   * have lost #1538's guarantee that no carrierless gesture becomes actionable.
   * The menu-only ids below are unaffected — they are still hidden and folded
   * into the grouped note.
   *
   * ⚠⚠ `paste` REJOINED THIS LIST 25 Sep 2026 (A20), REVERSING THE SPLIT ABOVE
   * FOR THAT ONE ID. It is no longer surfaced disabled-with-a-reason at all:
   * `useMenuItems.ts` stopped building the row, so "not PRESENT" is once again
   * the true property. `Copy`, its only producer, wrote to a clipboard Paste
   * had no durable way to consume — both are hidden from every menu that
   * showed them. See `useMenuItems.A20.noDeadClipboard.spec.ts`.
   */
  it.each([
    'add-connected-factor',
    'add-connected-outcome',
    'add-connected-risk',
    'insert-factor-between',
    'duplicate',
    'cut',
    'set-value',
    'mark-assumption',
    'reverse-edge',
    'paste',
  ])('does not offer %s anywhere on the pane menu', id => {
    expect(paneMenuIds().has(id)).toBe(false)
  })

  /**
   * The keyboard-reachable gestures the pane menu does offer: SURFACED so the
   * row can say why before the user presses the key, and INERT so nothing
   * carrierless becomes actionable. Both halves asserted — presence alone would
   * pass on a re-enabled gesture.
   *
   * ⚠ `paste` LEFT THIS LIST (A20, 25 Sep 2026) — see the note above the
   * `does not offer %s` cases, where it now belongs.
   */
  it.each(['undo', 'redo'])(
    'offers %s as a disabled row with a reason, never as an actionable one',
    id => {
      const entry = paneMenuEntries().find(e => e.id === id)
      expect(entry, `${id} should be surfaced, not hidden`).toBeDefined()
      expect(entry?.enabled ?? false, `${id} actionable`).toBe(false)
      expect(
        String(entry?.tooltip ?? entry?.disabledReason ?? '').length,
        `${id} carries a reason`,
      ).toBeGreaterThan(0)
    },
  )

  /**
   * ⚠ THE CONTRAST CONTROL. Without it this whole describe block would pass on
   * a menu that rendered nothing at all — an absence proven by an instrument
   * that can see no presence proves nothing (CLAUDE.md trap 13).
   */
  it('is reading a menu that does render its read-only items', () => {
    const ids = paneMenuIds()
    expect(ids.has('ask-ai-pane')).toBe(true)
    expect(ids.size).toBeGreaterThan(3)
  })
})
