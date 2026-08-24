/**
 * D7b — THE SUPPRESSION IS NARROWED TO THE ONE REASON THAT PROVES IT, AND
 * WIDENED TO THE ROWS THAT CARRY THAT REASON WITHOUT THE BOOLEAN.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE TWO QUESTIONS, WRITTEN DOWN BEFORE ANYTHING WAS RECONCILED (trap 21)
 * ─────────────────────────────────────────────────────────────────────────
 * A. `flip_thresholds[].flip_reason` answers:
 *    "Moving THIS FACTOR ALONE across its domain, at the mean edge
 *     configuration, is there a value at which the argmax changes?"
 * B. `conditional_winners[].winner_flips` answers:
 *    "If I median-split the Monte-Carlo samples on this factor's realised
 *     value, do the two halves have different WIN-FREQUENCY argmaxes?"
 *
 * They are different questions — UNLESS the flip reason is
 * `structurally_invariant`, in which case A's answer makes B's instrument
 * provably non-discriminating:
 *
 *   `structurally_invariant` means the per-option transmission slopes are
 *   IDENTICAL (spread <= 1e-9) — PLoT `lib/flip-threshold-status.ts:44-49`,
 *   read at staging `7e5d8a7d`: "no value of this factor can move the
 *   argmax". The slope equality is TOPOLOGICAL (which of the factor's causal
 *   paths each option's intervention severs), so it holds for EVERY sampled
 *   edge configuration, not just the mean one. The per-sample winner is
 *   therefore independent of the factor, the two buckets are two random
 *   halves of ONE sequence, and `winner_flips: true` is sampling noise whose
 *   only driver is how close the win probability sits to 0.5.
 *
 *   `no_effect_within_bounds` means the slopes GENUINELY DIFFER and the
 *   crossing merely lies outside the domain AT THE MEAN CONFIGURATION
 *   (`flip-threshold-status.ts:43-44`). Each sample draws different edge
 *   strengths, so the crossing moves and can fall inside the domain for a
 *   real share of draws. A bucket disagreement there is a FINDING ISL
 *   COMPUTED, not an artefact — suppressing it withholds science.
 *
 * PLoT collapses both tokens into one boolean:
 * `integrations/isl/adapters/factor-flip-values.ts:304` stamps
 * `no_flip_in_range: true` from `NO_EFFECT_REASONS`, which is the SET of both
 * (`lib/flip-threshold-status.ts:75-78`). So the boolean cannot carry the
 * distinction and the reason must be read.
 *
 * ⚠ TWO OPPOSITE HARMS, TWO PREDICATES (trap 22b). Over-suppression withholds
 * a real finding; under-suppression states a falsehood. They are NOT tuned on
 * one window here: the run-level absence claim keeps
 * `isAttestedNoFlipReason` (BOTH tokens — `no_effect_within_bounds` really is
 * an attested absence over the tested range), while the per-factor suppression
 * of a SIBLING SURFACE'S positive claim uses the strictly narrower
 * `provesFactorCannotMoveWinner` (the algebraic proof only). Merging them
 * would trade one silent failure for the other.
 *
 * ⚠ FIXTURE PROVENANCE. Every payload below is a REAL capture from
 * `src/lib/coherence/__tests__/fixtures/captures/` (sha256s in its
 * `PROVENANCE.md`), imported rather than re-copied. Where a case needs a
 * combination no single capture holds, the transformation is a JOIN of two
 * real halves and is named `COMPOSED` with its licence stated — never an
 * invented row.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
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

const nodes: Node[] = [
  { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
]
const edges: Edge[] = []

function snapshotOf(raw: Record<string, unknown>) {
  return buildAnalysisSnapshot({
    rawV2Response: raw as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges,
    runNumber: 1,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

const flipRows = (e: Record<string, unknown>) =>
  e.flip_thresholds as Array<Record<string, unknown>>
const winnerRows = (e: Record<string, unknown>) =>
  e.conditional_winners as Array<Record<string, unknown>>

// ───────────────────────────────────────────────────────────────────────────
// DIRECTION 1 — THE OVER-SUPPRESSION ARM MUST STOP FIRING.
// `no_effect_within_bounds` is compatible with a marginal flip. A row the
// producer computed must reach the user.
// ───────────────────────────────────────────────────────────────────────────

describe('D7b direction 1 — a `no_effect_within_bounds` attestation does NOT suppress the conditional winner', () => {
  it('PRECONDITION: w998 really carries `no_effect_within_bounds` beside `no_flip_in_range: true` — the boolean collapses BOTH reasons', () => {
    // Stated first so the case below measures a producer-real combination.
    const rows = flipRows(W998)
      .filter(r => r.no_flip_in_range === true)
      .map(r => [r.factor_id, r.flip_reason, r.flip_value])
    expect(rows).toEqual([
      ['13faf76d', 'no_effect_within_bounds', null],
      ['1ed89ca0', 'no_effect_within_bounds', null],
    ])
    // And the capture carries NO conditional winner, which is why this arm was
    // reachable-by-construction but never witnessed. The join below supplies
    // the missing half from another real capture.
    expect(winnerRows(W998)).toEqual([])
  })

  it('COMPOSED (two real halves): the flip claim SURVIVES for a `no_effect_within_bounds` factor', () => {
    // LICENCE FOR THE JOIN: PLoT stamps `no_flip_in_range: true` from the SET
    // {no_effect_within_bounds, structurally_invariant}
    // (factor-flip-values.ts:304 + flip-threshold-status.ts:75-78), and ISL
    // emits `conditional_winners` for any uncertain factor whose bucket
    // winners differ (robustness_analyzer_v2.py:5204-5226). Nothing couples
    // the two arrays, so this combination is producer-reachable.
    // TRANSFORMATION, disclosed: probe-A's conditional-winner row VERBATIM
    // except `factor_id`, re-keyed onto w998's `no_effect_within_bounds`
    // factor. Both halves are real; only the join is composed.
    const winner = { ...clone(winnerRows(PROBE_A)[0]), factor_id: '13faf76d' }
    const raw = { flip_thresholds: clone(flipRows(W998)), conditional_winners: [winner] }

    const s = snapshotOf(raw)
    expect(s.conditionalWinners.map(r => r.factorId)).toEqual(['13faf76d'])
    // And it still states a threshold — the row is rendered, not merely kept.
    expect(s.conditionalWinners[0].condition).toContain('exceeds')
  })

  it('DISCRIMINATION: the SAME composed row IS suppressed once the reason is the algebraic proof', () => {
    // The only difference from the case above is the reason token. If both
    // cases moved together the gate would be keyed on something other than the
    // reason, and this pair is what proves it is not.
    const winner = { ...clone(winnerRows(PROBE_A)[0]), factor_id: '13faf76d' }
    const flips = clone(flipRows(W998))
    flips[0].flip_reason = 'structurally_invariant'
    const s = snapshotOf({ flip_thresholds: flips, conditional_winners: [winner] })
    expect(s.conditionalWinners).toEqual([])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// DIRECTION 2 — THE UNDER-SUPPRESSION ARM MUST START FIRING.
// The reason, not the boolean, carries the attestation. A row bearing the
// proof without the flag was refused by the results panel's `selectFlipRisk`
// (which reads `flip_reason`) and rendered by the Compare tab (which read the
// boolean) — the sibling-surface disagreement this gate exists to end.
// ───────────────────────────────────────────────────────────────────────────

describe('D7b direction 2 — the PROOF suppresses even when the boolean is absent', () => {
  it('w2d with `no_flip_in_range` deleted: the rows STAY suppressed, because `structurally_invariant` is still on the wire', () => {
    const raw = clone(W2D)
    for (const r of flipRows(raw)) delete r.no_flip_in_range
    // Precondition pinned in-test: the proof is still present after the delete,
    // so a pass here cannot be an empty-array vacuity.
    expect(flipRows(raw).map(r => r.flip_reason))
      .toEqual(['structurally_invariant', 'structurally_invariant'])
    expect(snapshotOf(raw).conditionalWinners).toEqual([])
  })

  it('OPPOSITE-DIRECTION TWIN: deleting the REASON un-suppresses — nothing else in the payload is doing the work', () => {
    const raw = clone(W2D)
    for (const r of flipRows(raw)) {
      delete r.no_flip_in_range
      delete r.flip_reason
    }
    expect(snapshotOf(raw).conditionalWinners.map(r => r.factorId))
      .toEqual(['71c6351d', 'fcf3d740'])
  })

  it('an UNRECOGNISED reason token does not suppress — only a proof may withhold a computed claim', () => {
    const raw = clone(W2D)
    for (const r of flipRows(raw)) {
      r.flip_reason = 'a_token_this_build_has_never_seen'
      delete r.no_flip_in_range
    }
    expect(snapshotOf(raw).conditionalWinners.map(r => r.factorId))
      .toEqual(['71c6351d', 'fcf3d740'])
  })

  it('a `structurally_invariant` row that ALSO carries a numeric flip_value does not suppress — the attestation is incoherent, so it is not used', () => {
    // PLoT cannot emit this (`isAttestedNoFlip` requires `flip_value === null`,
    // factor-flip-values.ts:365-367), so this is defence in depth. The polarity
    // is deliberate: an incoherent attestation fails toward NOT withholding.
    const raw = clone(W2D)
    for (const r of flipRows(raw)) {
      r.flip_value = 0.42
      delete r.no_flip_in_range
    }
    expect(snapshotOf(raw).conditionalWinners.map(r => r.factorId))
      .toEqual(['71c6351d', 'fcf3d740'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// REGRESSION PINS — the two real captures keep their existing verdicts.
// ───────────────────────────────────────────────────────────────────────────

describe('D7b regression pins — the witnessed cases are unchanged', () => {
  it('w2d VERBATIM: still suppressed (the witnessed contradiction stays closed)', () => {
    expect(snapshotOf(W2D).conditionalWinners).toEqual([])
  })

  it('probe-A VERBATIM: a `found` flip row never suppresses its own factor', () => {
    const s = snapshotOf(PROBE_A)
    expect(s.conditionalWinners.map(r => r.factorId)).toEqual(['fac_demand'])
  })
})
