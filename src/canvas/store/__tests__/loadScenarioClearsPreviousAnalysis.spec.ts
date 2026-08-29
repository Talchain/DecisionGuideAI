/**
 * A SCENARIO SWITCH MUST NOT LEAVE THE PREVIOUS SCENARIO'S ANALYSIS ON SCREEN.
 *
 * This file covers the LOCALSTORAGE switch boundary, `store.loadScenario`. Its
 * Supabase twin is `hooks/__tests__/useScenario.analysisResultsLeakOnSwitch.spec.ts`;
 * the defect was identical on both paths and neither is redundant — they are
 * two different switch mechanisms and a fix to one does not reach the other.
 *
 * Mechanism at the pre-fix HEAD. `loadScenario` replaces the graph, clears the
 * decision context and (`A1`) clears `previousReport` — but never touches the
 * `results` slice. Its only write to `results` is
 *
 *     tryRestoreResultsFromHistory(scenario.last_result_hash, …)
 *
 * which RETURNS EARLY on a falsy hash (`if (!resultHash) return false`) without
 * clearing anything. So switching to a scenario that has never been analysed —
 * no `last_result_hash` — left the PREVIOUS scenario's completed report in the
 * slice, displayed under the newly loaded scenario's name.
 *
 * The same early return fires when the hash is present but the run is no longer
 * in local history (history is capped and per-browser), so a scenario analysed
 * on another machine leaks the same way.
 *
 * ── THE TRAP THIS FILE EXISTS TO HOLD ───────────────────────────────────────
 * The tempting fix is to add `results` to `DECISION_CONTEXT_CLEAR`. That set is
 * spread by `hydrateGraphSlice` on EVERY hydration carrying nodes or edges —
 * including `ReactFlowGraph`'s non-switch boot restores (autosave recovery and
 * the `loadState` fallback), which run on a plain page reload. Clearing
 * `results` there would blank a freshly computed analysis on refresh: the same
 * silent wrongness pointed the other way, and no test in the leak direction
 * could see it. The third test below is the opposite-direction twin that fails
 * if anyone takes that route.
 *
 * Every assertion binds to its scenario by IDENTITY (that scenario's own run
 * hash), never by a predicate another scenario's report could satisfy.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { createScenario } from '../scenarios'
import { saveRuns, type StoredRun } from '../runHistory'
import type { ReportV1 } from '../../../adapters/plot/types'

const LS_KEYS = [
  'olumi-canvas-scenarios',
  'olumi-canvas-autosave',
  'olumi-canvas-current-scenario-id',
  'olumi-canvas-run-history',
]

function aNode(id = 'n1') {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } } as never
}

/** A report stamped with the identity of the run that produced it. */
function reportFor(optionId: string): ReportV1 {
  return {
    option_probabilities: {
      [optionId]: { win_probability: 0.62, outcome_mean: 1000 },
    },
  } as unknown as ReportV1
}

/** Put a completed analysis on screen, stamped with `hash`. */
function putAnalysisOnScreen(hash: string): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      runId: `run-${hash}`,
      hash,
      seed: 7,
      report: reportFor(`opt-${hash}`),
      startedAt: 1,
      finishedAt: 2,
    },
  })
}

function storedRun(hash: string): StoredRun {
  return {
    id: `run-${hash}`,
    ts: 1_700_000_000_000,
    seed: 7,
    hash,
    adapter: 'mock',
    summary: `summary for ${hash}`,
    graphHash: `graph-${hash}`,
    report: reportFor(`opt-${hash}`),
  }
}

const A_HASH = 'hash-of-scenario-A'
const B_HASH = 'hash-of-scenario-B'

beforeEach(() => {
  for (const k of LS_KEYS) localStorage.removeItem(k)
  useCanvasStore.getState().reset()
})

// ---------------------------------------------------------------------------
// THE LEAK
// ---------------------------------------------------------------------------

