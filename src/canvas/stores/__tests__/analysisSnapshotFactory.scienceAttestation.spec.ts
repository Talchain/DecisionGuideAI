/**
 * D7 — THE COMPARE TAB IS BOUND TO PRODUCER ATTESTATIONS.
 *
 * Two claims, and they point in OPPOSITE DIRECTIONS on purpose:
 *   (1) the UI never publishes a number the science did not produce; and
 *   (2) the UI never suppresses one it did.
 * A corpus that tests only (1) is a guard watching one door, and that exact
 * shape has cost this estate four consecutive rounds on one predicate.
 *
 * ⚠ WHERE THE INPUTS COME FROM. Every payload below is a REAL capture recorded
 * off the deployed product, already vendored byte-identical for the coherence
 * gate with sha256s in
 * `src/lib/coherence/__tests__/fixtures/captures/PROVENANCE.md`. They are
 * imported from there rather than re-copied, so there is one corpus and one
 * provenance record. **APPEND-ONLY** — a capture is a record of what the
 * product once emitted; editing one to keep this suite green would falsify it.
 *
 * ⚠⚠ WHAT THE CORPUS CANNOT DO, STATED BEFORE THE TESTS RATHER THAN DISCOVERED
 * AFTER THEM. A census of EVERY `conditional_winners` row in `olumi-docs/`
 * (2,290 JSON files, 28 rows found) returned:
 *
 *     (winner_flips, low_id === high_id, low_label === high_label) -> count
 *     (true,         false,              false)                    -> 28
 *
 * So the corpus contains **ZERO** `winner_flips: false` rows, **ZERO** rows
 * with equal bucket identities, and **ZERO** rows with a withheld identity.
 * It therefore CANNOT certify this code over those classes, and no amount of
 * running it would say otherwise — a corpus that omits a value class the
 * contract admits is blind to it.
 *
 * Those three classes are consequently derived from the PRODUCER'S OWN
 * CONTRACT, not from anything this lane imagined, and each derivation is a
 * documented transformation applied to a REAL row (`CONTRACT_DERIVED` below):
 *   · `winner_flips: false`  — `EnrichmentConditionalWinnerSchema` types it
 *     `z.boolean()`, REQUIRED, and its doc says it states THAT the winner
 *     changes across the split, never WHICH option.
 *   · withheld identity — `EnrichmentConditionalBucketSchema` makes
 *     `winner_id`/`winner_label` optional for one stated reason: "on a turn
 *     whose verdict WITHHOLDS the leading-option claim, CEE's withheld-claim
 *     projection strips exactly these four members". Its absence semantics are
 *     explicit: it means the option was withheld, and "never means 'no option
 *     won'".
 * Both quotations are from the vendored 0.48.0
 * `dist/boundary/enrichment.js`, read at the bytes, not from a doc page.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import { deriveTransitions } from '../../compare-tab/deriveTransitions'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

// The two real captures that carry conditional-winner and factor-sensitivity
// science. `w2d` is a CEE turn; the members this factory reads live on
// `blocks[0].enrichment`, which the contract states IS "the full PLoT /v2/run
// envelope persisted by CEE run_analysis".
import w2dTurn from '../../../lib/coherence/__tests__/fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json'
import probeA from '../../../lib/coherence/__tests__/fixtures/captures/conditional-winners-2026-08-17-probe-A.json'

const W2D = (w2dTurn as unknown as { blocks: Array<{ enrichment: Record<string, unknown> }> })
  .blocks[0].enrichment
const PROBE_A = probeA as unknown as Record<string, unknown>

const nodes: Node[] = [
  { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
]
const edges: Edge[] = []

function snapshotOf(raw: Record<string, unknown>, runNumber = 1) {
  return buildAnalysisSnapshot({
    rawV2Response: raw as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges,
    runNumber,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

/** Deep clone so no test can mutate a capture another test reads. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ───────────────────────────────────────────────────────────────────────────
// DIRECTION (2) FIRST — THE INVERSE DEFECT, WHICH IS THE ONE THAT WOULD MAKE
// THIS WORSE. Every one of these values IS on the real wire and MUST render.
// ───────────────────────────────────────────────────────────────────────────

describe('D7 opposite-direction twin — a value the producer DID compute still renders', () => {
  it('probe-A: rank_flip_rate is PRESENT and 0 on the wire → rankFlipRate === 0, not null', () => {
    // Bound by identity to the row the producer sent, not to "some zero".
    const wire = (PROBE_A.factor_sensitivity as Array<Record<string, unknown>>)
      .find(f => f.factor_id === 'fac_demand')
    expect(wire).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(wire!, 'rank_flip_rate')).toBe(true)
    expect(wire!.rank_flip_rate).toBe(0)

    const s = snapshotOf(PROBE_A)
    expect(s.rankFlipRate).toBe(0)
    expect(s.rankFlipRate).not.toBeNull()
  })

  it('probe-A: a genuinely-computed elasticity of 0 survives as 0 — topElasticity 0, concentration 0', () => {
    const elasticities = (PROBE_A.factor_sensitivity as Array<Record<string, unknown>>)
      .map(f => f.elasticity)
    expect(elasticities).toEqual([0, 0]) // the producer measured, and measured zero

    const s = snapshotOf(PROBE_A)
    expect(s.topElasticity).toBe(0)
    expect(s.influenceConcentration).toBe(0)
    // The whole point: these are NOT null. Suppressing them would be the
    // mirror defect — a computed measurement withheld from the user.
    expect(s.topElasticity).not.toBeNull()
    expect(s.influenceConcentration).not.toBeNull()
  })

  it('probe-A: the attested flip row IS carried, with both bucket identities', () => {
    const s = snapshotOf(PROBE_A)
    expect(s.conditionalWinners).toHaveLength(1)
    const row = s.conditionalWinners[0]
    expect(row.factorId).toBe('fac_demand')
    expect(row.lowWinnerId).toBe('opt-pin-demand')
    expect(row.winnerId).toBe('opt-build-capacity')
    expect(row.winner).toBe('Build capacity instead')
  })

  it('w2d: both attested flip rows are carried (a withheld LEADER does not suppress the flip science)', () => {
    // This capture's turn carries `leader_claim.permitted: false`, and the
    // producer nonetheless shipped both bucket identities. Whether that is
    // itself coherent is coherence pair CX4's question, not this factory's:
    // over-suppressing here would discard science the producer sent.
    const s = snapshotOf(W2D)
    expect(s.conditionalWinners.map(r => r.factorId)).toEqual(['71c6351d', 'fcf3d740'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// DIRECTION (1) — NO MINTED NUMBERS.
// ───────────────────────────────────────────────────────────────────────────

describe('D7 — an unmeasured quantity is absent, never 0', () => {
  it('w2d: the top factor carries NO rank_flip_rate on the wire → rankFlipRate === null', () => {
    // The real absence, straight off a real capture — not a fixture with a
    // key deleted. Bound by identity to `cb77d5e3`, the row that sorts first.
    const wire = (W2D.factor_sensitivity as Array<Record<string, unknown>>)
      .find(f => f.factor_id === 'cb77d5e3')
    expect(wire).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(wire!, 'rank_flip_rate')).toBe(false)

    const s = snapshotOf(W2D)
    expect(s.topFactors[0].id).toBe('cb77d5e3')
    expect(s.rankFlipRate).toBeNull()
    // The defect this replaces: the trajectory table printed "0.00" here.
    expect(s.rankFlipRate).not.toBe(0)
  })

  it('no factor_sensitivity at all → topElasticity, rankFlipRate and influenceConcentration are ALL null', () => {
    const raw = clone(PROBE_A)
    delete raw.factor_sensitivity
    const s = snapshotOf(raw)
    expect(s.topElasticity).toBeNull()
    expect(s.rankFlipRate).toBeNull()
    expect(s.influenceConcentration).toBeNull()
  })

  it('factors present but NONE scored → influenceConcentration is null, not 0', () => {
    // Distinguishes the two returns the old signature collapsed:
    // "nothing was measured" vs "the ratio was measured and is 0".
    const raw = clone(PROBE_A)
    for (const f of raw.factor_sensitivity as Array<Record<string, unknown>>) delete f.elasticity
    const s = snapshotOf(raw)
    expect(s.influenceConcentration).toBeNull()
    expect(s.topElasticity).toBeNull()
    // …and the twin one line away: with the elasticities restored it is 0.
    expect(snapshotOf(clone(PROBE_A)).influenceConcentration).toBe(0)
  })

  it('an unscored factor sorts LAST — topFactors[0] is never a factor nobody measured', () => {
    const raw = clone(PROBE_A)
    const fs = raw.factor_sensitivity as Array<Record<string, unknown>>
    delete fs[0].elasticity      // fac_demand becomes unscored
    fs[1].elasticity = 0.7       // fac_capacity is scored
    const s = snapshotOf(raw)
    expect(s.topFactors[0].id).toBe('fac_capacity')
    expect(s.topElasticity).toBe(70)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// FLIP DETECTION BOUND BY IDENTITY AND ATTESTATION.
// The three classes below are CONTRACT_DERIVED — see the header. Each is a
// documented producer transformation applied to a REAL row.
// ───────────────────────────────────────────────────────────────────────────

describe('D7 — a flip claim requires the producer to have attested a flip', () => {
  it('CONTRACT_DERIVED: winner_flips false → the row is DROPPED, no takeover claim', () => {
    const raw = clone(PROBE_A)
    ;(raw.conditional_winners as Array<Record<string, unknown>>)[0].winner_flips = false
    expect(snapshotOf(raw).conditionalWinners).toEqual([])
  })

  it('CONTRACT_DERIVED: equal bucket IDENTITIES beside winner_flips true → dropped', () => {
    // A producer self-contradiction. The honest response is to decline the
    // claim, not to reconcile it into one.
    const raw = clone(PROBE_A)
    const row = (raw.conditional_winners as Array<Record<string, unknown>>)[0]
    ;(row.high_bucket as Record<string, unknown>).winner_id =
      (row.low_bucket as Record<string, unknown>).winner_id
    expect(snapshotOf(raw).conditionalWinners).toEqual([])
  })

  it('IDENTITY, NOT LABEL — equal LABELS with distinct IDS is still a real flip', () => {
    // Two options may share one display label. A label filter cannot see this
    // flip; an identity test can. This is the discriminating half of trap 19:
    // the previous behaviour bound to `high_bucket.winner_label`.
    const raw = clone(PROBE_A)
    const row = (raw.conditional_winners as Array<Record<string, unknown>>)[0]
    ;(row.high_bucket as Record<string, unknown>).winner_label =
      (row.low_bucket as Record<string, unknown>).winner_label
    const s = snapshotOf(raw)
    expect(s.conditionalWinners).toHaveLength(1)
    expect(s.conditionalWinners[0].lowWinnerId).toBe('opt-pin-demand')
    expect(s.conditionalWinners[0].winnerId).toBe('opt-build-capacity')
  })

  it('IDENTITY, NOT LABEL — distinct labels on ONE identity is a relabel, not a flip', () => {
    const raw = clone(PROBE_A)
    const row = (raw.conditional_winners as Array<Record<string, unknown>>)[0]
    ;(row.high_bucket as Record<string, unknown>).winner_id = 'opt-pin-demand'
    ;(row.high_bucket as Record<string, unknown>).winner_label = 'Lock in demand now (revised)'
    expect(snapshotOf(raw).conditionalWinners).toEqual([])
  })

  it('a row with no finite split_value cannot state "flips at N" and is dropped', () => {
    const raw = clone(PROBE_A)
    delete (raw.conditional_winners as Array<Record<string, unknown>>)[0].split_value
    expect(snapshotOf(raw).conditionalWinners).toEqual([])
  })
})

describe('D7 — a WITHHELD identity keeps the science and declines to name the option', () => {
  it('CONTRACT_DERIVED: stripped bucket identities → row kept, winner null, ids null', () => {
    const raw = clone(PROBE_A)
    for (const b of ['low_bucket', 'high_bucket']) {
      const bucket = (raw.conditional_winners as Array<Record<string, unknown>>)[0][b] as Record<string, unknown>
      delete bucket.winner_id
      delete bucket.winner_label
    }
    const s = snapshotOf(raw)
    // NOT dropped: the producer withheld WHICH option, not WHETHER it flips.
    // Dropping it would be the over-suppression failure.
    expect(s.conditionalWinners).toHaveLength(1)
    expect(s.conditionalWinners[0].winner).toBeNull()
    expect(s.conditionalWinners[0].winnerId).toBeNull()
    expect(s.conditionalWinners[0].lowWinnerId).toBeNull()
    expect(s.conditionalWinners[0].condition).toContain('Customer demand')
  })

  it('the transition sentence never interpolates an empty option name', () => {
    const raw = clone(PROBE_A)
    for (const b of ['low_bucket', 'high_bucket']) {
      const bucket = (raw.conditional_winners as Array<Record<string, unknown>>)[0][b] as Record<string, unknown>
      delete bucket.winner_id
      delete bucket.winner_label
    }
    // Two runs so a transition exists; the factor must be "affected", which a
    // factor absent from run 1's top list always is.
    const first = snapshotOf({ ...clone(PROBE_A), factor_sensitivity: [] }, 1)
    const second = snapshotOf(raw, 2)
    const transitions = deriveTransitions([first, second])
    const line = transitions[0]?.conditionalWinner ?? ''
    expect(line).not.toMatch(/,\s+takes over/)       // the old output
    expect(line).not.toContain('undefined')
    if (line !== '') expect(line).toContain('withheld')
  })

  it('a NAMED attested flip still produces the full takeover sentence', () => {
    // Opposite-direction twin of the test above, on the unmodified capture.
    const first = snapshotOf({ ...clone(PROBE_A), factor_sensitivity: [] }, 1)
    const second = snapshotOf(clone(PROBE_A), 2)
    const line = deriveTransitions([first, second])[0]?.conditionalWinner ?? ''
    expect(line).toContain('Build capacity instead takes over')
  })
})
