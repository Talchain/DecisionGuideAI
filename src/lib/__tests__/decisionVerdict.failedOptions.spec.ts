/**
 * `deriveDecisionVerdict` — TWO ways the module authored a leader claim that
 * no measurement supported. Both reproduced by execution at pristine
 * `8915b0e2` before any fix existed.
 *
 * ## Defect 1 — a FAILED option counted as a comparable one
 *
 * The comparable set admitted any FINITE `win_probability`. ISL emits
 * `status: 'failed'` exactly when `n_valid === 0` — zero finite Monte Carlo
 * samples, so there is no distribution and no share behind any number attached
 * to the option — and PLoT forwards a `win_probability: 0` alongside it. Zero
 * is finite, so the failed option entered the comparison and defeated the
 * `comparable.length < 2` guard: a run with ONE genuinely computed option and
 * ONE failed option reached 2 and the module went on to author a leader
 * verdict. Measured at pristine, that run returned
 * `hasLeadingOption: true, separation: 'clear', gapPp: 71` — a seventy-one
 * point "lead" measured against a number ISL had declared to be no
 * measurement at all.
 *
 * ## Defect 2 — an EXACT tie authored a leader, decided by object key order
 *
 * `top1` is the head of a sort on win probability. When the top two are
 * EQUAL there is no argmax: `top1` is whichever key `Object.entries` yielded
 * first. Both producer identity gates key on `top1.id`, so on an exact tie the
 * verdict was decided by insertion order. Measured at pristine, two options at
 * 0.35 each with one producer band naming `opt_a`:
 *
 *   keys {opt_a, opt_b} → hasLeadingOption: true,  separation: 'slight'
 *   keys {opt_b, opt_a} → hasLeadingOption: false, separation: 'unknown'
 *
 * Same data, same producer signal, opposite claims. `hasLeadingOption: true`
 * with `gapPp: 0` reaches `certaintyCopy`'s "{winner} currently leads" — which
 * is the founder's screen: a headline naming a leader over two options the
 * same panel reports as level.
 *
 * ## The shape these tests are written to avoid
 *
 * Both fixes can be bought by suppressing everything, which is a worse defect
 * than the one being fixed (a product that never names a leader is not an
 * improvement on one that names the wrong one). So every suppression assertion
 * here is paired with a DISCRIMINATING TWIN that must still produce the claim,
 * and the pair differs in exactly the property under test. Assertions bind to
 * options by ID, never by a value predicate a different option could satisfy.
 */

import { describe, it, expect } from 'vitest'
import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../decisionVerdict'

// ---------------------------------------------------------------------------
// Identities. Distinct win probabilities per option so that an assertion which
// accidentally bound to a VALUE rather than to an ID would still be pointing at
// one nameable option — and every expectation below names the id.
// ---------------------------------------------------------------------------
const REAL = 'opt_real'
const FAILED = 'opt_failed'
const RIVAL = 'opt_rival'

const REAL_WIN = 0.71
const RIVAL_WIN = 0.29
/**
 * The value PLoT forwards on a failed option. NOT derived from anything this
 * module computes — it is the producer's own fabricated stand-in, and pinning
 * the literal is the point: the defect is that `0` is finite.
 */
const FAILED_WIN = 0

/** A producer near-tie block that names `REAL` and says the run is not a tie. */
const nearTieOnReal = {
  is_tie: false,
  top_option_id: REAL,
  gap: 0.42,
  threshold: 0.1,
}

