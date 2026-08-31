/**
 * OptionCards — an option the analysis RAN ON and could not compute renders as
 * NOT COMPUTED, not as a measured `0%`.
 *
 * ## The defect, and why `0%` was the worst possible render
 *
 * ISL classifies each option: `'failed'` ⇔ `n_valid === 0`, i.e. ZERO finite
 * Monte Carlo samples, so there is no distribution behind any number attached
 * to the option. PLoT forwards that per option. Both UI mappers dropped it, so
 * the card fell through to the ranked path, where `winProbability` is a finite
 * `0` — producing a hard `0%` and a zero-width fill bar in the slot that
 * answers *"how often did this option come out ahead"*, beside a rank swatch and
 * an ordinal. In the same run a GENUINE measured zero at n=10,000 renders
 * `"<0.01%"`. The two were distinguishable only by an accident of which
 * fallback arm a missing sample count happened to take.
 *
 * ## ⭐ TWO DIRECTIONS, AND NEITHER IS OPTIONAL (CLAUDE.md trap 22b)
 *
 * A guard against a fabricated zero and a guard against a suppressed real
 * result watch OPPOSITE doors, and a fix that only closes one trades a silent
 * falsehood for a silent falsehood:
 *
 *   · SUPPRESSION direction — a `'failed'` option must NOT render a share.
 *   · SURVIVAL direction — a `'computed'` option whose win probability is a
 *     GENUINE `0.0` must STILL render its measured readout (`"<0.01%"` when the
 *     run's resolution is known, `"0%"` when it is not — both are measurements
 *     and both are pinned below); an option with an ABSENT status (the legacy V1
 *     shape) must stay entirely on the ordinary path; and a `'partial'` option —
 *     a DISCLOSURE with a real distribution behind it — must stay there too.
 *
 * Every case below has its opposite-direction twin IN THE SAME RENDER, so a
 * predicate that suppressed everything and a predicate that suppressed nothing
 * both RED here. A file containing only the failed twins would be green for
 * either.
 *
 * ## Binding (trap 19)
 *
 * Every query binds by ID — `option-card-not-computed-<id>`, `win-pct-<id>`,
 * `rank-marker-<id>` — never by a value predicate another card could satisfy.
 * The fixture deliberately gives two different options the SAME `0`
 * win probability, one failed and one computed, so a test that found "the
 * card showing 0%" by value rather than by identity could not tell them apart.
 *
 * ## Deployed-flag posture (trap 3b)
 *
 * `OptionCards` is mounted from `ResultsBody` with NO feature-flag gate (only
 * `!isSingleOption && allOptions.length > 1`), and `ResultsBody` is the Analysis
 * tab body mounted from `OutputsDock`. This is the surface staging renders on
 * every flag posture — the same mount `OptionCards.notAnalysed.spec.tsx` relies
 * on, whose path is asserted by `ResultsBody.notAnalysedMountPath.spec.tsx`.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { NOT_ANALYSED_BADGE, NOT_COMPUTED_BADGE } from '../utils/notAnalysedCopy'
import type { OptionResult } from '../types'

const FAILED = 'opt-failed'
const COMPUTED_TRUE_ZERO = 'opt-computed-true-zero'
const COMPUTED_HEALTHY = 'opt-computed-healthy'
const PARTIAL = 'opt-partial'
const LEGACY_NO_STATUS = 'opt-legacy-no-status'

function base(id: string, overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id,
    label: `Option ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability: 0.4,
    goalProbability: 0.55,
    nValidSamples: 10000,
    computeStatus: 'computed',
    ...overrides,
  }
}

/**
 * Exactly the shape the hook produces for a FAILED option, derived from the
 * producer rather than invented:
 *
 *  · `computeStatus: 'failed'` — ISL's own token.
 *  · `winProbability: 0` — FINITE, because PLoT emits `win_probability` whenever
 *    `prob01(...)` accepts it and `0` is in `[0,1]`. This is the whole reason the
 *    absence rules elsewhere on this surface cannot help: it is not an absence.
 *  · `nValidSamples: undefined` — NOT an oversight. The mapper's
 *    `positiveIntegerOrNull` guard REJECTS `0`, so on the one option where
 *    `n_valid === 0` is the defining fact, the count arrives absent. It is why
 *    the sample count is not a substitute for the status.
 *  · null percentiles — `n_valid === 0` means there is no distribution to take
 *    them from.
 */
function failedOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: FAILED,
    label: 'Migrate to Salesforce',
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    winProbability: 0,
    computeStatus: 'failed',
    ...overrides,
  }
}

