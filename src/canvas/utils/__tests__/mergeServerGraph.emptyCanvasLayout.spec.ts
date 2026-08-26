/**
 * ⭐⭐ A FRESH BROWSER GETS A LAID-OUT MODEL, NOT A COLUMN.
 *
 * ── THE DEFECT, DRIVEN AND MEASURED ─────────────────────────────────────────
 * A user reloading a saved scenario with no local autosave — a new device,
 * cleared storage, incognito, or a scenario first opened elsewhere — got all 15
 * nodes in ONE VERTICAL LINE: unique `x` of 260, `y` stepping by exactly 140.
 *
 * ⚠ THIS IS NOT A PERSISTENCE BUG, AND THE FIRST FRAMING OF IT WAS WRONG.
 * `scenarios.graph` carrying no geometry is DELIBERATE and declared at the top
 * of `mergeServerGraph.ts`: "VALUES FROM THE SERVER, LAYOUT FROM LOCAL… The
 * autosave is the only place a position has ever existed." `layout_present:
 * false` on the wire is correct and expected. What went wrong is narrower.
 *
 * ── THE MECHANISM ───────────────────────────────────────────────────────────
 * With an empty canvas every server node is "added", so all of them go through
 * `ADDED_COLUMN_X_GAP` / `ADDED_COLUMN_Y_STEP` — a constant pair whose own
 * comment says it exists to drop "a few added nodes beside an existing bounding
 * box" and "never a re-layout of nodes the user has already arranged". It is
 * being applied to the ONE case it explicitly disclaims. With no existing
 * nodes, `Math.max(...[])` has nothing to take, `baseX` collapses to `0 + 260`,
 * and the whole graph stacks in a single column.
 *
 * ⭐ AND THE PRODUCT CANNOT SEE IT. `graphNeedsInitialLayout` asks
 * `xSpread < 40 && ySpread < 40`; a column has `xSpread` 0 but `ySpread` 1960,
 * so it returns FALSE — no layout is triggered — and `isRestoredModelReady`
 * returns TRUE, so the camera confidently frames the line. Fifteen nodes in a
 * vertical row is not a laid-out graph, but nothing in the product disagrees.
 *
 * ── WHY THE FIX IS HERE AND NOT IN THE PREDICATE ────────────────────────────
 * ⚠ Loosening `graphNeedsInitialLayout` so a column counts as "needs layout"
 * was considered and REJECTED: a user can deliberately arrange nodes in a
 * column, and a geometric predicate cannot tell their column from ours. That
 * fix would destroy real work to repair ours — the current bug wastes a layout,
 * the loosened version deletes an arrangement.
 *
 * ⭐ The predicate asks a GEOMETRIC question when the real one is PROVENANCE:
 * did WE place these, or did the USER arrange them? And that answer is already
 * in hand at the placement site — `store.nodes.length === 0` means there was
 * nothing to preserve. No new flag is recorded, because recording one would be
 * a second source of truth for a fact the site can already see.
 *
 * So the branch below is safe BY CONSTRUCTION: it fires only when the canvas
 * was empty, so there is no arrangement it could damage. `graphNeedsInitialLayout`
 * is untouched, and the origin placement makes it return TRUE on its own terms —
 * the existing measurement effect then runs the real layout, the designed path,
 * unchanged.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
// ⚠ FROM `mergeAppliedGraph`, WHERE THEY ARE DEFINED — `mergeServerGraph` only
// imports them and does not re-export. Taking them from the wrong module gave
// `undefined`, and `new Set([...]).has(undefined)` is FALSE, so the "no column"
// assertion below passed while testing nothing. Caught by its twin, which
// compared against `900 + undefined` and reported NaN. A vacuous pass is the
// exact failure this suite exists to prevent, and it happened in the suite.
import { ADDED_COLUMN_X_GAP, ADDED_COLUMN_Y_STEP } from '../mergeAppliedGraph'
import { graphNeedsInitialLayout } from '../graphNeedsInitialLayout'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

/** The server's copy: analytical state only, no geometry — as CEE really sends it. */
function serverGraph(nodeCount: number) {
  return {
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      kind: i === 0 ? 'goal' : 'factor',
      label: `Node ${i}`,
    })),
    edges: [],
  }
}

function emptyCanvas(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    pendingLayout: false,
    history: { past: [], future: [] },
  } as never)
}

function canvasWithUserArrangement(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'n0', type: 'goal', position: { x: 900, y: 40 }, data: { label: 'Node 0', kind: 'goal' } },
      { id: 'n1', type: 'factor', position: { x: 40, y: 500 }, data: { label: 'Node 1', kind: 'factor' } },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    pendingLayout: false,
    history: { past: [], future: [] },
  } as never)
}

