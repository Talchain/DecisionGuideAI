/**
 * ONE ELIGIBILITY AUTHORITY — the leader VERDICT and the RENDERED leader
 * IDENTITY must not be gated by two different pieces of code.
 *
 * ## The defect, measured at `f11432c5`
 *
 * `deriveDecisionVerdict` had been taught to drop an option ISL classified
 * `'failed'` (`n_valid === 0` — zero finite Monte Carlo samples, so the finite
 * `win_probability: 0` PLoT forwards beside it is a fabricated stand-in).
 * `determineWinnerSelection` — which chooses the leader the panel actually
 * RENDERS — had not, and it re-selected from whatever numeric artefacts were
 * present:
 *
 *     [{ id: 'good',   winProbability: 0.4, computeStatus: 'computed' },
 *      { id: 'failed', winProbability: 0.9, computeStatus: 'failed' }]
 *       -> { recommendedId: 'failed', determinedBy: 'win_probability' }
 *
 * The product crowned the failed option **and reported that the answer came
 * from win probability**, on a number that is not a measurement. It did so on
 * the argmax path AND when the backend recommendation named the option
 * explicitly.
 *
 * ⚠⚠ PLoT had already refused to crown it: `isCrownableCandidate`
 * (`src/routes/v2/run.ts:1976`) is an allowlist on `status === 'computed'`.
 * The producer fails CLOSED; the UI failed OPEN. That is strictly worse than
 * either posture alone, because the surface overrides a refusal the service
 * that owns crowning has already made.
 *
 * ## What these tests bind to
 *
 * The two call sites must reach ONE decision through ONE function
 * (`optionEligibleToLead`). A test that only checked "the failed option is not
 * crowned" would pass equally well against a second, locally-respelled
 * `!== 'failed'` check — and the drift between two spellings IS the defect. So
 * the agreement between the two authorities is asserted directly, over a
 * matrix of statuses, rather than inferred from one example.
 */

import { describe, it, expect } from 'vitest'
import { deriveDecisionVerdict } from '../decisionVerdict'
import { determineWinnerSelection } from '../../components/results/useResultsSectionData'
import {
  optionEligibleToLead,
  OPTION_COMPUTE_STATUSES,
} from '../../adapters/plot/optionComputeStatus'
import type { OptionResult } from '../../components/results/types'

const GOOD = 'opt_good'
const FAILED = 'opt_failed'

/** Minimal `OptionResult`s — only the fields winner selection reads. */
const option = (
  id: string,
  winProbability: number,
  computeStatus?: string,
): OptionResult =>
  ({
    id,
    label: id,
    winProbability,
    ...(computeStatus !== undefined ? { computeStatus } : {}),
  }) as unknown as OptionResult

describe('the RENDERED leader identity refuses an option the producer never computed', () => {
  it('the argmax does not crown a FAILED option, even holding the highest number', () => {
    // 0.9 vs 0.4: the failed option wins every value-based comparison. Only its
    // producer status distinguishes it, which is the entire point of the field.
    const r = determineWinnerSelection(
      [option(GOOD, 0.4, 'computed'), option(FAILED, 0.9, 'failed')],
      null,
    )
    expect(r.recommendedId).toBe(GOOD)
    // ⭐ AND THE PROVENANCE MUST BE HONEST. `determinedBy` is user-facing copy.
    // At f11432c5 this said 'win_probability' about a fabricated number.
    expect(r.determinedBy).toBe('win_probability')
  })

  it('FAILS CLOSED when the BACKEND recommendation names the failed option', () => {
    // The short-circuit branch: at f11432c5 it returned the backend id without
    // ever consulting eligibility, so an explicit recommendation was the one
    // path that could still crown a failed option after the argmax was fixed.
    const r = determineWinnerSelection(
      [option(GOOD, 0.4, 'computed'), option(FAILED, 0.9, 'failed')],
      FAILED,
    )
    expect(r.recommendedId).not.toBe(FAILED)
    expect(r.recommendedId).toBeNull()
    expect(r.determinedBy).toBe('unknown')
  })

  it('DISCRIMINATING TWIN — a backend recommendation naming an ELIGIBLE option still stands', () => {
    // Differs from the case above in exactly one field: which option is named.
    // Without this, the fix could be bought by ignoring the backend entirely.
    const r = determineWinnerSelection(
      [option(GOOD, 0.4, 'computed'), option(FAILED, 0.9, 'failed')],
      GOOD,
    )
    expect(r.recommendedId).toBe(GOOD)
    expect(r.determinedBy).toBe('win_probability')
  })

  it('DISCRIMINATING TWIN — two computed options: the higher one is still crowned', () => {
    const r = determineWinnerSelection(
      [option(GOOD, 0.4, 'computed'), option('opt_rival', 0.9, 'computed')],
      null,
    )
    expect(r.recommendedId).toBe('opt_rival')
    expect(r.determinedBy).toBe('win_probability')
  })

  it("DISCRIMINATING TWIN — 'partial' is a disclosure and can still be crowned", () => {
    // ⛔ The over-suppression twin. `'partial'` means 0 < n_valid/n_total < 0.8:
    // the samples EXIST and ISL emits a full outcome block. Tightening this to
    // PLoT's `=== 'computed'` allowlist would discard results ISL honestly
    // computed. That divergence is ROWED, not closed here — this test pins the
    // current, deliberate posture so a later tightening is a visible decision
    // rather than a silent one.
    const r = determineWinnerSelection(
      [option(GOOD, 0.4, 'computed'), option('opt_partial', 0.9, 'partial')],
      null,
    )
    expect(r.recommendedId).toBe('opt_partial')
  })

  it('DISCRIMINATING TWIN — an ABSENT status can still be crowned (legacy V1)', () => {
    // ISL's V1 `OptionResult` has no `status` field at all. Reading silence as
    // failure would suppress every legacy option on this surface.
    const r = determineWinnerSelection([option(GOOD, 0.4), option('opt_x', 0.9)], null)
    expect(r.recommendedId).toBe('opt_x')
  })

  it('every option ineligible ⇒ no leader is named and the provenance says so', () => {
    const r = determineWinnerSelection(
      [option(GOOD, 0.4, 'failed'), option(FAILED, 0.9, 'failed')],
      null,
    )
    expect(r.recommendedId).toBeNull()
    expect(r.determinedBy).toBe('unknown')
  })
})