describe('store.loadScenario — a switch does not carry the previous analysis', () => {
  it("clears results when the loaded scenario has never been analysed", () => {
    const b = createScenario({ name: 'Scenario B', nodes: [aNode('b1')], edges: [] })
    // B is genuinely un-analysed: no last_result_hash, as for any new decision.
    expect(b.last_result_hash).toBeUndefined()

    // A's completed analysis is on screen.
    putAnalysisOnScreen(A_HASH)
    expect(useCanvasStore.getState().results.hash).toBe(A_HASH)

    const loaded = useCanvasStore.getState().loadScenario(b.id)
    // Precondition — the switch actually happened. Without this the clear
    // below could pass because loadScenario bailed out entirely.
    expect(loaded).toBe(true)
    expect(useCanvasStore.getState().currentScenarioId).toBe(b.id)

    // THE DEFECT: at the pre-fix HEAD this is still A's report, under B.
    const after = useCanvasStore.getState().results
    expect(after.status).toBe('idle')
    expect(after.report ?? null).toBeNull()
    expect(after.hash).not.toBe(A_HASH)
  })

  it('clears results when the loaded scenario names a run this browser does not hold', () => {
    // The second reach of the same early return: `last_result_hash` is set, but
    // history has no such run (analysed on another machine, or evicted by the
    // history cap). `tryRestoreResultsFromHistory` returns false and, pre-fix,
    // left the previous scenario's report in place.
    const b = createScenario({
      name: 'Scenario B',
      nodes: [aNode('b1')],
      edges: [],
      last_result_hash: B_HASH,
    })
    saveRuns([]) // history is empty — B's run is not here

    putAnalysisOnScreen(A_HASH)
    expect(useCanvasStore.getState().results.hash).toBe(A_HASH)

    expect(useCanvasStore.getState().loadScenario(b.id)).toBe(true)

    const after = useCanvasStore.getState().results
    expect(after.status).toBe('idle')
    expect(after.hash).not.toBe(A_HASH)
  })
})

// ---------------------------------------------------------------------------
// THE OPPOSITE-DIRECTION TWINS
// ---------------------------------------------------------------------------

describe('store.loadScenario — the clear does not destroy a real analysis', () => {
  it("restores the loaded scenario's OWN run when history holds it", () => {
    // Guards against "fixed the leak by always clearing", which passes both
    // tests above while silently losing every restorable report.
    const b = createScenario({
      name: 'Scenario B',
      nodes: [aNode('b1')],
      edges: [],
      last_result_hash: B_HASH,
    })
    saveRuns([storedRun(B_HASH)])

    putAnalysisOnScreen(A_HASH)

    expect(useCanvasStore.getState().loadScenario(b.id)).toBe(true)

    // Bound by IDENTITY to B's run — "a report is present" would also be
    // satisfied by A's leaked one, which is the defect, not the fix.
    const after = useCanvasStore.getState().results
    expect(after.status).toBe('complete')
    expect(after.hash).toBe(B_HASH)
    expect(after.runId).toBe(`run-${B_HASH}`)
    expect(after.report).not.toBeNull()
  })

  it('a NON-switch hydration does not clear a fresh analysis', () => {
    // ⚠ THE GUARD ON THE WRONG FIX. `hydrateGraphSlice` is the boot/autosave
    // restore path as well as the scenario-load path, and it spreads
    // DECISION_CONTEXT_CLEAR on every call carrying nodes/edges. A clear placed
    // there — rather than at the two switch boundaries — blanks a completed
    // analysis on an ordinary page reload.
    //
    // This is the shape ReactFlowGraph's autosave/loadState restores use:
    // nodes and edges, and NO currentScenarioId (no scenario is being switched
    // to; the same decision is being rehydrated).
    putAnalysisOnScreen(A_HASH)

    useCanvasStore.getState().hydrateGraphSlice({
      nodes: [aNode('restored')],
      edges: [],
    })

    const after = useCanvasStore.getState().results
    expect(after.status).toBe('complete')
    expect(after.hash).toBe(A_HASH)
    expect(after.report).not.toBeNull()
  })
})
