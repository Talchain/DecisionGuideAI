/**
 * ROADMAP 2.1003 / F4 — THE BOOT CALL SITE AND ITS ORDERING.
 *
 * ⚠ WHY THIS FILE EXISTS, and it is the second time this lane learned it:
 * `resolveRestoredFreshnessUpdate` had a complete unit kit — 10/10, with five
 * mutants biting — and **deleting the sole production call site in
 * `ReactFlowGraph.restoreCeeAnalysisReady` fully re-introduced F4 while
 * surviving that spec 10/10 and a sweep of 101 spec files / 1,122 tests, exit
 * 0, zero reds.** Every test called the pure function directly; nothing
 * exercised the one line that makes it reach a user. A perfect unit kit is not
 * evidence that the product calls the unit.
 *
 * These tests drive the REAL boot function against the REAL store, so:
 *   · deleting the re-ingestion block goes RED (call site pinned);
 *   · changing what `resultsLoadHistorical` stamps goes RED (ordering pinned),
 *     because the precondition is produced by CALLING that action rather than
 *     by hand-writing the marker it happens to use today. That coupling is the
 *     thing the code comment calls "load-bearing", and it was pinned by nothing.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'

import { restoreCeeAnalysisReady } from '../ReactFlowGraph'
import { useCanvasStore } from '../store'
import { RESTORED_ATTESTATION_HASHES_ALIGNED } from '../store/analysisFreshness'

const GOAL_ID = 'goal_nrr'
const OPTION_ID = 'opt_onboarding'

const CURRENT_NODES = [
  { id: GOAL_ID, position: { x: 0, y: 0 }, data: {} },
  { id: OPTION_ID, position: { x: 0, y: 0 }, data: {} },
  { id: 'fac_cs_coverage_depth', position: { x: 0, y: 0 }, data: {} },
] as unknown as Node[]

/** An analysis_ready whose attestation says: the graph had not moved. */
function analysisReady(overrides: Record<string, unknown> = {}) {
  return {
    options: [{ id: OPTION_ID, label: 'Onboarding' }],
    goal_node_id: GOAL_ID,
    status: 'ready',
    freshness: 'fresh',
    freshness_reason: 'graph_hash_match',
    graph_hash_at_run: 'b8a38343926af945',
    current_graph_hash: 'b8a38343926af945',
    computed_at: '2026-08-09T12:00:00.000Z',
    ...overrides,
  }
}

function autosaveWith(ready: unknown) {
  return {
    nodes: CURRENT_NODES,
    edges: [],
    ceeAnalysisReady: ready,
  } as never
}

/**
 * Reproduce the boot state the way BOOT reproduces it: by running the real
 * historical-load action. If that action ever stops stamping the marker the
 * re-ingestion keys on, these tests go red — which is the whole point.
 */
function loadHistoricalLikeBootDoes() {
  const { resultsLoadHistorical, reset } = useCanvasStore.getState()
  reset()
  // `reset()` does not clear this slice; blank it explicitly so "readiness was
  // restored" is a fact about THIS call and not a leftover from a sibling test.
  useCanvasStore.setState({ ceeAnalysisReady: null })
  resultsLoadHistorical({
    id: 'run-f4',
    ts: Date.now(),
    seed: 1,
    hash: 'h-f4',
    report: {
      schema: 'report.v1',
      meta: { seed: 1, response_id: 'r-f4', elapsed_ms: 10 },
      model_card: { response_hash: 'h-f4', response_hash_algo: 'sha256', normalized: true },
      results: {},
    },
    drivers: [],
    ceeReview: null,
    ceeTrace: null,
    ceeError: null,
  } as never)
}

describe('F4 — the boot call site re-ingests the attestation', () => {
  beforeEach(() => {
    loadHistoricalLikeBootDoes()
  })

  it('PRECONDITION, derived not asserted: the historical load leaves cannot-confirm', () => {
    // Pinning the ORDERING contract. `restoreCeeAnalysisReady` must run AFTER
    // this, and it only has something to upgrade because this stamped it.
    const s = useCanvasStore.getState().analysisFreshness
    expect(s?.freshness).toBe('unknown')
    expect(s?.freshnessReason).toBe('hydrated_without_capture')
  })

  it('⭐ THE MEASURED CASE: boot restores fresh from a matching attestation', () => {
    restoreCeeAnalysisReady('autosave', autosaveWith(analysisReady()), null, CURRENT_NODES)

    const s = useCanvasStore.getState().analysisFreshness
    expect(s?.freshness).toBe('fresh')
    expect(s?.freshnessReason).toBe(RESTORED_ATTESTATION_HASHES_ALIGNED)
    // The readiness restore itself must still have happened — this test must
    // fail for the freshness reason, not because the whole function no-opped.
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
  })

  it('MISMATCHED hashes: boot leaves cannot-confirm, and still restores readiness', () => {
    restoreCeeAnalysisReady(
      'autosave',
      autosaveWith(analysisReady({ current_graph_hash: '3346784355b3fc7b' })),
      null,
      CURRENT_NODES,
    )

    const s = useCanvasStore.getState().analysisFreshness
    expect(s?.freshness).toBe('unknown')
    expect(s?.freshnessReason).toBe('hydrated_without_capture')
    // The discriminating half: readiness DID restore, so the unknown verdict
    // above is the attestation check refusing — not the function bailing out.
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
  })

  it('a payload that fails node-identity validation upgrades nothing', () => {
    // Goal node absent from the current graph ⇒ validateCeeAnalysisReady
    // rejects ⇒ neither readiness nor freshness may move.
    restoreCeeAnalysisReady(
      'autosave',
      autosaveWith(analysisReady({ goal_node_id: 'goal_that_no_longer_exists' })),
      null,
      CURRENT_NODES,
    )

    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('unknown')
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
  })

  it('no persisted analysis_ready at all: boot changes nothing', () => {
    restoreCeeAnalysisReady('none', null, null, CURRENT_NODES)
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('unknown')
  })

  it('a stored NON-fresh verdict is never upgraded by boot', () => {
    restoreCeeAnalysisReady(
      'autosave',
      autosaveWith(analysisReady({ freshness: 'stale' })),
      null,
      CURRENT_NODES,
    )
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('unknown')
  })
})
