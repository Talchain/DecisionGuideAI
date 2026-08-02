/**
 * useResultsSectionData — probe-failure rows must SURVIVE the mapping chain
 * (ROADMAP 2.280).
 *
 * ⚠ WHY THIS FILE EXISTS SEPARATELY FROM `flipReasonVocabulary.spec.ts`.
 * That file pins `classifyFlipEvidence` directly, and a classifier that is
 * correct about the rows it is GIVEN proves nothing if the rows never arrive.
 * The defect had TWO halves and they are in different modules:
 *
 *   1. `classifyFlipEvidence` collapsed every null-valued row into an attested
 *      absence — fixed and pinned in the sibling file.
 *   2. `useResultsSectionData:1797` DELETED `timeout` / `isl_error` rows from
 *      the array before anything could classify them — fixed here.
 *
 * Fixing only (1) would leave the live `timeout` case broken while looking
 * fully tested, because the unit test hands the classifier a row the real
 * pipeline had already thrown away. This is trap 11 in its transport form: a
 * spec that exercises a corrected function over fixtures the production path
 * can no longer produce. So this file drives the REAL hook and asserts on what
 * the REAL mapping chain publishes.
 *
 * FIXTURE PROVENANCE: `structurally_invariant` is the witnessed zero-flip token
 * (`witness-2267-raw/f-turn-2.json` 4×, `r3-turn-2.json` 6×,
 * `witness-2265-raw/runB` 3× + 1×`found`). `timeout` is a real producer token
 * (`flip-threshold-status.ts:86`); the mixed run below is the shape the deleted
 * filter used to corrupt.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { classifyFlipEvidence } from '../utils/selectFlipRisk'
import { useCanvasStore } from '../../../canvas/store'

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

function setReportWithFlipThresholds(flipThresholds: unknown[]): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        flip_thresholds: flipThresholds,
        robustness: { fragile_edges: [], robust_edges: [] },
      },
    } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

function publishedFlipThresholds() {
  const { result } = renderHook(() => useResultsSectionData())
  return result.current.recommendation?.flipThresholds ?? []
}

/** A mixed live run: one factor never measured, the rest attesting no flip. */
const MIXED_RUN = [
  { node_id: 'fac_slow', flip_value: null, flip_reason: 'timeout' },
  { node_id: 'fac_a', flip_value: null, flip_reason: 'structurally_invariant' },
  { node_id: 'fac_b', flip_value: null, flip_reason: 'no_effect_within_bounds' },
]

beforeEach(() => {
  useCanvasStore.setState({ results: { status: 'idle', report: null } } as any)
})

describe('useResultsSectionData — the flip-threshold mapping preserves the evidence (ROADMAP 2.280)', () => {
  it('control: the mapping chain publishes the rows at all', () => {
    // Anti-vacuity (trap 13). Every assertion below is about which rows
    // survive; if NONE survived, "the timeout row is present" would fail for
    // the wrong reason and "no attested absence" would pass for the wrong one.
    setReportWithFlipThresholds([
      { node_id: 'fac_a', flip_value: null, flip_reason: 'structurally_invariant' },
    ])
    expect(publishedFlipThresholds()).toHaveLength(1)
  })

  it('RED-first: a `timeout` row is NOT deleted from the published array', () => {
    setReportWithFlipThresholds(MIXED_RUN)
    const published = publishedFlipThresholds()

    expect(published).toHaveLength(3)
    expect(published.map((ft) => ft.node_id)).toContain('fac_slow')
    // And the reason survives the mapping — the classifier downstream needs it.
    expect(published.find((ft) => ft.node_id === 'fac_slow')?.flip_reason).toBe('timeout')
  })

  it('END-TO-END: the mixed live run does not reach the panel as an attested absence', () => {
    // The claim that actually matters, asserted over what the REAL hook
    // publishes rather than over a hand-built array. Before 2.280 the timeout
    // row was filtered out here and the remaining two — both attesting —
    // classified as `flips_absent`, i.e. "the producer proved nothing flips",
    // on a run where `fac_slow` was never measured.
    setReportWithFlipThresholds(MIXED_RUN)
    expect(classifyFlipEvidence(publishedFlipThresholds())).toBe('no_producer_flip_data')
    expect(classifyFlipEvidence(publishedFlipThresholds())).not.toBe('flips_absent')
  })

  it('positive control: an all-attesting run still reaches the panel as flips_absent', () => {
    // The witnessed 2.276 shape. The honest all-clear must survive this change,
    // or the fix has simply blinded the gate instead of correcting it.
    setReportWithFlipThresholds([
      { node_id: 'fac_a', flip_value: null, flip_reason: 'structurally_invariant' },
      { node_id: 'fac_b', flip_value: null, flip_reason: 'structurally_invariant' },
    ])
    expect(classifyFlipEvidence(publishedFlipThresholds())).toBe('flips_absent')
  })

  it('positive control: a real flip still reaches the panel as flips_present', () => {
    setReportWithFlipThresholds([
      { node_id: 'fac_a', flip_value: null, flip_reason: 'structurally_invariant' },
      { node_id: 'fac_op_readiness', flip_value: 0.772182, flip_reason: 'found' },
    ])
    expect(classifyFlipEvidence(publishedFlipThresholds())).toBe('flips_present')
  })
})
