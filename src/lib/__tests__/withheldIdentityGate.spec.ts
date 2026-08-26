/**
 * S8b — A STRIPPED LEADER IDENTITY MEANS "WITHHELD", NEVER "NO PREFERENCE".
 *
 * THE DEFECT, PROVEN BY EXECUTION BEFORE THE FIX. CEE's withheld projection is
 * documented "KEEP THE FACT, DROP THE IDENTITIES": on a withheld turn it drops
 * `near_tie.top_option_id` (and `recommended_option_id`, and
 * `decision_brief.headline_banded`) while `is_tie` and `gap` ship unchanged.
 * `deriveDecisionVerdict`'s identity gate read
 *
 *     nearTie != null && (nearTie.topOptionId == null || nearTie.topOptionId === top1.id)
 *
 * ⭐⭐ and that `== null` branch — written to let a producer stay SILENT about
 * which option is on top — turned CEE's deliberate act of withholding into a
 * PERMISSIVE WILDCARD. Stripping the identity SATISFIED the gate, `is_tie:false`
 * then reached the "a leading option exists" branch, and the UI named a leader
 * on the exact payload CEE had just withheld. THE ACT OF WITHHOLDING LICENSED
 * THE CLAIM.
 *
 * ## Why a positive identity match cannot over-suppress
 *
 * The inverse harm — trading a false claim for a false silence — was settled
 * before this changed, on three independent lines that agree:
 *
 *  1. PRODUCER (PLoT `3a3bee58`, `routes/v2/run.ts:2045`). `computeNearTie`
 *     returns `NearTieInfoV3 | undefined`: every non-undefined exit sets
 *     `top_option_id`. Its sole attachment site (`:3634`) assigns the block
 *     WHOLE or omits it. No partial shape exists in the producer, and PLoT
 *     never deletes the member from an existing block.
 *  2. CONTRACT (`@talchain/schemas` 0.40.0, `boundary/enrichment.js`).
 *     `EnrichmentNearTieSchema` declares `top_option_id: z.string()` —
 *     REQUIRED. The BLOCK is `.optional()`; the MEMBER is not.
 *  3. CAPTURES. Three real dated captures in this repo carry all six keys
 *     including the identity — `golden-path-staging-2026-04-05.json` (at BOTH
 *     the `plot_response` and `cee_request` boundaries, so it survives the
 *     hop), `seeded-2026-08-17-w2d-analysis-turn.json`, and
 *     `conditional-winners-2026-08-17-probe-A.json`. Their `is_tie` values
 *     differ, so the observation discriminates rather than reporting sameness.
 *
 * ⭐ So a `near_tie` WITHOUT `top_option_id` is CONTRACT-INVALID. It cannot come
 * from the producer; it can only be the footprint of a downstream stripper, and
 * the only stripper is CEE's withheld projection. Requiring a positive match is
 * therefore not a heuristic — the gate now reads exactly "did CEE withhold?".
 */

import { describe, it, expect } from 'vitest'

import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../decisionVerdict'

const HIRE = 'opt_hire'
const HOLD = 'opt_hold'

const OPTION_PROBABILITIES = {
  [HIRE]: { win_probability: 0.66 },
  [HOLD]: { win_probability: 0.22 },
}

/**
 * CEE's ACTUAL withheld bytes — not this lane's model of them.
 *
 * ⚠ Transcribed from CEE's own drift test
 * (`compose/__tests__/withheld-structured-designation.drift.test.ts`), which
 * asserts on the projection's output: `near_tie.top_option_id` → `undefined`
 * (:285) while `near_tie.is_tie` → `false` (:294) and `near_tie.gap` → `0.44`
 * (:295) survive, and `recommended_option_id` → `undefined` (:283).
 *
 * ⭐ This is the shape the sibling fixture `withheldDesignations.fixtures.ts`
 * got WRONG IN BOTH DIRECTIONS — it carries a `recommended_option_id` CEE drops
 * and omits the `near_tie` CEE keeps — which is why a whole withheld suite was
 * green about a payload the product never sends.
 */
const CEE_WITHHELD_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: {
    near_tie: { is_tie: false, gap: 0.44, threshold: 0.1 },
  },
  decision_brief: {
    top_drivers: [{ factor_label: 'Three-Year Total Cost of Ownership' }],
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}

/** The SAME run PERMITTED — the over-suppression control (identity present). */
const CEE_PERMITTED_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: {
    recommended_option_id: HIRE,
    near_tie: { is_tie: false, gap: 0.44, threshold: 0.1, top_option_id: HIRE },
  },
  decision_brief: {
    top_drivers: [{ factor_label: 'Three-Year Total Cost of Ownership' }],
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}

describe('S8b — a stripped leader identity is WITHHELD, not silence', () => {
  it('WITHHELD: CEE-stripped near_tie must NOT license a leading option', () => {
    const verdict = deriveDecisionVerdict(CEE_WITHHELD_REPORT)

    // The entitlement is the whole point: every leader surface gates on this.
    expect(verdict.hasLeadingOption).toBe(false)
    // Fail toward SILENCE, not toward a denial. `tied` would license "no clear
    // leading option" — a second claim we equally have no authority for.
    expect(verdict.separation).toBe('unknown')
    expect(verdict.source).toBe('none')
  })

  it('IDENTITY SURVIVES: withholding the entitlement must not blind the non-claiming consumers', () => {
    // decisionVerdict's own doctrine: identity and entitlement are different
    // questions. Ordering, focus and the decision record must keep working.
    const verdict = deriveDecisionVerdict(CEE_WITHHELD_REPORT)
    expect(verdict.leaderId).toBe(HIRE)
    expect(verdict.gapPp).toBe(44)
  })

  it('OVER-SUPPRESSION CONTROL: the SAME run with the identity present still names the leader', () => {
    // ⭐ Without this, the fix above would pass identically if the gate had been
    // broken outright to always withhold — which is the opposite harm and just
    // as dishonest. Settled at the producer, the contract and three captures:
    // a permitted turn ALWAYS carries `top_option_id`.
    const verdict = deriveDecisionVerdict(CEE_PERMITTED_REPORT)
    expect(verdict.hasLeadingOption).toBe(true)
    expect(verdict.separation).toBe('clear')
    expect(verdict.leaderId).toBe(HIRE)
    expect(verdict.source).toBe('producer_near_tie')
  })

  it('TIE IS STILL HONOURED when the producer names the option it is talking about', () => {
    // The producer's own TIE call must survive the tightened gate: `is_tie:true`
    // with a matching identity still yields the honest "no clear leader".
    const verdict = deriveDecisionVerdict({
      option_probabilities: OPTION_PROBABILITIES,
      robustness: { near_tie: { is_tie: true, gap: 0.02, top_option_id: HIRE } },
    } as DecisionVerdictReportLike)
    expect(verdict.separation).toBe('tied')
    expect(verdict.hasLeadingOption).toBe(false)
    expect(verdict.source).toBe('producer_near_tie')
  })

  it('IDENTITY MISMATCH is still refused (the recovered-session hazard is unchanged)', () => {
    // A producer claim about option X must never be re-pointed at option Y.
    // This behaviour predates the change and must survive it.
    const verdict = deriveDecisionVerdict({
      option_probabilities: OPTION_PROBABILITIES,
      robustness: { near_tie: { is_tie: false, gap: 0.44, top_option_id: HOLD } },
    } as DecisionVerdictReportLike)
    expect(verdict.hasLeadingOption).toBe(false)
    expect(verdict.separation).toBe('unknown')
  })
})
