/**
 * ⭐⭐ A THIRD TECHNIQUE UNDER ONE SIGNAL CODE — the claim-id argument, restated
 * with more evidence than it was first admitted on.
 *
 * ── THE SWEEP ──────────────────────────────────────────────────────────────
 * All 945 captured debug bundles were read for DSK claim ids. NINE distinct ids
 * occur; `#1806` mapped two of them. `DSK-T-003` occurs **83 times**, and four
 * of those are stamped `CALIBRATION_PROMPT` — the SAME code as `DSK-T-001`
 * (pre-mortem) and `DSK-T-002` (outside view).
 *
 * So the code collapses THREE techniques, not two, and the shelf could name
 * only two of them. On a run raising it, "Consider the opposite" sat under
 * "Other methods" while the producer had explicitly raised it.
 *
 * ── THE ORACLE, DERIVED FROM THE PRODUCER ──────────────────────────────────
 * `dsk_claim_provenance.claim_title` for `DSK-T-003` reads, in every capture
 * that carries it, *"Consider-the-opposite as a debiasing strategy"*. The
 * catalogue entry `consider_opposite` is titled *"Consider the opposite"*.
 * Name-identical in both halves — the same standard the first two rows were
 * admitted on (CLAUDE.md trap 13c: derive the expectation from the producer,
 * never from my own reading of what a field ought to mean).
 *
 * ⛔ AND THE SIX IDS THAT ARE **NOT** MAPPED, WHICH IS THE MORE IMPORTANT HALF.
 * `DSK-T-004` (45), `DSK-B-007` (63), `DSK-T-005` (18), `DSK-B-006` (17),
 * `DSK-B-001` (6) and `DSK-B-003` (1) all occur in the wild and carry **NO
 * resolvable `claim_title` in any capture**. There is therefore no producer
 * statement to map them by, so they stay unmapped and raise nothing — today's
 * behaviour. Reach is not a reason to guess: a shelf saying "your run raised X"
 * about the wrong technique is worse than a shelf saying nothing.
 */
import { describe, it, expect } from 'vitest'
import { methodForRecommendation, methodIdsRaisedBy } from '../recommendationMethod'

/** As received. A RECORD — append, never edit. */
const AS_RECEIVED = [
  { claim: 'DSK-T-001', title: 'Pre-mortem and prospective hindsight', method: 'pre_mortem' },
  { claim: 'DSK-T-002', title: 'Outside view and reference class forecasting', method: 'outside_view' },
  { claim: 'DSK-T-003', title: 'Consider-the-opposite as a debiasing strategy', method: 'consider_opposite' },
] as const

/** Observed in the wild, with NO resolvable claim_title. Must stay unmapped. */
const OBSERVED_BUT_UNMAPPABLE = [
  'DSK-T-004', 'DSK-T-005', 'DSK-B-001', 'DSK-B-003', 'DSK-B-006', 'DSK-B-007',
] as const

const rec = (claim: string) => ({ id: 'strengthen:phase3:b1', signalCode: 'CALIBRATION_PROMPT', dskClaimId: claim })

describe('three techniques share one signal code', () => {
  it.each(AS_RECEIVED)('$claim ($title) resolves to $method', ({ claim, method }) => {
    expect(methodForRecommendation('strengthen:phase3:b', 'CALIBRATION_PROMPT', undefined, claim)?.id).toBe(method)
  })

  /**
   * ⛔⛔ THE DISCRIMINATING SET. All three carry the SAME `signal_code`. If the
   * resolver were reading the code, these would collapse to one answer — and a
   * shelf naming the wrong technique is worse than one naming none.
   */
  it('all three resolve to DIFFERENT methods under one code', () => {
    const ids = AS_RECEIVED.map((r) => methodForRecommendation('strengthen:phase3:b', 'CALIBRATION_PROMPT', undefined, r.claim)?.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual(['pre_mortem', 'outside_view', 'consider_opposite'])
  })

  it('a run raising all three raises all three methods', () => {
    const raised = methodIdsRaisedBy(AS_RECEIVED.map((r) => ({ ...rec(r.claim), id: `strengthen:phase3:${r.claim}` })))
    expect([...raised].sort()).toEqual(['consider_opposite', 'outside_view', 'pre_mortem'])
  })

  /**
   * ⛔ THE FAIL-CLOSED HALF, AND IT IS WHAT KEEPS THIS TABLE HONEST. Six ids
   * occur in the wild with no producer title to map them by. They must raise
   * NOTHING. If someone later adds a row for one of these, this REDs and they
   * have to say what evidence licensed it.
   */
  it.each(OBSERVED_BUT_UNMAPPABLE)('%s occurs in the wild but raises no method', (claim) => {
    expect(methodForRecommendation('strengthen:phase3:x', 'CALIBRATION_PROMPT', undefined, claim)).toBeNull()
  })

  it('case and emptiness are not near-misses', () => {
    expect(methodForRecommendation('strengthen:phase3:x', undefined, undefined, 'dsk-t-003')).toBeNull()
    expect(methodForRecommendation('strengthen:phase3:x', undefined, undefined, '')).toBeNull()
  })

  /**
   * ⚠ PRECEDENCE UNCHANGED. A recommendation-id prefix is more specific than a
   * producer passthrough and must keep winning.
   */
  it('a recommendation-id prefix still wins over the claim id', () => {
    expect(methodForRecommendation('strengthen:robustness', undefined, undefined, 'DSK-T-003')?.id).toBe('pre_mortem')
  })
})