describe('an empty canvas hydrates for LAYOUT, not into a column', () => {
  beforeEach(emptyCanvas)

  it('the precondition holds: the canvas really is empty before the merge', () => {
    // PINNED IN-TEST. Without this a fixture that quietly seeded nodes would
    // make every assertion below agree for the wrong reason.
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })

  it('⭐ does NOT produce the 260-wide column the drive measured', () => {
    // The constants must be REAL numbers or every assertion below is vacuous.
    expect(typeof ADDED_COLUMN_X_GAP).toBe('number')
    expect(typeof ADDED_COLUMN_Y_STEP).toBe('number')
    const res = mergeServerGraphOnHydrate(serverGraph(15))
    expect(res.accepted).toBe(true)

    const nodes = useCanvasStore.getState().nodes as unknown as { position: { x: number; y: number } }[]
    expect(nodes).toHaveLength(15)

    // The witnessed signature, asserted absent: one x, uniform 140 y-steps.
    const xs = new Set(nodes.map((n) => n.position.x))
    expect(xs.has(ADDED_COLUMN_X_GAP), 'nodes are still at the added-column x').toBe(false)
    const ySteps = new Set(
      nodes.slice(1).map((n, i) => n.position.y - nodes[i]!.position.y),
    )
    expect(ySteps.has(ADDED_COLUMN_Y_STEP), 'nodes still step by the added-column y').toBe(false)
  })

  it('⭐ leaves a shape the product RECOGNISES as needing layout, and asks for one', () => {
    // The two halves of the fix, bound to the product's own authority rather
    // than to coordinates: `graphNeedsInitialLayout` is the estate's declared
    // answer to "are these positions meaningful", and `pendingLayout` is the
    // designed request. Neither is re-implemented here.
    mergeServerGraphOnHydrate(serverGraph(15))
    const state = useCanvasStore.getState()
    expect(graphNeedsInitialLayout(state.nodes as never)).toBe(true)
    expect(state.pendingLayout).toBe(true)
  })
})

describe('a canvas the user has arranged is untouched — the guard that makes this safe', () => {
  beforeEach(canvasWithUserArrangement)

  it('⭐ DISCRIMINATING TWIN — added nodes still take the added-column placement', () => {
    // The branch must key on "there was nothing here", NOT on "these nodes have
    // no position". Without this pair the fix above would be satisfied by a
    // change that re-laid-out every hydration — destroying exactly the
    // arrangements `mergeServerGraph`'s header promises never to disturb.
    mergeServerGraphOnHydrate(serverGraph(4))
    const nodes = useCanvasStore.getState().nodes as unknown as {
      id: string
      position: { x: number; y: number }
    }[]
    const added = nodes.filter((n) => n.id !== 'n0' && n.id !== 'n1')
    expect(added.length).toBeGreaterThan(0)
    // Right of the existing bounding box (max x 900), exactly as before.
    for (const n of added) expect(n.position.x).toBe(900 + ADDED_COLUMN_X_GAP)
  })

  it('⭐ and does NOT ask for a layout — the user’s arrangement is not re-run', () => {
    mergeServerGraphOnHydrate(serverGraph(4))
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })

  it('the user’s own two nodes keep their exact coordinates', () => {
    mergeServerGraphOnHydrate(serverGraph(4))
    const nodes = useCanvasStore.getState().nodes as unknown as {
      id: string
      position: { x: number; y: number }
    }[]
    expect(nodes.find((n) => n.id === 'n0')!.position).toEqual({ x: 900, y: 40 })
    expect(nodes.find((n) => n.id === 'n1')!.position).toEqual({ x: 40, y: 500 })
  })
})

/**
 * ⭐⭐ THE LAYOUT REQUEST INVALIDATES ONE ALREADY IN FLIGHT.
 *
 * ⚠ THE HALF THAT WAS SILENTLY MISSING. `setPendingLayout(true)` is
 * `set({ pendingLayout: true, layoutRequestId: get().layoutRequestId + 1 })` —
 * the bump is half of what it does. The hydration wrote only the FIELD, which
 * looked equivalent and was not: the raw write was the ONLY one in `src/`
 * outside the setter's own body, against 7 producers that use the setter.
 *
 * Without the bump, a layout that started BEFORE this hydration still passes
 * `applyLayout`'s post-await commit guard — its generation never moved — and
 * commits its stale snapshot over the graph we just merged. Measured on the
 * unfixed build: `nodeCount: 0, layoutVersion: 1` — AN EMPTY CANVAS REPORTED AS
 * A SUCCESSFUL LAYOUT. The same defect class the rest of this file closes, one
 * line over, and nothing would have gone red when it shipped.
 */
describe('the hydration invalidates a layout already in flight', () => {
  it('⭐ bumps layoutRequestId in the same write as the nodes', () => {
    emptyCanvas()
    const before = useCanvasStore.getState().layoutRequestId
    mergeServerGraphOnHydrate(serverGraph(15))
    const after = useCanvasStore.getState()
    expect(after.layoutRequestId).toBeGreaterThan(before)
    // Both halves, together — a bump without the request, or a request without
    // the bump, are each the defect this pins.
    expect(after.pendingLayout).toBe(true)
  })

  it('⭐ DISCRIMINATING TWIN — a non-empty hydration does NOT bump it', () => {
    // The bump must be as narrowly scoped as the placement branch itself.
    // Bumping on every hydration would invalidate layouts the user's own
    // arranged canvas legitimately has in flight — the same over-wide failure
    // M2 catches for the placement.
    canvasWithUserArrangement()
    const before = useCanvasStore.getState().layoutRequestId
    mergeServerGraphOnHydrate(serverGraph(4))
    expect(useCanvasStore.getState().layoutRequestId).toBe(before)
  })
})
