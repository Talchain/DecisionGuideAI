/**
 * Seed the canvas store with a Run that `selectRunAffirmedCurrent` affirms as current.
 *
 * ⚠ WHY THIS EXISTS. Since #2462 (4 Oct 2026) the Reasoning tab passes the producer's flip thresholds to the
 * Challenge signals row only on a current Run (`AnalysisNewTabBody`, the ReasoningSignals mount), so a tipping
 * point from a Run the model has moved past is never stated. Every spec that mounts the tab and reads the tipping
 * row predated that gate and never seeded a current Run, so they went red on staging and stayed red: DGAI PR CI
 * runs no test shards. One helper instead of six inline copies, and it ASSERTS the state it claims to set, so a
 * future change to the selector fails here, loudly, rather than as a missing tipping row three files away.
 *
 * Vitest isolates each test file, so no restore is needed across files. Within a file, a row that needs a
 * non-current Run sets that state itself after this runs.
 */
import { expect } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'

export function seedCurrentRun(): void {
  const results = useCanvasStore.getState().results
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    importPendingServerRegistration: false,
    results: {
      ...results,
      status: 'complete',
      report: { option_probabilities: { opt_a: 0.31, opt_b: 0.69 }, ...(results?.report ?? {}) },
    },
  } as never)
  expect(selectRunAffirmedCurrent(useCanvasStore.getState()), 'seedCurrentRun: the Run must read as current').toBe(true)
}
