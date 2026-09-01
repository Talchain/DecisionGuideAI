/**
 * `useRestoredLayoutWidth` — BOTH DIRECTIONS OF THE PREDICATE.
 *
 * A hook that always derived would pass every "a reloaded canvas is clean"
 * assertion while silently overriding the width a layout had already published
 * — and would then CAUSE overlap on an edited-but-not-re-laid-out graph. A hook
 * that never derived would leave the reload defect exactly as it was. So the
 * suite pins the fire case AND the must-not-fire cases, and each guard has a
 * mutant that bites only it (see the PR body's mutant table).
 *
 * ⚠ STATE CLASS IS NAMED IN EVERY TEST — fresh draft / saved reload / edited
 * after layout. Two earlier diagnoses of this defect reached opposite,
 * individually-correct conclusions purely by omitting it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useLayoutStore } from '../layoutStore'
import { useRestoredLayoutWidth } from '../hooks/useRestoredLayoutWidth'
import { NODE_CARD_MAX_W, NODE_LAYOUT_MIN_W } from '../utils/nodeLayoutConstants'

function n(id: string, type: string, x: number, y: number): Node {
  return { id, type, position: { x, y }, data: { label: id } } as Node
}

/**
 * A graph whose widest tier is `factors` factors, positioned on a REAL spread
 * (never stacked), i.e. exactly the shape a restore installs.
 *
 * `factors >= 7` is the compressed branch (cards at NODE_LAYOUT_MIN_W); `<= 6`
 * is the single-row branch (NODE_CARD_MAX_W). Both are exercised, because a
 * suite that only ever saw the compressed case could not tell "derives
 * correctly" from "always returns the minimum".
 */
function restoredGraph(factors: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    n('d1', 'decision', 0, 0),
    n('o1', 'option', 0, 400),
    n('o2', 'option', 400, 400),
  ]
  for (let i = 0; i < factors; i++) nodes.push(n(`f${i}`, 'factor', i * 350, 900))
  const edges: Edge[] = nodes
    .filter((x) => x.id !== 'd1')
    .map((x) => ({ id: `e-${x.id}`, source: 'd1', target: x.id }) as Edge)
  return { nodes, edges }
}

function seed(state: {
  nodes: Node[]
  edges?: Edge[]
  layoutVersion?: number
  pendingLayout?: boolean
  layoutInProgress?: boolean
  currentScenarioId?: string | null
}) {
  act(() => {
    useCanvasStore.setState({
      nodes: state.nodes,
      edges: state.edges ?? [],
      layoutVersion: state.layoutVersion ?? 0,
      pendingLayout: state.pendingLayout ?? false,
      layoutInProgress: state.layoutInProgress ?? false,
      currentScenarioId: state.currentScenarioId ?? null,
    } as never)
  })
}

