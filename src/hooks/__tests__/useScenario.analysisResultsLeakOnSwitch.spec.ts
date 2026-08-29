/**
 * A SCENARIO SWITCH MUST NOT LEAVE THE PREVIOUS SCENARIO'S ANALYSIS ON SCREEN.
 *
 * The defect, on the SUPABASE switch path (`useScenario.loadScenario`):
 *
 *   Analyse scenario A → switch to a scenario B that has never been analysed
 *   → **A's report is still displayed, under B's name.**
 *
 * Mechanism at the pre-fix HEAD. `useScenario.loadScenario` clears exactly two
 * analysis fields on every load — `analysisStateReady` and `rawV2Response` —
 * and nothing else. The `results` slice, which is what every report surface
 * actually reads (`OutputsDock`, `hasReport` in `applyScenarioAnalysisRead`,
 * and `autosaveProjection`, which PERSISTS it), is only ever written by the
 * overlay below that setState:
 *
 *     if (row.analysis_status === 'ready' && row.analysis != null) { … }
 *
 * A never-analysed B has `analysis_status: 'none'`, so the overlay does not
 * fire, nothing resets `results`, and A's completed report survives the switch
 * intact — status `complete`, progress 100, A's `hash`, A's numbers.
 *
 * This is not a cosmetic leak. The surface displays a confident, complete,
 * *wrong* analysis attributed to the scenario the user just opened, and the
 * autosave projection can write it into B's slot.
 *
 * ── WHY THE FIX IS NOT `DECISION_CONTEXT_CLEAR` ──────────────────────────────
 * `hydrateGraphSlice` spreads that set on EVERY hydration carrying nodes/edges
 * — including the non-switch boot restores (`ReactFlowGraph`'s autosave and
 * `loadState` paths). Adding `results` there would wipe a freshly computed
 * analysis on reload: the same silent wrongness in the opposite direction.
 * The clear belongs at the two genuine SWITCH boundaries only. The twin test
 * below is what holds that line.
 *
 * ── BINDING ──────────────────────────────────────────────────────────────────
 * Every assertion binds to its scenario by IDENTITY (the response hash carried
 * in that scenario's own row), never by a value predicate another scenario's
 * report could satisfy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ⚠ MUST STAY ABOVE the imports of the code under test — the `vi.mock`
// factories close over this harness. See the harness header.
import {
  HARNESS_NODES,
  supabaseMockModule,
  authMockModule,
  routerMockModule,
  resetScenarioHarness,
  setScenarioRow,
  scenarioRow,
} from '../../test/helpers/useScenarioSupabaseHarness'

vi.mock('../../lib/supabase', () => supabaseMockModule())
vi.mock('react-router-dom', () => routerMockModule())
vi.mock('../../contexts/AuthContext', () => authMockModule())

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'

// ---------------------------------------------------------------------------
// Fixtures — one analysed scenario per identity, distinguishable by hash
// ---------------------------------------------------------------------------

/**
 * A minimal-but-VALID V2RunResponse. `hydrateAnalysisFromV2Response` validates
 * the shape at the persistence boundary and returns null on a malformed one —
 * a fixture that failed that check would make every assertion below vacuous
 * (the results slice would never be populated at all), so the preconditions in
 * each test assert the hydration actually landed.
 */
function analysisFor(optionLabel: string, responseHash: string) {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'unavailable',
    drivers_status: 'unavailable',
    option_comparison: [
      {
        option_id: `opt-${responseHash}`,
        option_label: optionLabel,
        confidence_interval: [0.3, 0.7],
      },
    ],
    critiques: [],
    response_hash: responseHash,
  }
}

function provenanceFor(responseHash: string, seed: number) {
  return {
    graph_hash: `graph-${responseHash}`,
    seed_used: seed,
    response_hash: responseHash,
    analysed_at: '2026-08-29T10:00:00Z',
  }
}

/** A scenario row that HAS a completed analysis, identified by `responseHash`. */
function analysedRow(id: string, optionLabel: string, responseHash: string, seed: number) {
  return scenarioRow(
    id,
    { nodes: HARNESS_NODES, edges: [] },
    {
      analysis_status: 'ready',
      analysis: analysisFor(optionLabel, responseHash),
      analysis_provenance: provenanceFor(responseHash, seed),
    },
  )
}

/** A scenario row that has NEVER been analysed — the harness default. */
function neverAnalysedRow(id: string) {
  return scenarioRow(id, { nodes: HARNESS_NODES, edges: [] })
}