describe('the verdict and the rendered identity consult the SAME authority', () => {
  /**
   * The agreement itself, over every status the producer's closed vocabulary
   * admits PLUS the two out-of-vocabulary cases the shared contract permits
   * (it declares this field a bare string). A second, locally-respelled
   * predicate at either call site would show up here as a disagreement on at
   * least one row — which a single-example test could not see.
   */
  const STATUSES: readonly (string | undefined)[] = [
    ...OPTION_COMPUTE_STATUSES,
    undefined,
    'some_future_token',
  ]

  it.each(STATUSES.map((s) => [String(s)] as const))(
    'status %s: the verdict and the winner selector agree on eligibility',
    (raw) => {
      const status = raw === 'undefined' ? undefined : raw

      // The authority's own answer, and the two consumers' observable answers.
      const eligible = optionEligibleToLead(status)

      // (1) The VERDICT. One option under test plus one always-eligible rival.
      // If the option under test is eligible there are two comparable options
      // and the producer's near-tie call applies; if not, only one remains and
      // "leading" has no meaning, so the verdict withholds.
      const verdict = deriveDecisionVerdict({
        option_probabilities: {
          [GOOD]: { win_probability: 0.8, status: 'computed' },
          probe: { win_probability: 0.2, ...(status !== undefined ? { status } : {}) },
        },
        robustness: {
          recommended_option_id: GOOD,
          near_tie: { is_tie: false, top_option_id: GOOD, gap: 0.6, threshold: 0.1 },
        },
      })

      // (2) The RENDERED IDENTITY. The option under test holds the higher
      // number, so it is crowned exactly when it is eligible.
      const selection = determineWinnerSelection(
        [option(GOOD, 0.2, 'computed'), option('probe', 0.8, status)],
        null,
      )

      expect(verdict.hasLeadingOption, `verdict, status=${raw}`).toBe(eligible)
      expect(selection.recommendedId === 'probe', `identity, status=${raw}`).toBe(eligible)

      // ⭐ The load-bearing assertion: whatever the answer is, it is the SAME
      // answer. This is what a locally-respelled second predicate would break.
      expect(
        selection.recommendedId === 'probe',
        `the two authorities disagree on status=${raw}`,
      ).toBe(verdict.hasLeadingOption)
    },
  )

  it('CONTROL — the matrix above is not vacuous: it contains both answers', () => {
    // Without this, a bug making `optionEligibleToLead` constant would leave
    // every row of the matrix trivially self-consistent (CLAUDE.md trap 20: a
    // per-item probe returning the same answer for every item is reporting on
    // itself).
    const answers = new Set(STATUSES.map((s) => optionEligibleToLead(s)))
    expect(answers).toEqual(new Set([true, false]))
    expect(optionEligibleToLead('failed')).toBe(false)
  })
})