describe('useRestoredLayoutWidth', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    act(() => {
      useLayoutStore.setState({ layoutNodeWidth: null, direction: 'DOWN', respectLocked: true } as never)
    })
  })

  // ── FIRES: state class = SAVED SCENARIO, RELOADED ────────────────────────
  it('[saved reload] derives the compressed width for a restored 7-wide model', () => {
    const { nodes, edges } = restoredGraph(7)
    seed({ nodes, edges, currentScenarioId: 'scA' })
    expect(useLayoutStore.getState().layoutNodeWidth).toBeNull()

    renderHook(() => useRestoredLayoutWidth())

    // The load-bearing assertion: NOT the max. Without the hook this reads
    // `null`, BaseNode falls back to NODE_CARD_MAX_W, and cards render 90px
    // wider than the stride their positions sit on.
    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_LAYOUT_MIN_W)
    expect(useLayoutStore.getState().layoutNodeWidth).not.toBe(NODE_CARD_MAX_W)
  })

  it('[saved reload] derives the FULL width for a restored 4-wide model', () => {
    // The discriminating twin of the case above: the hook must not simply
    // install the minimum on every restore.
    const { nodes, edges } = restoredGraph(4)
    seed({ nodes, edges, currentScenarioId: 'scB' })

    renderHook(() => useRestoredLayoutWidth())

    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_CARD_MAX_W)
  })

  it('[saved reload] fires once, and re-arms on a scenario SWITCH', () => {
    const wide = restoredGraph(7)
    seed({ nodes: wide.nodes, edges: wide.edges, currentScenarioId: 'scA' })
    const { rerender } = renderHook(() => useRestoredLayoutWidth())
    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_LAYOUT_MIN_W)

    // A re-render with no restore must not re-derive.
    const spy = vi.spyOn(useLayoutStore.getState(), 'setLayoutNodeWidth')
    rerender()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()

    // A DIFFERENT scenario is a new restore — nothing sets layoutVersion on a
    // restore path, so this is reachable on reload-then-switch.
    const narrow = restoredGraph(3)
    seed({ nodes: narrow.nodes, edges: narrow.edges, currentScenarioId: 'scB' })
    rerender()
    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_CARD_MAX_W)
  })

  // ── DOES NOT FIRE: the "stored width wins" direction ──────────────────────
  it('[edited after layout] leaves a published width alone when the graph has grown', () => {
    // THE CASE THAT MAKES THE layoutVersion GUARD LOAD-BEARING. A 6-wide model
    // was laid out at NODE_CARD_MAX_W (stride 320). The user adds a 7th factor
    // and no re-layout runs. The positions on screen are STILL on the 320
    // stride, so re-deriving to NODE_LAYOUT_MIN_W would be wrong — and a hook
    // without this guard would do exactly that.
    const grown = restoredGraph(7)
    seed({ nodes: grown.nodes, edges: grown.edges, layoutVersion: 3, currentScenarioId: 'scA' })
    act(() => {
      useLayoutStore.getState().setLayoutNodeWidth(NODE_CARD_MAX_W)
    })

    renderHook(() => useRestoredLayoutWidth())

    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_CARD_MAX_W)
    expect(useLayoutStore.getState().layoutNodeWidth).not.toBe(NODE_LAYOUT_MIN_W)
  })

  it('[saved reload, then edited] does not re-derive when the user grows a restored graph', () => {
    // ⭐ THE CASE THE `layoutVersion` GUARD CANNOT COVER — and the one a mutant
    // found this suite had missed. On a RESTORE nothing ever sets
    // `layoutVersion`: it stays 0 for the whole session, because no layout runs.
    // So for a reloaded model — the common case, and the one this hook exists
    // for — the restore latch is the ONLY thing standing between an ordinary
    // edit and a width change against geometry that has not moved.
    //
    // Six factors restored on the 320 stride. The user adds a seventh. Nothing
    // re-lays out, so the six existing cards are still drawn where they were: a
    // re-derivation to 230 would narrow every card against that stride, which is
    // the same class of harm this hook exists to remove, arriving from the other
    // side.
    const six = restoredGraph(6)
    seed({ nodes: six.nodes, edges: six.edges, currentScenarioId: 'scA' })
    const { rerender } = renderHook(() => useRestoredLayoutWidth())
    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_CARD_MAX_W)

    const seven = restoredGraph(7)
    seed({ nodes: seven.nodes, edges: seven.edges, currentScenarioId: 'scA', layoutVersion: 0 })
    rerender()

    expect(useCanvasStore.getState().layoutVersion).toBe(0)
    expect(useLayoutStore.getState().layoutNodeWidth).toBe(NODE_CARD_MAX_W)
    expect(useLayoutStore.getState().layoutNodeWidth).not.toBe(NODE_LAYOUT_MIN_W)
  })

  // ── DOES NOT FIRE: state class = FRESH DRAFT ─────────────────────────────
  it('[fresh draft] is inert while nodes are stacked at the origin', () => {
    // A freshly drafted graph arrives at {0,0} and its layout is on its way.
    // `applyLayout` owns the width here; pre-empting it would be this hook
    // reaching into the path it must not touch.
    const nodes = ['d1', 'o1', 'o2', 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((id) =>
      n(id, id.startsWith('f') ? 'factor' : 'option', 0, 0),
    )
    seed({ nodes })

    renderHook(() => useRestoredLayoutWidth())

    expect(useLayoutStore.getState().layoutNodeWidth).toBeNull()
  })

  it('[fresh draft] is inert while a layout is pending or in progress', () => {
    const { nodes, edges } = restoredGraph(7)
    for (const phase of [{ pendingLayout: true }, { layoutInProgress: true }]) {
      act(() => {
        useLayoutStore.setState({ layoutNodeWidth: null } as never)
      })
      seed({ nodes, edges, ...phase })
      renderHook(() => useRestoredLayoutWidth())
      expect(useLayoutStore.getState().layoutNodeWidth).toBeNull()
    }
  })

  it('is inert on an empty canvas', () => {
    seed({ nodes: [] })
    renderHook(() => useRestoredLayoutWidth())
    expect(useLayoutStore.getState().layoutNodeWidth).toBeNull()
  })

  // ── The persisted layout options are real inputs, not decoration ──────────
  it('[saved reload] honours the persisted direction', () => {
    // A 4-wide tier is the single-row branch under DOWN but the clamped branch
    // under RIGHT — so the persisted direction changes the answer, and a hook
    // that ignored it would be wrong for every non-DOWN user.
    const { nodes, edges } = restoredGraph(4)
    act(() => {
      useLayoutStore.setState({ direction: 'RIGHT' } as never)
    })
    seed({ nodes, edges, currentScenarioId: 'scC' })

    renderHook(() => useRestoredLayoutWidth())

    const width = useLayoutStore.getState().layoutNodeWidth
    expect(width).not.toBeNull()
    expect(width).not.toBe(NODE_CARD_MAX_W)
    expect(width).toBeGreaterThan(NODE_LAYOUT_MIN_W)
  })
})
