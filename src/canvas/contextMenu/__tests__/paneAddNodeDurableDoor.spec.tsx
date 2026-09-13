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
  it.each(['factor', 'risk', 'outcome', 'option', 'goal', 'decision'])(
    'offers %s as a thing the user may add',
    kind => {
      expect(paneMenuIds().has(`add-node-${kind}`)).toBe(true)
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
   * Every id here reaches a writer that captures NO `structural_add`, and each
   * is named rather than iterated so shrinking the set cannot pass in silence.
   *
   *   · `add-connected-*` and `insert-factor-between` → `addNodeWithEdge`
   *   · `duplicate` / `paste` → `duplicateSelected` / `pasteClipboard`
   *
   * All three are blocked by the same missing writer: `structural_add_edge` is
   * `'reader_only_refusal'` in CEE, so a durable emit would save the nodes and
   * silently DROP the topology.
   */
  it.each([
    'add-connected-factor',
    'add-connected-outcome',
    'add-connected-risk',
    'insert-factor-between',
    'duplicate',
    'paste',
    'cut',
    'undo',
    'redo',
    'set-value',
    'mark-assumption',
    'reverse-edge',
  ])('does not offer %s anywhere on the pane menu', id => {
    expect(paneMenuIds().has(id)).toBe(false)
  })

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
