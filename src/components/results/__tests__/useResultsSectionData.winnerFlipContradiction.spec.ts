/**
 * useResultsSectionData — THE RESULTS PANEL STOPS SAYING BOTH THINGS AT ONCE.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE WITNESSED DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * On the Analysis tab, `TriageActionCardsBody` renders `ConditionalWinnerCards`
 * (":916") from `confidence.conditionalWinners`, and the SAME tab states the
 * producer's flip attestation from `recommendation.flipThresholds`. On a
 * near-tie run the two say opposite things about ONE factor:
 *
 *   "no single factor on its own reached a tipping point that would change
 *    which option leads"      …beside…      "When X exceeds 0.50, Y takes over"
 *
 * Measured on the deployed build in a controlled experiment: 4 of 8 near-tie
 * responses assert both for the same factor; 0 of 8 in the separated contrast
 * control (`CLAUDE-FLIP-VALIDITY-SETTLEMENT.md` §B.3). The real capture
 * `seeded-2026-08-17-w2d-analysis-turn.json` is an instance.
 *
 * `crossSurfaceCoherence` pair CX5 names this exact pair, but it is an OFFLINE
 * instrument over committed captures — nothing at runtime prevented it. The
 * Compare tab was bound in #788; this is its sibling surface, which was left
 * behind and is the one the settlement actually witnessed.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHICH SURFACE IS AUTHORITATIVE, AND WHY IT IS NOT A COIN TOSS
 * ─────────────────────────────────────────────────────────────────────────
 * `structurally_invariant` (PLoT `lib/flip-threshold-status.ts:44-49`) is an
 * ALGEBRAIC attestation: the per-option transmission slopes are identical
 * (spread <= 1e-9), so "no value of this factor can move the argmax". The
 * equality is topological, so it holds under every sampled edge draw — which
 * makes the median-split bucket comparison behind `winner_flips` a comparison
 * of two random halves of ONE sequence. Its disagreement rate is governed only
 * by proximity to a 50/50 win probability. The flip attestation is therefore
 * authoritative and the bucket claim is an artefact.
 *
 * `no_effect_within_bounds` is NOT that: the slopes genuinely differ and the
 * crossing merely sits outside the domain at the MEAN edge configuration. Each
 * sample draws different strengths, so a bucket disagreement can be real. That
 * row is KEPT — see the opposite-direction twins below.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { buildAnalysisSnapshot } from '../../../canvas/stores/analysisSnapshotFactory'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

import w2dTurn from '../../../lib/coherence/__tests__/fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json'
import w998Turn from '../../../lib/coherence/__tests__/fixtures/captures/w998-2026-08-16-a1-turn3.json'
import probeA from '../../../lib/coherence/__tests__/fixtures/captures/conditional-winners-2026-08-17-probe-A.json'

const W2D = (w2dTurn as unknown as { blocks: Array<{ enrichment: Record<string, unknown> }> })
  .blocks[0].enrichment
const W998 = (w998Turn as unknown as { blocks: Array<{ enrichment: Record<string, unknown> }> })
  .blocks[0].enrichment
const PROBE_A = probeA as unknown as Record<string, unknown>

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

const flipRows = (e: Record<string, unknown>) =>
  e.flip_thresholds as Array<Record<string, unknown>>
const winnerRows = (e: Record<string, unknown>) =>
  e.conditional_winners as Array<Record<string, unknown>>

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

function setStoreWithReport(reportOverrides: Record<string, unknown>): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        analysis_status: 'computed',
        robustness: { fragile_edges: [], robust_edges: [] },
        ...reportOverrides,
      },
    } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

/** Factor ids the results panel would render conditional-winner cards for. */
function renderedWinnerIds(enrichment: Record<string, unknown>): string[] {
  setStoreWithReport({
    flip_thresholds: clone(flipRows(enrichment) ?? []),
    conditional_winners: clone(winnerRows(enrichment) ?? []),
  })
  const { result } = renderHook(() => useResultsSectionData())
  return (result.current.confidence.conditionalWinners ?? []).map(w => w.factor_id)
}

/** Factor ids the Compare tab would render transitions for, same payload. */
function compareTabWinnerIds(enrichment: Record<string, unknown>): string[] {
  const snapshot = buildAnalysisSnapshot({
    rawV2Response: {
      flip_thresholds: clone(flipRows(enrichment) ?? []),
      conditional_winners: clone(winnerRows(enrichment) ?? []),
    } as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes: [] as Node[],
    edges: [] as Edge[],
    runNumber: 1,
    events: [],
    previousSnapshotTimestamp: null,
  })
  return snapshot.conditionalWinners.map(w => w.factorId)
}

