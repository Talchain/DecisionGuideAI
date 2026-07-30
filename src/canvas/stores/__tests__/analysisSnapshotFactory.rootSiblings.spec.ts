/**
 * analysisSnapshotFactory — conditional_winners / edge_e_values root-wins
 * adoption pins (ROADMAP 2.177; completes the live-capture asymmetry class
 * PR #540 fixed for inference_warnings).
 *
 * `extractConditionalWinners` and `extractEdgeEValues` were the two siblings
 * of the #540 defect: each read ONLY `robustness.*`, while the live wire puts
 * both fields at the response ROOT (773/773 live facts root, 0/773 nested —
 * the same corpus quoted in persistedRunSnapshotFactory's header and the
 * persistedRunFact fixture header). The persisted-rebuild caller compensated
 * via `composeRobustness`'s root→robustness fold, so the SAME Compare surface
 * (deriveTransitions' E-value / conditional-winner lines) was populated for
 * rehydrated snapshots and permanently `[]` for live-captured ones.
 *
 * Pins: a rawV2Response carrying ROOT-slot data produces a populated snapshot
 * (RED before the extractors adopt the root-wins dual read, GREEN after), with
 * the EXACT precedence #540 used (`Array.isArray(root) ? root : nested`).
 *
 * Controls per extractor: legacy nested-only payloads still extract (second
 * arm not dead), and both-absent yields `[]` — the current empty rendering
 * (deriveTransitions returns null eValue / null conditionalWinner on empty).
 *
 * Known, DESIGNED live/persisted divergence pinned at the bottom: the
 * persisted rebuild has no graph (`nodes: null`), so `edgeEValues[].edgeLabel`
 * degrades to raw edge-id parts there while the live path resolves node
 * labels. That is T2b honest absence, not drift — the coherence pin in
 * analysisSnapshotFactory.inferenceWarnings.spec.ts therefore compares label
 * bytes only on ids no node resolves.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import { buildSnapshotFromPersistedRun } from '../persistedRunSnapshotFactory'
import { deriveTransitions } from '../../compare-tab/deriveTransitions'
import { makePersistedRunFactRow } from '../../compare-tab/__tests__/__fixtures__/persistedRunFact'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

const nodes: Node[] = [
  { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
]
const edges: Edge[] = []

function build(rawOverrides: Record<string, unknown>, runNumber = 1) {
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
    runNumber,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

// Live shapes (byte-derived staging fixture, persistedRunFact.ts): items at
// the response ROOT, sibling of `robustness`.
const CW_ROOT = [
  {
    factor_id: 'n1',
    factor_label: 'Factor One',
    split_value: 12,
    high_bucket: { winner_label: 'Option B' },
  },
]
const CW_MAPPED = [
  {
    factorId: 'n1',
    factorLabel: 'Factor One',
    winner: 'Option B',
    condition: 'When Factor One exceeds 12',
  },
]
const EEV_ROOT = [{ edge_id: 'n1->goal', e_value: 1.8 }]

describe('buildAnalysisSnapshot — conditional_winners root-wins dual read (ROADMAP 2.177)', () => {
  it('ROOT-slot conditional_winners reach the snapshot (the live-capture path)', () => {
    const snap = build({ conditional_winners: CW_ROOT })
    expect(snap.conditionalWinners).toEqual(CW_MAPPED)
  })

  it('ROOT wins when both slots are present (same precedence as #540 / composeRobustness)', () => {
    const snap = build({
      conditional_winners: CW_ROOT,
      robustness: {
        conditional_winners: [
          { factor_id: 'nested', factor_label: 'Nested', high_bucket: { winner_label: 'Loses' } },
        ],
      },
    })
    expect(snap.conditionalWinners).toEqual(CW_MAPPED)
  })

  it('LEGACY control: robustness-nested conditional_winners are still read (second arm not dead)', () => {
    const snap = build({ robustness: { conditional_winners: CW_ROOT } })
    expect(snap.conditionalWinners).toEqual(CW_MAPPED)
  })

  it('ABSENCE control: neither slot → [] (no fabrication, current empty state kept)', () => {
    expect(build({}).conditionalWinners).toEqual([])
  })
})

describe('buildAnalysisSnapshot — edge_e_values root-wins dual read (ROADMAP 2.177)', () => {
  it('ROOT-slot edge_e_values reach the snapshot with node labels resolved (the live-capture path)', () => {
    const snap = build({ edge_e_values: EEV_ROOT })
    // Label resolution is the signature aspect the adoption must preserve:
    // `n1` resolves through the caller's nodes to 'A'; `goal` has no node and
    // degrades to its raw id — both behaviours are the pre-existing ones.
    expect(snap.edgeEValues).toEqual([
      { edgeId: 'n1->goal', edgeLabel: 'A → goal', eValue: 1.8 },
    ])
  })

  it('ROOT wins when both slots are present (same precedence as #540 / composeRobustness)', () => {
    const snap = build({
      edge_e_values: EEV_ROOT,
      robustness: { edge_e_values: [{ edge_id: 'nested->loses', e_value: 9.9 }] },
    })
    expect(snap.edgeEValues).toEqual([
      { edgeId: 'n1->goal', edgeLabel: 'A → goal', eValue: 1.8 },
    ])
  })

  it('LEGACY control: robustness-nested edge_e_values are still read (second arm not dead)', () => {
    const snap = build({ robustness: { edge_e_values: EEV_ROOT } })
    expect(snap.edgeEValues).toEqual([
      { edgeId: 'n1->goal', edgeLabel: 'A → goal', eValue: 1.8 },
    ])
  })

  it('ABSENCE control: neither slot → [] (no fabrication, current empty state kept)', () => {
    expect(build({}).edgeEValues).toEqual([])
  })
})

describe('Compare consumer (deriveTransitions) — the surface the asymmetry blanked', () => {
  // Both snapshots share factor n1 with an elasticity change >20%, so n1 is an
  // AFFECTED factor and findConditionalWinner can match CW_ROOT's factor_id.
  const factors = (elasticity: number) => [
    { node_id: 'n1', factor_label: 'Factor One', elasticity, rank_flip_rate: 0.1 },
  ]

  it('POSITIVE control: live-captured root-slot data reaches the transition (was null/null before adoption)', () => {
    const from = build({ factor_sensitivity: factors(0.4) }, 1)
    const to = build(
      {
        factor_sensitivity: factors(0.6),
        conditional_winners: CW_ROOT,
        edge_e_values: EEV_ROOT,
      },
      2,
    )
    const [t] = deriveTransitions([from, to])
    expect(t.eValue).toBe(1.8)
    expect(t.eValueEdge).toBe('A → goal')
    expect(t.conditionalWinner).toBe('When Factor One exceeds 12, Option B takes over')
  })

  it('ABSENCE: both-absent snapshots keep the current empty rendering (null eValue, null winner)', () => {
    const from = build({ factor_sensitivity: factors(0.4) }, 1)
    const to = build({ factor_sensitivity: factors(0.6) }, 2)
    const [t] = deriveTransitions([from, to])
    expect(t.eValue).toBeNull()
    expect(t.eValueEdge).toBeNull()
    expect(t.conditionalWinner).toBeNull()
  })
})

describe('edgeLabel live/persisted divergence — designed absence, not drift', () => {
  it('live resolves node labels; the persisted rebuild (nodes: null) degrades to raw edge-id parts', () => {
    // Same edge bytes down both paths.
    const live = build({ edge_e_values: EEV_ROOT })
    const persisted = buildSnapshotFromPersistedRun({
      row: makePersistedRunFactRow({ edgeEValues: EEV_ROOT }),
      runNumber: 1,
      events: [],
      previousSnapshotTimestamp: null,
    })!

    // Identity where both paths HAVE the inputs…
    expect(persisted.edgeEValues.map(e => ({ edgeId: e.edgeId, eValue: e.eValue })))
      .toEqual(live.edgeEValues.map(e => ({ edgeId: e.edgeId, eValue: e.eValue })))
    // …and honest divergence where only the live path has the graph. A fact
    // stores the analysis, not the model (T2b): no nodes, no labels invented.
    expect(live.edgeEValues[0].edgeLabel).toBe('A → goal')
    expect(persisted.edgeEValues[0].edgeLabel).toBe('n1 → goal')
  })
})