describe('deriveDecisionVerdict — a FAILED option is not a comparable one', () => {
  it('one computed option + one FAILED option authors NO leader verdict', () => {
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [REAL]: { win_probability: REAL_WIN, status: 'computed' },
        // ISL: status 'failed' ⇔ n_valid === 0. PLoT forwards a finite 0.
        [FAILED]: { win_probability: FAILED_WIN, status: 'failed' },
      },
      robustness: {
        recommended_option_id: REAL,
        near_tie: { ...nearTieOnReal, gap: REAL_WIN - FAILED_WIN },
      },
    }

    const v = deriveDecisionVerdict(report)

    // The entitlement is the assertion that matters: only ONE option was
    // measured, so "leading" has no meaning on this run.
    expect(v.hasLeadingOption).toBe(false)
    // Silence, not a denial. 'tied' would license "no clear leading option",
    // a second claim this run equally cannot support — the module's own
    // fail-toward-silence direction.
    expect(v.separation).toBe('unknown')
    // And no fabricated magnitude: a gap measured against a non-measurement is
    // not a gap. At pristine this was 71.
    expect(v.gapPp).toBeNull()
  })

  it('DISCRIMINATING TWIN — two genuinely computed options DO author a leader verdict', () => {
    // Identical in every respect to the case above EXCEPT the second option's
    // producer status and its win probability. If the fix were bought by
    // suppressing the claim generally, this test REDs.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [REAL]: { win_probability: REAL_WIN, status: 'computed' },
        [RIVAL]: { win_probability: RIVAL_WIN, status: 'computed' },
      },
      robustness: { recommended_option_id: REAL, near_tie: nearTieOnReal },
    }

    const v = deriveDecisionVerdict(report)

    expect(v.hasLeadingOption).toBe(true)
    expect(v.separation).toBe('clear')
    // Bound BY IDENTITY. `REAL_WIN` is also the leader's probability, but the
    // claim under test is "the verdict names THIS option", not "the verdict
    // names an option holding 0.71".
    expect(v.leaderId).toBe(REAL)
    expect(v.source).toBe('producer_near_tie')
  })

  it("'partial' is a DISCLOSURE, not a failure, and stays in the comparison", () => {
    // ISL: 'partial' ⇔ 0 < n_valid/n_total < 0.8. The samples EXIST and ISL
    // emits a full outcome block. A `status !== 'computed'` predicate would
    // swallow this and discard a result ISL honestly computed — which is why
    // the fix binds to the FAILING token, matching the producer's own
    // `isFailedIslOption`.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [REAL]: { win_probability: REAL_WIN, status: 'computed' },
        [RIVAL]: { win_probability: RIVAL_WIN, status: 'partial' },
      },
      robustness: { recommended_option_id: REAL, near_tie: nearTieOnReal },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(true)
    expect(v.leaderId).toBe(REAL)
  })

  it('an ABSENT status stays in the comparison — legacy V1 carries no status field', () => {
    // Absent in ⇒ absent out. Reading silence as failure would suppress a real
    // result; PLoT's own `isCrownableCandidate` treats an absent status as
    // computed and the UI must not classify the same option differently from
    // the service that crowned it.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [REAL]: { win_probability: REAL_WIN },
        [RIVAL]: { win_probability: RIVAL_WIN },
      },
      robustness: { recommended_option_id: REAL, near_tie: nearTieOnReal },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(true)
    expect(v.leaderId).toBe(REAL)
  })

  it('an UNRECOGNISED status token stays in the comparison', () => {
    // The shared contract declares this field a BARE STRING, so a token this
    // UI has never heard of is a legal payload. It narrows to `undefined` and
    // keeps the option on the ordinary path — it must NOT be read as a failure.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [REAL]: { win_probability: REAL_WIN, status: 'computed' },
        [RIVAL]: { win_probability: RIVAL_WIN, status: 'some_future_token' },
      },
      robustness: { recommended_option_id: REAL, near_tie: nearTieOnReal },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(true)
    expect(v.leaderId).toBe(REAL)
  })

  it('the FAILED option is excluded even when it holds the HIGHEST number', () => {
    // The exclusion must be about the producer's STATUS, not about the value
    // being small. A failed option carrying a large fabricated number is the
    // case where a falsiness-based guard (`win_probability` truthy) would let
    // it through AND crown it.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [FAILED]: { win_probability: 0.99, status: 'failed' },
        [REAL]: { win_probability: REAL_WIN, status: 'computed' },
      },
      robustness: {
        recommended_option_id: REAL,
        near_tie: { is_tie: false, top_option_id: FAILED, gap: 0.28, threshold: 0.1 },
      },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
    // And the failed option is never named as the front-runner.
    expect(v.leaderId).not.toBe(FAILED)
  })

  it('three options, one FAILED — the remaining two still compare normally', () => {
    // The exclusion removes ONE option from the set; it does not collapse the
    // run. This is the twin for the length guard specifically: dropping to 2
    // must behave exactly like a 2-option run.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [REAL]: { win_probability: REAL_WIN, status: 'computed' },
        [RIVAL]: { win_probability: RIVAL_WIN, status: 'computed' },
        [FAILED]: { win_probability: FAILED_WIN, status: 'failed' },
      },
      robustness: { recommended_option_id: REAL, near_tie: nearTieOnReal },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(true)
    expect(v.leaderId).toBe(REAL)
    // The gap is measured against the surviving RIVAL, not against the
    // fabricated zero. 0.71 − 0.29 = 42pp, not 71pp.
    expect(v.gapPp).toBe(42)
  })
})

