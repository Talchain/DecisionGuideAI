/**
 * THE RESTORE TRIGGER — the camera must be aimed at a graph that arrives
 * WITHOUT a layout pass (UX gate point 7, 2026-08-19/20).
 *
 * THE DEFECT THIS PINS — stated narrowly, because the first version of this
 * paragraph was WIDER THAN THE EVIDENCE AND WAS REFUTED (20 Aug 2026).
 *
 * ⚠ NOT the defect: "the viewport controls are inert after a reload" (refuted
 * by two independent lanes) and "the restore never re-fits" (refuted — xyflow's
 * own `fitView` PROP fits at every mount, so arriving at a different window
 * size genuinely does give a different frame; measured 0.6667 / 0.7509 / 0.8187
 * at 1280 / 1440 / 1512 on the frozen base). Do not repeat either claim.
 *
 * THE DEFECT: on a restored graph the PRODUCT's own fit never runs, so no
 * arrival carries `computeFitPadding`'s reservations — no header-banner inset,
 * no dock, no sidebar — because `computeFitPadding` is only ever reached
 * through the fit owner. Measured headed, real Chromium, on the frozen base
 * `2b6ec553`, reloading AT each size: the Decision node sits behind the
 * floating header banner at **1280x800**, the smallest desktop this product
 * commits to, while the FRESH path at that same size is clean. A second, lesser
 * consequence: the frame does not follow a window RESIZE on a restored graph.
 *
 * THE MECHANISM, derived at the bytes and reproduced:
 *   - every restore path ends at `hydrateGraphSlice` (`store.ts:5954`) or
 *     `loadScenario` (`store.ts:4233`) — the guest-autosave branch
 *     (`ReactFlowGraph.tsx:1545`), the scenario branch (`:1644`) and the DEV
 *     fall-through (`:1685`);
 *   - NONE of them sets `pendingLayout` or bumps `layoutVersion`, because a
 *     restored graph already has real positions and must not be re-laid-out;
 *   - `useInitialLayoutGuard` is the only safety net and it is gated on
 *     `graphNeedsInitialLayout` — deliberately inert on a correctly-positioned
 *     graph;
 *   - so `layoutVersion` stays `0` for the whole page session, and BOTH of the
 *     fit owner's triggers were latched off by it.
 *
 * `layoutVersion === 0` was doing two different jobs under one name (trap 21).
 * On the layout trigger it means "this effect run is the mount, not a layout
 * completion" — correct, and unchanged. On the reserved-box trigger it was
 * standing in for "there is nothing to fit" — and that proxy is FALSE for a
 * restored graph, which is the whole defect.
 *
 * WHAT THIS SPEC CAN AND CANNOT PROVE. jsdom cannot prove a rendered transform
 * (CLAUDE.md trap 3), so this binds to the postcondition the fit OWNER is
 * responsible for: that `fitView` is CALLED, with the canonical contract, for
 * the restored graph's own node ids. The pixel postcondition — that the
 * transform DIFFERS across window sizes after a reload, and that no model node
 * lands off-screen or behind the banner — is real Chromium and is pinned in
 * `e2e/geometry/viewportRestoreFit.measure.ts`. ⚠ That file is NOT in `Staging
 * Gate` (the gate is tsc / typecheck-selftest / vitest / vitest-summary /
 * build — no Playwright job), so it must be run deliberately.
 *
 * Every positive case below has its OPPOSITE-DIRECTION TWIN (trap 22b): an
 * empty canvas and a graph still awaiting its first layout must NOT be fitted,
 * or the fix would trade "never aims" for "aims at a pile at the origin".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'
import { GHOST_OPTION_NODE_ID } from '../utils/fitTargets'
import { STACKED_SPREAD_PX, getGraphIdentityKey } from '../utils/graphNeedsInitialLayout'

/**
 * The restore payload type, DERIVED from `hydrateGraphSlice` itself rather than
 * re-spelled here — a hand-written `Edge[]` was already one drift away from the
 * store's `Edge<EdgeData>[]` (CLAUDE.md trap 12).
 */
type HydrateArg = Parameters<ReturnType<typeof useCanvasStore.getState>['hydrateGraphSlice']>[0]
type RestoreGraph = {
  nodes: NonNullable<HydrateArg['nodes']>
  edges: NonNullable<HydrateArg['edges']>
}

const fitViewSpy = vi.fn()

/** Collect RAF callbacks so each trigger's frame can be flushed deliberately. */
function spyOnRaf(sink: Array<() => void>) {
  return vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      sink.push(cb as () => void)
      return sink.length
    })
}

const FIT_PADDING = { top: '73px', right: '68px', bottom: '29px', left: '68px' }
let currentPadding: { top: string; right: string; bottom: string; left: string } = FIT_PADDING
/** What the mocked ReactFlow instance reports for `getNodes()`. */
let currentNodes: Array<{ id: string }> = []

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView: fitViewSpy, getNodes: () => currentNodes }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => currentPadding,
}))

