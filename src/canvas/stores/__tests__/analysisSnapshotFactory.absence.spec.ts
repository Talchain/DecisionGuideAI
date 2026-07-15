/**
 * analysisSnapshotFactory — absence preservation (T2b).
 *
 * The snapshot is a PERSISTENCE surface (it feeds the compare tab across
 * runs), so a fabrication here has the same reload-resurrection property as
 * the Supabase provenance leg: the false value outlives the run that produced
 * it.
 *
 * Three `?? 0` fabrications lived here, all of the T2 class — a default that
 * makes a fail-closed guard pass:
 *
 *   :239  robustness?.recommendation_stability ?? 0
 *   :271  fragileEdgeCount: robustness?.fragile_edges?.length ?? 0
 *   :250  seed_used != null ? Number(...) : 0
 *
 * The fragile_edges one is the sharpest: PR #326 made the mapper's
 * fragile_edges/robust_edges ABSENCE-PRESERVING so AdvancedSection honestly
 * HIDES the row when the producer sent nothing — but this factory re-fabricated
 * a 0 into the snapshot. Same run, same fact, two surfaces: AdvancedSection
 * said "unknown", the compare tab said "0 fragile". That cross-surface
 * incoherence is exactly what #322 was merged to prevent.
 *
 * The stability one fabricated a VERDICT, not just a number:
 * deriveStabilityLabel(0) returns 'fragile', so a producer that sent no
 * robustness data at all made the compare tab assert "Model fragile".
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

function build(rawOverrides: Record<string, unknown>) {
  return buildAnalysisSnapshot({
    rawV2Response: {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'unavailable',
      drivers_status: 'unavailable',
      option_comparison: [
        {
          option_id: 'opt-1',
          option_label: 'Option A',
          win_probability: 0.6,
          confidence_interval: [0.3, 0.7],
          expected_outcome: 0.5,
        },
      ],
      critiques: [],
      response_hash: 'resp-1',
      ...rawOverrides,
    } as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges,
    runNumber: 1,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

describe('buildAnalysisSnapshot — recommendation_stability absence', () => {
  it('robustness absent → stability is null, NOT 0', () => {
    const snap = build({})
    expect(snap.recommendationStability).toBeNull()
    expect(snap.recommendationStability).not.toBe(0)
  })

  it('robustness absent → no fabricated "fragile" verdict', () => {
    // deriveStabilityLabel(0) === 'fragile'. A missing producer field must not
    // become an assertion that the model is fragile.
    const snap = build({})
    expect(snap.stabilityLabel).toBeNull()
    expect(snap.stabilityLabel).not.toBe('fragile')
  })

  it('recommendation_stability present but null → still null, not 0', () => {
    const snap = build({ robustness: { recommendation_stability: null } })
    expect(snap.recommendationStability).toBeNull()
  })

  it('an honest 0 stability is preserved and still labelled', () => {
    const snap = build({ robustness: { recommendation_stability: 0 } })
    expect(snap.recommendationStability).toBe(0)
    expect(snap.stabilityLabel).toBe('fragile')
  })

  it('a real stability value maps through', () => {
    const snap = build({ robustness: { recommendation_stability: 0.85 } })
    expect(snap.recommendationStability).toBe(0.85)
    expect(snap.stabilityLabel).toBe('stable')
  })
})

describe('buildAnalysisSnapshot — fragile_edges absence (cross-surface coherence with #326)', () => {
  it('fragile_edges absent → fragileEdgeCount is null, NOT 0', () => {
    const snap = build({ robustness: { recommendation_stability: 0.5 } })
    expect(snap.fragileEdgeCount).toBeNull()
    expect(snap.fragileEdgeCount).not.toBe(0)
  })

  it('robustness entirely absent → fragileEdgeCount is null', () => {
    const snap = build({})
    expect(snap.fragileEdgeCount).toBeNull()
  })

  it('fragile_edges: [] is an honest 0 → preserved as 0, not null', () => {
    // The producer measured and found none. That is a real fact and must show.
    const snap = build({ robustness: { recommendation_stability: 0.5, fragile_edges: [] } })
    expect(snap.fragileEdgeCount).toBe(0)
  })

  it('fragile_edges with entries → counted', () => {
    const snap = build({
      robustness: { recommendation_stability: 0.5, fragile_edges: ['e1', 'e2'] },
    })
    expect(snap.fragileEdgeCount).toBe(2)
  })
})

describe('buildAnalysisSnapshot — seed absence', () => {
  it('no meta → seedUsed is null, NOT 0', () => {
    const snap = build({})
    expect(snap.seedUsed).toBeNull()
    expect(snap.seedUsed).not.toBe(0)
  })

  it('malformed echo → seedUsed is null, and never NaN', () => {
    // The old code used Number('abc') → NaN, which survives a `!= null` guard
    // and renders as "Seed NaN".
    const snap = build({ meta: { seed_used: 'abc' } })
    expect(snap.seedUsed).toBeNull()
    expect(Number.isNaN(snap.seedUsed as number)).toBe(false)
  })

  it('a real engine seed of 0 is preserved', () => {
    const snap = build({ meta: { seed_used: '0' } })
    expect(snap.seedUsed).toBe(0)
  })

  it('a real seed maps through', () => {
    const snap = build({ meta: { seed_used: '4242' } })
    expect(snap.seedUsed).toBe(4242)
  })
})