describe('deriveDecisionVerdict — an EXACT tie is not a lead', () => {
  const TIE_WIN = 0.35
  const A = 'opt_a'
  const B = 'opt_b'

  /**
   * Two options at IDENTICAL win probabilities with a producer band naming
   * `A`. Key order is a parameter because it is the thing that used to decide
   * the verdict.
   */
  const tiedPair = (first: string, second: string): DecisionVerdictReportLike => ({
    option_probabilities: {
      [first]: { win_probability: TIE_WIN, status: 'computed' },
      [second]: { win_probability: TIE_WIN, status: 'computed' },
    },
    // No `recommended_option_id`: identity falls to the argmax, which on a tie
    // does not exist. This is the live shape — `mapV5AnalysisToReport`'s
    // robustness keep-list does not carry `near_tie`, so on the mapped-report
    // path the band is the only authority.
    robustness: { recommended_option_id: null },
    decision_brief: { headline_banded: { band: 'slightly_ahead', leader_option_id: A } },
  })

  it('authors NO leader verdict when the top two are exactly equal', () => {
    const v = deriveDecisionVerdict(tiedPair(A, B))
    // At pristine: hasLeadingOption true, separation 'slight', which reaches
    // "{winner} currently leads" beside a panel reporting both at 35%.
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
  })

  it('and the verdict no longer depends on OBJECT KEY ORDER', () => {
    // The decisive pristine measurement: these two returned OPPOSITE
    // entitlements from identical data. Whatever the verdict is, it must be
    // the SAME verdict — this asserts the property, not a particular answer,
    // so it cannot be satisfied by the old behaviour in either direction.
    const forward = deriveDecisionVerdict(tiedPair(A, B))
    const reversed = deriveDecisionVerdict(tiedPair(B, A))

    expect(forward.hasLeadingOption).toBe(reversed.hasLeadingOption)
    expect(forward.separation).toBe(reversed.separation)
    expect(forward.hasLeadingOption).toBe(false)
  })

  it("DISCRIMINATING TWIN — the SMALLEST unequal pair still authors a leader verdict", () => {
    // One unit of difference in the last place the producer can express. If
    // the tie fix had been written as a THRESHOLD rather than as exact
    // equality, this REDs — and a threshold here would be the seventh
    // "too close to call" cutoff this module exists to abolish.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [A]: { win_probability: 0.3501, status: 'computed' },
        [B]: { win_probability: 0.35, status: 'computed' },
      },
      robustness: { recommended_option_id: null },
      decision_brief: { headline_banded: { band: 'slightly_ahead', leader_option_id: A } },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(true)
    expect(v.separation).toBe('slight')
    expect(v.leaderId).toBe(A)
  })

  it("DISCRIMINATING TWIN — the producer's own TIE call still yields 'tied', not silence", () => {
    // The withheld direction must not swallow a denial the producer DID
    // authorise. `separation: 'tied'` is what licenses the honest
    // "no clear leading option" copy; downgrading it to 'unknown' would take
    // a true sentence off the screen and is the over-suppression twin of the
    // defect being fixed.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [A]: { win_probability: TIE_WIN, status: 'computed' },
        [B]: { win_probability: TIE_WIN, status: 'computed' },
      },
      robustness: {
        recommended_option_id: A,
        near_tie: { is_tie: true, top_option_id: A, gap: 0, threshold: 0.1 },
      },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.separation).toBe('tied')
    expect(v.hasLeadingOption).toBe(false)
  })

  it('a tie among the TOP TWO is withheld even when a third option is behind', () => {
    // Separation is measured on the top two. A run whose leaders are level is
    // a tie at the top regardless of how far back the field is.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [A]: { win_probability: 0.45, status: 'computed' },
        [B]: { win_probability: 0.45, status: 'computed' },
        opt_c: { win_probability: 0.1, status: 'computed' },
      },
      robustness: { recommended_option_id: null },
      decision_brief: { headline_banded: { band: 'clearly_ahead', leader_option_id: A } },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
  })

  it('DISCRIMINATING TWIN — a tie for SECOND place does not withhold a real lead', () => {
    // The gate is about the top TWO being level, not about any two options
    // being level. A clear leader over two tied runners-up is a real lead and
    // must survive. Without this twin the fix could have been written as
    // "any duplicate win probability withholds", which would suppress a large
    // class of honest runs.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        [A]: { win_probability: 0.7, status: 'computed' },
        [B]: { win_probability: 0.15, status: 'computed' },
        opt_c: { win_probability: 0.15, status: 'computed' },
      },
      robustness: { recommended_option_id: null },
      decision_brief: { headline_banded: { band: 'clearly_ahead', leader_option_id: A } },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(true)
    expect(v.separation).toBe('clear')
    expect(v.leaderId).toBe(A)
  })
})

describe('deriveDecisionVerdict — the two defects compose', () => {
  it('two computed options at a tie PLUS a failed option: still no claim', () => {
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        opt_a: { win_probability: 0.4, status: 'computed' },
        opt_b: { win_probability: 0.4, status: 'computed' },
        opt_failed: { win_probability: 0.2, status: 'failed' },
      },
      robustness: { recommended_option_id: null },
      decision_brief: { headline_banded: { band: 'slightly_ahead', leader_option_id: 'opt_a' } },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
  })

  it('dropping the failed option can REVEAL a tie that the fabricated value hid', () => {
    // Before the exclusion, the failed option's fabricated 0.9 was `top1` and
    // the two genuine options were never compared with each other at all. This
    // is the case where fixing defect 1 is what makes defect 2 visible.
    const report: DecisionVerdictReportLike = {
      option_probabilities: {
        opt_failed: { win_probability: 0.9, status: 'failed' },
        opt_a: { win_probability: 0.5, status: 'computed' },
        opt_b: { win_probability: 0.5, status: 'computed' },
      },
      robustness: {
        recommended_option_id: null,
        near_tie: { is_tie: false, top_option_id: 'opt_failed', gap: 0.4, threshold: 0.1 },
      },
    }

    const v = deriveDecisionVerdict(report)
    expect(v.hasLeadingOption).toBe(false)
    expect(v.leaderId).not.toBe('opt_failed')
  })
})
