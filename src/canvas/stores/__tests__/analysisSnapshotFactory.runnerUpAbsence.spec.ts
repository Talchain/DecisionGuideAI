/**
 * analysisSnapshotFactory — an unmeasured runner-up win probability is null
 * (ROADMAP 2.834).
 *
 * `runnerUpProbability` had TWO absence paths and only one was honest:
 *
 *   runnerUp ? Math.round((runnerUp.win_probability ?? 0) * 100) : null
 *              └── honest: no runner-up at all ⇒ null ───────────┘
 *                         └── FABRICATION: a runner-up EXISTS but the
 *                             producer sent no win_probability ⇒ 0
 *
 * The second path publishes a confident "0%" for an option the engine simply
 * did not score, and the snapshot is a PERSISTENCE surface — the false value
 * outlives the run that produced it and is replayed on the compare tab for
 * every later session.
 *
 * ⚠ WHY `parseAnalysisEnrichment` DOES NOT ALREADY COVER THIS.
 * That guard rejects an envelope whose `option_comparison` / `factor_sensitivity`
 * is missing or empty, and explicitly leaves every other producer field
 * absence-preserving. An envelope carrying TWO option entries, one of which
 * omits `win_probability`, is fully ADMITTED by it. Every fixture below is
 * such an envelope, so these tests exercise the branch the guard misses rather
 * than re-proving the guard.
 *
 * ⭐ THAT SCOPE NOTE IS NOW CLOSED (ROADMAP 2.835). It read: "OUT OF SCOPE,
 * DELIBERATELY: `winnerProbability` keeps its `?? 0` … consumed ARITHMETICALLY
 * by `deriveCompareState`, so making it nullable would change which hero copy
 * fires — a product judgement, not a mechanical honesty swap."
 *
 * The judgement was made, and the answer was not "make it nullable": the field
 * was DELETED along with `winnerLabel`, because the surfaces reading it were
 * asking a client-side argmax a question `leaderVerdict` already answers. The
 * arithmetic that forced the `?? 0` is gone with it.
 *
 * ⚠ NARROWED 2026-10-07 — THE COMPARE CONSUMER WAS DELETED, NOT EXCUSED. The `deriveCompareState`
 * re-introduction guard is gone with the state machine it guarded.
 * The pre-v3 Compare body (`CompareTabBody` and everything only it reached) was
 * deleted with zero production importers; the live tab (`CompareRunPairBody`)
 * reads CEE's `run_delta`, not these snapshots. The factory assertions stand.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

const nodes: Node[] = [
  { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
]
const edges: Edge[] = []

/**
 * Two options, so `runnerUp` is non-null and the fabricating branch is the one
 * under test. `factor_sensitivity` is non-empty so the envelope is one
 * `parseAnalysisEnrichment` ADMITS.
 */
function build(optionOverrides: Array<Record<string, unknown>>) {
  return buildAnalysisSnapshot({
    rawV2Response: {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'unavailable',
      drivers_status: 'unavailable',
      option_comparison: optionOverrides,
      factor_sensitivity: [{ node_id: 'n1', elasticity: 0.4 }],
      critiques: [],
      response_hash: 'resp-1',
    } as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges,
    runNumber: 1,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

describe('buildAnalysisSnapshot — runner-up win probability absence', () => {
  it('runner-up EXISTS but win_probability absent → null, NOT 0', () => {
    const snap = build([
      { option_id: 'opt-1', option_label: 'Option A', win_probability: 0.6 },
      { option_id: 'opt-2', option_label: 'Option B' },
    ])

    // Bind by IDENTITY: this is the runner-up the factory actually chose.
    expect(snap.runnerUpId).toBe('opt-2')
    expect(snap.runnerUpProbability).toBeNull()
    expect(snap.runnerUpProbability).not.toBe(0)
  })

  it('an HONEST zero win_probability is preserved as 0', () => {
    // The engine measured this option at 0% — a real fact, not an absence.
    const snap = build([
      { option_id: 'opt-1', option_label: 'Option A', win_probability: 0.6 },
      { option_id: 'opt-2', option_label: 'Option B', win_probability: 0 },
    ])

    expect(snap.runnerUpId).toBe('opt-2')
    expect(snap.runnerUpProbability).toBe(0)
  })

  it('no runner-up at all → still null (the pre-existing honest path)', () => {
    const snap = build([
      { option_id: 'opt-1', option_label: 'Option A', win_probability: 0.6 },
    ])

    expect(snap.runnerUpId).toBeNull()
    expect(snap.runnerUpProbability).toBeNull()
  })

  it('a present win_probability is still rounded to a percentage', () => {
    const snap = build([
      { option_id: 'opt-1', option_label: 'Option A', win_probability: 0.62 },
      { option_id: 'opt-2', option_label: 'Option B', win_probability: 0.31 },
    ])

    expect(snap.runnerUpProbability).toBe(31)
  })
})