/**
 * The OPPOSITE-DIRECTION TWIN: a fully computed option that genuinely never came
 * out ahead. Same `winProbability: 0` as the failed option, same rendered slot —
 * and it MUST keep its readout, because a measured zero IS a measurement. This
 * twin is what stops the fix trading a fabricated number for a suppressed one.
 *
 * ⚠ Its readout is `"<0.01%"`, not `"0%"`: it carries `nValidSamples`, so
 * `formatProbabilityWithResolution` floors at the run's own resolution. The
 * `"0%"` render is the SAME quantity with no count to floor against, and the
 * second survival test below pins that arm separately — the two are the whole
 * reason a failed option and a genuine zero were indistinguishable on screen.
 */
function computedTrueZero(): OptionResult {
  return base(COMPUTED_TRUE_ZERO, {
    label: 'Status Quo',
    winProbability: 0,
    nValidSamples: 10000,
    computeStatus: 'computed',
  })
}

/**
 * The full field. `hasLeadingOption` is TRUE on purpose: on a WITHHELD run the
 * ranked chrome is suppressed for every card, so the absence assertions below
 * would pass without the fix and this file would be a tautology (trap 13b).
 */
function renderField(options: OptionResult[]) {
  return render(
    <OptionCards options={options} hasLeadingOption={true} hasGoalThreshold={true} />,
  )
}

describe('OptionCards — SUPPRESSION direction: a failed option asserts nothing', () => {
  it('renders the not-computed card instead of a ranked card', () => {
    renderField([base(COMPUTED_HEALTHY, { winProbability: 0.6 }), failedOption()])
    expect(screen.getByTestId(`option-card-not-computed-${FAILED}`)).toBeInTheDocument()
    // The CONTRAST CONTROL in the same render: the sibling DID get a ranked
    // card. Without it, a suite that cannot see any card at all would look
    // identical to a suite watching the fix work (trap 13e).
    expect(screen.getByTestId(`option-card-${COMPUTED_HEALTHY}`)).toBeInTheDocument()
    expect(
      screen.queryByTestId(`option-card-not-computed-${COMPUTED_HEALTHY}`),
    ).not.toBeInTheDocument()
  })

  it('renders NO win percentage for the failed option, while the sibling keeps its own', () => {
    renderField([base(COMPUTED_HEALTHY, { winProbability: 0.6 }), failedOption()])
    expect(screen.queryByTestId(`win-pct-${FAILED}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`win-pct-${COMPUTED_HEALTHY}`)).toBeInTheDocument()
  })

  it('renders NO rank marker for the failed option, while the sibling keeps its own', () => {
    renderField([base(COMPUTED_HEALTHY, { winProbability: 0.6 }), failedOption()])
    expect(screen.queryByTestId(`rank-marker-${FAILED}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`rank-marker-${COMPUTED_HEALTHY}`)).toBeInTheDocument()
  })

  it('says WHY, and the sentence does not read as "this option lost"', () => {
    renderField([base(COMPUTED_HEALTHY), failedOption()])
    const reason = screen.getByTestId(`not-computed-reason-${FAILED}`)
    // The producer's claim, the consequence, and the non-verdict — each pinned
    // as a substring rather than the whole string, so a copy edit that keeps
    // all three intact does not RED, and one that drops any of them does.
    expect(reason).toHaveTextContent('ran on this option')
    expect(reason).toHaveTextContent('could not produce a usable result')
    expect(reason).toHaveTextContent('no rank and no probability')
    expect(reason).toHaveTextContent('not a verdict on the option')
  })

  it('carries the NOT-COMPUTED badge, never the NOT-ANALYSED one', () => {
    // ⚠ THE ATTRIBUTION PIN. "Not analysed" would blame the user's
    // configuration for an engine outcome — the option WAS analysed. This is
    // the assertion that keeps the two numberless states from collapsing into
    // one (trap 21).
    renderField([base(COMPUTED_HEALTHY), failedOption()])
    expect(screen.getByTestId(`not-computed-badge-${FAILED}`)).toHaveTextContent(
      NOT_COMPUTED_BADGE,
    )
    expect(screen.queryByText(NOT_ANALYSED_BADGE)).not.toBeInTheDocument()
  })

  it('appends the PRODUCER’s reason when it sent one, and stands alone when it did not', () => {
    // The absent arm is the one every live capture takes — `status_reason` is
    // absent from all twelve — so it is asserted first and on its own.
    const { unmount } = renderField([base(COMPUTED_HEALTHY), failedOption()])
    expect(screen.getByTestId(`not-computed-reason-${FAILED}`)).toHaveTextContent(
      'not a verdict on the option',
    )
    unmount()

    renderField([
      base(COMPUTED_HEALTHY),
      failedOption({ computeStatusReason: 'Blocked by: DEGENERATE_DISTRIBUTION' }),
    ])
    const withReason = screen.getByTestId(`not-computed-reason-${FAILED}`)
    // Added to the sanctioned sentence, never substituted for it.
    expect(withReason).toHaveTextContent('not a verdict on the option')
    expect(withReason).toHaveTextContent('Blocked by: DEGENERATE_DISTRIBUTION')
  })
})