beforeEach(() => {
  useCanvasStore.setState({
    results: null,
    runMeta: null,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: false,
    rawV2Response: null,
  } as any)
})

// ───────────────────────────────────────────────────────────────────────────
// THE WITNESSED CONTRADICTION IS CLOSED ON THE RESULTS PANEL.
// ───────────────────────────────────────────────────────────────────────────

describe('results panel — an algebraically-proven inert factor no longer also "takes over"', () => {
  it('PRECONDITION: w2d asserts BOTH claims for the SAME two factor ids', () => {
    expect(flipRows(W2D).map(r => [r.factor_id, r.flip_reason, r.flip_value])).toEqual([
      ['71c6351d', 'structurally_invariant', null],
      ['fcf3d740', 'structurally_invariant', null],
    ])
    expect(winnerRows(W2D).map(r => [r.factor_id, r.winner_flips])).toEqual([
      ['71c6351d', true],
      ['fcf3d740', true],
    ])
  })

  it('the contradicted cards are withheld — `confidence.conditionalWinners` carries neither factor', () => {
    expect(renderedWinnerIds(W2D)).toEqual([])
  })

  it('OPPOSITE-DIRECTION TWIN: with the proof removed, both rows render — the suppression is the proof\'s doing', () => {
    const raw = clone(W2D)
    for (const r of flipRows(raw)) {
      delete r.flip_reason
      delete r.no_flip_in_range
    }
    expect(renderedWinnerIds(raw)).toEqual(['71c6351d', 'fcf3d740'])
  })

  it('OPPOSITE-DIRECTION TWIN: a `no_effect_within_bounds` factor KEEPS its card — a computed finding is not withheld', () => {
    // COMPOSED from two real halves, disclosed: w998's real
    // `no_effect_within_bounds` rows joined to probe-A's real conditional
    // winner, re-keyed onto w998's factor. Licence: PLoT stamps
    // `no_flip_in_range` from a SET of both reasons
    // (factor-flip-values.ts:304), and nothing couples the two arrays.
    const winner = { ...clone(winnerRows(PROBE_A)[0]), factor_id: '13faf76d' }
    expect(renderedWinnerIds({
      flip_thresholds: clone(flipRows(W998)),
      conditional_winners: [winner],
    })).toEqual(['13faf76d'])
  })

  it('OPPOSITE-DIRECTION TWIN: a `found` flip row never suppresses its own factor (probe-A verbatim)', () => {
    expect(renderedWinnerIds(PROBE_A)).toEqual(['fac_demand'])
  })

  it('suppression binds by factor IDENTITY — a proof for a different factor withholds nothing', () => {
    const raw = clone(W2D)
    for (const r of flipRows(raw)) r.factor_id = `${String(r.factor_id)}-other`
    expect(renderedWinnerIds(raw)).toEqual(['71c6351d', 'fcf3d740'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// THE POINT OF THE LANE: ONE PAYLOAD, ONE VERDICT, ON BOTH SURFACES.
// ───────────────────────────────────────────────────────────────────────────

describe('cross-surface agreement — the results panel and the Compare tab decide alike', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['w2d verbatim (structurally_invariant + winner_flips)', W2D],
    ['probe-A verbatim (found + winner_flips)', PROBE_A],
  ]

  it.each(cases)('%s — identical surviving factor ids on both surfaces', (_name, enrichment) => {
    expect(renderedWinnerIds(enrichment)).toEqual(compareTabWinnerIds(enrichment))
  })

  it('the proof WITHOUT the boolean: both surfaces suppress (this pair used to disagree)', () => {
    // Before the narrowing the Compare tab keyed on `no_flip_in_range` alone,
    // so this row rendered there while the results panel's `selectFlipRisk`
    // (which reads `flip_reason`) refused the same run's flip claim — a NEW
    // instance of the very sibling-surface disagreement #788 set out to close.
    const raw = clone(W2D)
    for (const r of flipRows(raw)) delete r.no_flip_in_range
    expect(flipRows(raw).map(r => r.flip_reason))
      .toEqual(['structurally_invariant', 'structurally_invariant'])
    expect(renderedWinnerIds(raw)).toEqual([])
    expect(compareTabWinnerIds(raw)).toEqual([])
  })

  it('DISCRIMINATION CONTROL — the agreement above is not vacuous: both surfaces render the same non-empty set', () => {
    const winner = { ...clone(winnerRows(PROBE_A)[0]), factor_id: '13faf76d' }
    const payload = {
      flip_thresholds: clone(flipRows(W998)),
      conditional_winners: [winner],
    }
    expect(renderedWinnerIds(payload)).toEqual(['13faf76d'])
    expect(compareTabWinnerIds(payload)).toEqual(['13faf76d'])
  })
})