/**
 * A RESTORED graph: real ELK-style positions, spread well beyond
 * `STACKED_SPREAD_PX`, exactly as `hydrateGraphSlice` receives it from the
 * autosave slot. The ghost placeholder rides along because the live canvas
 * carries one and the fit must exclude it (`utils/fitTargets.ts`).
 */
function restoredGraph(): RestoreGraph {
  const nodes = [
    { id: 'n-decision', type: 'decision', position: { x: 400, y: 0 }, data: { label: 'Pick a vendor' } },
    { id: 'n-option-a', type: 'option', position: { x: 120, y: 260 }, data: { label: 'Vendor A' } },
    { id: 'n-option-b', type: 'option', position: { x: 680, y: 260 }, data: { label: 'Vendor B' } },
    { id: 'n-goal', type: 'goal', position: { x: 400, y: 540 }, data: { label: 'Lower total cost' } },
    { id: GHOST_OPTION_NODE_ID, type: 'option', position: { x: 940, y: 260 }, data: { label: 'Add an option' } },
  ] as unknown as RestoreGraph['nodes']
  const edges = [
    { id: 'e-1', source: 'n-decision', target: 'n-option-a' },
    { id: 'e-2', source: 'n-decision', target: 'n-option-b' },
    { id: 'e-3', source: 'n-option-a', target: 'n-goal' },
  ] as unknown as RestoreGraph['edges']
  return { nodes, edges }
}

/** The SAME graph as a fresh draft would arrive: every node stacked at the origin. */
function stackedGraph(): RestoreGraph {
  const { nodes, edges } = restoredGraph()
  return {
    nodes: nodes.map((n, i) => ({ ...n, position: { x: i, y: i } })) as RestoreGraph['nodes'],
    edges,
  }
}

/** Drive the PRODUCT's own restore entry point, not a hand-written `setState`. */
function restore(graph: RestoreGraph) {
  currentNodes = graph.nodes.map((n) => ({ id: n.id }))
  useCanvasStore.getState().hydrateGraphSlice({ nodes: graph.nodes, edges: graph.edges })
}