describe('OptionCards — SURVIVAL direction: a real result is never suppressed', () => {
  it('a COMPUTED option with a genuine 0.0 still renders a measured readout and a rank', () => {
    // ⭐ THE TWIN THAT MAKES THE FIX MEAN SOMETHING. Same `winProbability: 0`
    // as the failed option, same slot — and it keeps its readout, because a
    // measured zero IS a measurement. A predicate written against falsiness
    // rather than against the producer's token would delete this card, and every
    // suppression test above would still be green.
    //
    // ⚠ THE READOUT IS `"<0.01%"`, NOT `"0%"`, AND THAT IS THE POINT OF THE
    // WHOLE CHANGE. `formatProbabilityWithResolution(0, 10000)` floors at the
    // simulation's own resolution, so a genuine zero at n=10,000 reads
    // `"<0.01%"`. Before the status was carried, a FAILED option — whose
    // `nValidSamples` arrives `undefined` because the mapper's positive-integer
    // guard rejects `0` — took the legacy arm and rendered a hard `"0%"`. So
    // the two were distinguishable on screen only by an accident of which arm a
    // missing sample count happened to take. Asserting the exact string here is
    // what pins that the honest one survives.
    renderField([base(COMPUTED_HEALTHY, { winProbability: 0.6 }), computedTrueZero()])
    expect(
      screen.queryByTestId(`option-card-not-computed-${COMPUTED_TRUE_ZERO}`),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId(`win-pct-${COMPUTED_TRUE_ZERO}`)).toHaveTextContent('<0.01%')
    expect(screen.getByTestId(`rank-marker-${COMPUTED_TRUE_ZERO}`)).toBeInTheDocument()
  })

  it('a COMPUTED option with a genuine 0.0 AND NO sample count still renders 0%', () => {
    // The other survival sub-case, and the one the brief names literally: with
    // no resolution to floor against, the formatter's documented behaviour is
    // that an exact zero reads `"0%"` — "came out ahead in 0% of simulated
    // scenarios" is TRUE when the option never came out ahead. That render must
    // survive too, so the fix cannot be "suppress anything showing 0%".
    const zeroNoCount = computedTrueZero()
    delete (zeroNoCount as { nValidSamples?: number }).nValidSamples
    renderField([base(COMPUTED_HEALTHY, { winProbability: 0.6 }), zeroNoCount])
    expect(
      screen.queryByTestId(`option-card-not-computed-${COMPUTED_TRUE_ZERO}`),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId(`win-pct-${COMPUTED_TRUE_ZERO}`)).toHaveTextContent('0%')
  })

  it("a PARTIAL option is a DISCLOSURE, not a failure, and keeps its card", () => {
    // ⛔ `'partial'` means `0 < n_valid/n_total < 0.8`: the samples EXIST and ISL
    // emits a full outcome block. A `status !== 'computed'` predicate would
    // swallow it and discard results ISL honestly computed — the reason the
    // predicate is written against the FAILING token.
    renderField([
      base(COMPUTED_HEALTHY, { winProbability: 0.6 }),
      base(PARTIAL, { computeStatus: 'partial', winProbability: 0.25, nValidSamples: 4000 }),
    ])
    expect(screen.queryByTestId(`option-card-not-computed-${PARTIAL}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`win-pct-${PARTIAL}`)).toBeInTheDocument()
  })

  it('an ABSENT status implies nothing and stays on the ordinary path', () => {
    // ⛔ The legacy V1 shape — ISL's V1 `OptionResult` has no status field at
    // all — and also what both mappers produce for a token outside the
    // producer's vocabulary. Reading silence as failure would suppress a real
    // result and tell the user their option could not be computed when it was.
    const legacy = base(LEGACY_NO_STATUS, { winProbability: 0.3 })
    delete (legacy as { computeStatus?: unknown }).computeStatus
    renderField([base(COMPUTED_HEALTHY, { winProbability: 0.6 }), legacy])
    expect(
      screen.queryByTestId(`option-card-not-computed-${LEGACY_NO_STATUS}`),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId(`win-pct-${LEGACY_NO_STATUS}`)).toBeInTheDocument()
  })

  it('a failed option does NOT delete the goal bar from the options that WERE scored', () => {
    // The `every`-quantifier defect one status along: `showHitsTarget` is an
    // `every` over the options in the comparison, and a failed option carries no
    // `goalProbability`, so leaving it in the set would delete "Hits target"
    // from every card that WAS scored — a real regression in what the user can
    // see about options the run computed fine.
    renderField([
      base(COMPUTED_HEALTHY, { winProbability: 0.6 }),
      base(COMPUTED_TRUE_ZERO, { winProbability: 0.4 }),
      failedOption(),
    ])
    expect(screen.getByTestId(`goal-readout-${COMPUTED_HEALTHY}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`goal-readout-${FAILED}`)).not.toBeInTheDocument()
  })
})
