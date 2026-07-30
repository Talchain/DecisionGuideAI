/**
 * analysisSnapshotFactory — inference-warnings root-wins adoption pin
 * (ROADMAP 2.173, Paul-ratified 2026-07-30; evidence:
 * PHASE0-EVIDENCE-2026-07-28/inference-warnings-derivation.md).
 *
 * `extractInferenceWarnings` was one of the two STOPPED readers recorded in
 * `readInferenceWarnings.ts`: it read ONLY `robustness.inference_warnings`,
 * which is empty on every live run (0/827 measured 2026-07-30), while the
 * real data lives at the response ROOT (419/827 non-empty). The persisted-run
 * rebuild path already compensated (`persistedRunSnapshotFactory`'s
 * `composeRobustness` folds root→robustness before calling the factory), so
 * the SAME Compare surface was populated for rehydrated snapshots and
 * permanently `[]` for live-captured ones — the warnings-resolved/introduced
 * diff compared `[]` to `[]` on every live pair.
 *
 * Pin: a rawV2Response carrying ROOT-slot `inference_warnings` produces a
 * snapshot that carries them, and the Compare diff sees them. RED before the
 * factory adopts the root-wins dual read, GREEN after.
 *
 * Coherence pin: both `buildAnalysisSnapshot` callers (live capture and
 * persisted rebuild) produce the SAME snapshot warnings for the SAME
 * enrichment — including that the rehydrate path's existing fold is not
 * double-applied.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import { buildSnapshotFromPersistedRun } from '../persistedRunSnapshotFactory'
import { deriveRunPairComparison } from '../../compare-tab/deriveRunPairComparison'
import { makePersistedRunFactRow } from '../../compare-tab/__tests__/__fixtures__/persistedRunFact'
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

// Live shape (2026-07-30 probe): objects with code/message/severity at the
// response ROOT. The factory normalises to message-first strings.
const ROOT_ITEMS = [
  { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'info', message: 'Root node defaulted to 0.0' },
  { code: 'CONSTRAINT_TARGET_UNRELIABLE', severity: 'warning', message: 'Target withheld for this run' },
]

describe('buildAnalysisSnapshot — inference_warnings root-wins dual read (ROADMAP 2.173)', () => {
  it('ROOT-slot warnings reach the snapshot (the live-capture path)', () => {
    const snap = build({ inference_warnings: ROOT_ITEMS })
    expect(snap.inferenceWarnings).toEqual([
      'Root node defaulted to 0.0',
      'Target withheld for this run',
    ])
  })

  it('LEGACY control: robustness-nested warnings are still read (second arm not dead)', () => {
    const snap = build({ robustness: { inference_warnings: ['nested warning'] } })
    expect(snap.inferenceWarnings).toEqual(['nested warning'])
  })

  it('ROOT wins when both slots are present (same precedence as composeRobustness)', () => {
    const snap = build({
      inference_warnings: [{ message: 'root wins' }],
      robustness: { inference_warnings: ['nested loses'] },
    })
    expect(snap.inferenceWarnings).toEqual(['root wins'])
  })

  it('ABSENCE control: neither slot → [] (no fabrication, current empty state kept)', () => {
    const snap = build({})
    expect(snap.inferenceWarnings).toEqual([])
  })

  it('Compare diff sees live-captured root warnings (was [] vs [] before adoption)', () => {
    const from = build({ inference_warnings: [{ message: 'resolved later' }] })
    const to = build({ inference_warnings: [{ message: 'introduced now' }] })
    const cmp = deriveRunPairComparison(from, to)
    expect(cmp.warningsResolved).toEqual(['resolved later'])
    expect(cmp.warningsIntroduced).toEqual(['introduced now'])
  })

  it('COHERENCE: live capture and persisted rebuild produce the same warnings for the same enrichment', () => {
    // One enrichment, byte-shaped from the live fact fixture, fed to BOTH
    // buildAnalysisSnapshot callers' input shapes.
    const row = makePersistedRunFactRow({ inferenceWarnings: ROOT_ITEMS })
    const enrichment = (row.payload as any).result.enrichment

    // Live-capture path: store.ts passes the raw response UNFOLDED.
    const live = buildAnalysisSnapshot({
      rawV2Response: enrichment as V2RunResponse,
      report: {} as ReportV1,
      nodes,
      edges,
      runNumber: 1,
      events: [],
      previousSnapshotTimestamp: null,
    })

    // Persisted rebuild path: composeRobustness folds root→robustness first.
    const persisted = buildSnapshotFromPersistedRun({
      row,
      runNumber: 1,
      events: [],
      previousSnapshotTimestamp: null,
    })

    // Trap-13 guard: the equality below must not hold vacuously ([] === []).
    expect(live.inferenceWarnings).toEqual([
      'Root node defaulted to 0.0',
      'Target withheld for this run',
    ])
    expect(persisted).not.toBeNull()
    expect(persisted!.inferenceWarnings).toEqual(live.inferenceWarnings)
  })
})