const A_HASH = 'resp-hash-scenario-A'
const C_HASH = 'resp-hash-scenario-C'

beforeEach(() => {
  vi.clearAllMocks()
  // Re-arms the spies, including the `PGRST116` "no rows" arm. Must run AFTER
  // clearAllMocks, which strips the implementations.
  resetScenarioHarness()
  useCanvasStore.getState().reset()
})

// ---------------------------------------------------------------------------
// THE LEAK — A (analysed) → B (never analysed) must CLEAR
// ---------------------------------------------------------------------------

describe("a switch to a never-analysed scenario does not leave the previous scenario's report on screen", () => {
  it('clears the results slice when the newly loaded scenario has no analysis', async () => {
    setScenarioRow('scenario-A', analysedRow('scenario-A', 'Option A', A_HASH, 42))
    setScenarioRow('scenario-B', neverAnalysedRow('scenario-B'))

    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })

    // PRECONDITION, bound by identity. Without this the clear below could pass
    // against a report that was never there — the fixture failing validation
    // would look exactly like a working fix.
    const afterA = useCanvasStore.getState().results
    expect(afterA.status).toBe('complete')
    expect(afterA.hash).toBe(A_HASH)
    expect(afterA.report).not.toBeNull()

    await act(async () => {
      await result.current.loadScenario('scenario-B')
    })

    // THE DEFECT: at the pre-fix HEAD this is still A's completed report,
    // displayed under B.
    const afterB = useCanvasStore.getState().results
    expect(afterB.status).toBe('idle')
    expect(afterB.report ?? null).toBeNull()
    // Bound by IDENTITY: B must not be showing anything stamped with A's run.
    expect(afterB.hash).not.toBe(A_HASH)
  })

  it("clears the previous scenario's delta baseline on the same switch", async () => {
    setScenarioRow('scenario-A', analysedRow('scenario-A', 'Option A', A_HASH, 42))
    setScenarioRow('scenario-B', neverAnalysedRow('scenario-B'))

    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })

    // A delta baseline belonging to A. `previousReport` is what the surfaces
    // diff a new run against; carrying it onto B would caption B's first run
    // with movement measured from a different decision entirely.
    //
    // The option key carries A's identity, so the assertion below cannot be
    // satisfied by any other scenario's baseline.
    useCanvasStore.setState({
      previousReport: {
        options: { [`opt-${A_HASH}`]: { winProbability: 0.61, outcomeMean: 1234 } },
        rankingStability: 0.9,
      },
    })
    expect(useCanvasStore.getState().previousReport?.options).toHaveProperty(
      `opt-${A_HASH}`,
    )

    await act(async () => {
      await result.current.loadScenario('scenario-B')
    })

    expect(useCanvasStore.getState().previousReport).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// THE OPPOSITE-DIRECTION TWIN — a clear-only fix must not lose a real analysis
// ---------------------------------------------------------------------------

describe('the clear does not destroy the analysis of the scenario being loaded', () => {
  it('installs C’s own report when switching between two analysed scenarios', async () => {
    // Guards against "fixed the leak by always clearing". A clear-only fix
    // passes both tests above and silently loses every real report.
    setScenarioRow('scenario-A', analysedRow('scenario-A', 'Option A', A_HASH, 42))
    setScenarioRow('scenario-C', analysedRow('scenario-C', 'Option C', C_HASH, 99))

    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })
    expect(useCanvasStore.getState().results.hash).toBe(A_HASH)

    await act(async () => {
      await result.current.loadScenario('scenario-C')
    })

    // Bound by IDENTITY to C specifically — not merely "some report is present",
    // which A's leaked report would also satisfy.
    const afterC = useCanvasStore.getState().results
    expect(afterC.status).toBe('complete')
    expect(afterC.hash).toBe(C_HASH)
    expect(afterC.report).not.toBeNull()
    expect(afterC.seed).toBe(99)
  })

  it('re-loading the SAME analysed scenario still shows its report', async () => {
    // The degenerate switch. A clear placed after the hydration overlay would
    // blank the report a user has just reopened.
    setScenarioRow('scenario-A', analysedRow('scenario-A', 'Option A', A_HASH, 42))

    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })
    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })

    const state = useCanvasStore.getState().results
    expect(state.status).toBe('complete')
    expect(state.hash).toBe(A_HASH)
  })
})