describe('useFitViewOnLayoutVersion — the restore trigger', () => {
  let rafCallbacks: Array<() => void>
  let rafSpy: ReturnType<typeof spyOnRaf>

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ layoutVersion: 0, pendingLayout: false, layoutInProgress: false } as never)
    fitViewSpy.mockReset()
    currentPadding = FIT_PADDING
    currentNodes = []
    rafCallbacks = []
    rafSpy = spyOnRaf(rafCallbacks)
  })

  afterEach(() => {
    rafSpy.mockRestore()
    vi.restoreAllMocks()
  })

  const flushFrames = () => act(() => { rafCallbacks.splice(0).forEach((cb) => cb()) })

  it('aims the camera at a graph restored WITHOUT a layout pass, with the canonical contract', () => {
    renderHook(() => useFitViewOnLayoutVersion())
    expect(fitViewSpy, 'nothing to fit on an empty canvas at mount').not.toHaveBeenCalled()

    const graph = restoredGraph()
    act(() => { restore(graph) })
    flushFrames()

    // PIN THE PRECONDITION IN-TEST (trap 13b): if a layout had run, this fit
    // would be the layout trigger's and the test would prove nothing about the
    // restore path. Assert the state that makes the restore trigger the only
    // possible author of the call.
    const s = useCanvasStore.getState()
    expect(s.layoutVersion, 'a layout ran — this is no longer the restore state class').toBe(0)
    expect(s.pendingLayout, 'a layout is pending — the restored graph is not the quiescent restore state').toBe(false)
    expect(s.layoutInProgress).toBe(false)
    expect(s.nodes.map((n) => n.id)).toEqual(graph.nodes.map((n) => n.id))

    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    const args = fitViewSpy.mock.calls[0][0]
    // BIND BY IDENTITY (trap 19): the exact restored MODEL node ids, ghost
    // excluded — not "some non-empty node array" that any other graph satisfies.
    expect(args.nodes.map((n: { id: string }) => n.id)).toEqual([
      'n-decision', 'n-option-a', 'n-option-b', 'n-goal',
    ])
    // ONE contract, shared with the layout trigger and the reserved-box trigger.
    expect(args.padding).toEqual(FIT_PADDING)
    expect(args.minZoom).toBe(LABEL_LEGIBLE_ZOOM)
    expect(args.duration).toBe(400)
  })

  it('re-fits a RESTORED graph when the window changes size, though no layout has ever run', () => {
    // The half the UX gate measured directly: the transform was byte-identical
    // at 1280 / 1440 / 1512 because the reserved-box trigger was latched off by
    // `layoutVersion === 0` just like the load fit.
    renderHook(() => useFitViewOnLayoutVersion())
    act(() => { restore(restoredGraph()) })
    flushFrames()
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    const loadFit = fitViewSpy.mock.calls[0][0]

    // The window grows: the reserved box changes.
    currentPadding = { top: '73px', right: '68px', bottom: '33px', left: '68px' }
    act(() => { window.dispatchEvent(new Event('resize')) })
    flushFrames()

    expect(useCanvasStore.getState().layoutVersion, 'still the restore state class').toBe(0)
    expect(fitViewSpy).toHaveBeenCalledTimes(2)
    const refit = fitViewSpy.mock.calls[1][0]
    // ONE contract: only the measured padding may differ between triggers.
    expect(refit.padding).toEqual(currentPadding)
    expect(refit.minZoom).toBe(loadFit.minZoom)
    expect(refit.duration).toBe(loadFit.duration)
    expect(refit.nodes.map((n: { id: string }) => n.id)).toEqual(
      loadFit.nodes.map((n: { id: string }) => n.id),
    )
  })

  it('aims once per restored graph — a user dragging a node does not yank the camera', () => {
    // ⚠ THIS TEST WAS REWRITTEN BECAUSE ITS FIRST VERSION WAS A TAUTOLOGY, and
    // the mutant kit is the only reason that was noticed (trap 13c: a SURVIVOR
    // is a claim, not a pass). It changed `isDirty`, which is in none of the
    // restore effect's dependencies — so the effect never re-ran, the
    // once-per-identity check was never REACHED, and deleting that check left
    // the test GREEN. A guard the suite cannot see is a guard that is not there.
    //
    // A user DRAG is the case that matters and the case that discriminates: it
    // produces a NEW `nodes` array (so the effect re-runs) with the SAME
    // structural identity (so only the identity check can stop the re-fit).
    // Without it, every drag on a restored graph would re-frame the canvas
    // under the user's hand.
    renderHook(() => useFitViewOnLayoutVersion())
    act(() => { restore(restoredGraph()) })
    flushFrames()
    expect(fitViewSpy).toHaveBeenCalledTimes(1)

    const before = useCanvasStore.getState()
    const keyBefore = getGraphIdentityKey(before.currentScenarioId, before.nodes, before.edges)

    act(() => {
      useCanvasStore.setState((s) => ({
        nodes: s.nodes.map((n) => (n.id === 'n-option-a' ? { ...n, position: { x: 240, y: 300 } } : n)),
      }) as never)
    })

    // PIN THE PRECONDITION (trap 13b): the effect must actually have re-run —
    // a fresh `nodes` reference — and the identity must be UNCHANGED, or this
    // test is passing for a reason that has nothing to do with the guard.
    const after = useCanvasStore.getState()
    expect(after.nodes, 'the drag did not produce a new nodes array — the effect never re-ran').not.toBe(before.nodes)
    expect(
      getGraphIdentityKey(after.currentScenarioId, after.nodes, after.edges),
      'the drag changed the graph IDENTITY — then a re-fit would be correct and this proves nothing',
    ).toBe(keyBefore)

    flushFrames()
    expect(fitViewSpy, 'the camera was yanked by a user drag on a restored graph').toHaveBeenCalledTimes(1)
  })

  /* ── OPPOSITE-DIRECTION TWINS (trap 22b) ──────────────────────────────── */

  it('does NOT aim at an empty canvas', () => {
    renderHook(() => useFitViewOnLayoutVersion())
    act(() => { restore({ nodes: [], edges: [] }) })
    flushFrames()
    expect(fitViewSpy).not.toHaveBeenCalled()
  })

  it('does NOT aim at a canvas holding only the ghost placeholder', () => {
    renderHook(() => useFitViewOnLayoutVersion())
    const ghostOnly = {
      nodes: [{ id: GHOST_OPTION_NODE_ID, type: 'option', position: { x: 940, y: 260 }, data: { label: 'Add an option' } }] as unknown as RestoreGraph['nodes'],
      edges: [] as unknown as RestoreGraph['edges'],
    }
    act(() => { restore(ghostOnly) })
    flushFrames()
    expect(fitViewSpy, 'the ghost is not part of the user model — there is nothing to frame').not.toHaveBeenCalled()
  })

  it('does NOT aim at a graph still awaiting its FIRST layout — the layout trigger owns that fit', () => {
    // A fresh draft arrives stacked at the origin. Aiming here would frame a
    // pile, and the layout that is already coming will aim it correctly.
    const stacked = stackedGraph()
    const spread = Math.max(...stacked.nodes.map((n) => n.position.x)) - Math.min(...stacked.nodes.map((n) => n.position.x))
    expect(spread, 'fixture is not actually stacked — this twin would prove nothing').toBeLessThan(STACKED_SPREAD_PX)

    renderHook(() => useFitViewOnLayoutVersion())
    act(() => { restore(stacked) })
    flushFrames()
    expect(fitViewSpy).not.toHaveBeenCalled()

    // …and the layout trigger still does its job when the layout lands.
    act(() => { useCanvasStore.setState({ layoutVersion: 1 } as never) })
    flushFrames()
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
  })

  it('does NOT aim while a layout is pending or in progress', () => {
    renderHook(() => useFitViewOnLayoutVersion())
    act(() => {
      restore(restoredGraph())
      useCanvasStore.setState({ pendingLayout: true } as never)
    })
    flushFrames()
    expect(fitViewSpy, 'a fit landed mid-layout — the positions are about to move').not.toHaveBeenCalled()
  })
})
