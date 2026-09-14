/**
 * ⭐⭐ THE HERO'S WITHHELD-REASON SLOT READ `reasons[0]` AND PRINTED THE
 * AFFIRMATIVE CONJUNCT — the opposite of the truth, in the one slot whose only
 * job is to make a refusal legible.
 *
 * `heroTypes.ts` states the intent: the withheld headline
 * (`HERO_COPY.headline.noLeader`) "is SILENCE, not a denial, and silence is
 * indistinguishable from an ordinary run. This slot is what makes the refusal
 * legible."
 *
 * `analysis_admission.reasons` is an array of CONJUNCTS and the order is the
 * PRODUCER'S. On a withheld run `reasons[0]` is the affirmative
 * `structurally_analysable` / `READY_TO_COMPARE` — "Analysis can run on this
 * model as it stands" — and the sentence a reader needs sits at `[1]`/`[2]`. So
 * `buildHeroModel.ts:952`'s positional read rendered, under a heading about what
 * the run may NOT conclude:
 *
 *     "Analysis can run on this model as it stands."
 *
 * WIRE-WITNESSED, not derived: driven on `staging--olumi.netlify.app` as a fresh
 * guest on a withheld run, read out of `[data-testid="hero-designation-withheld-reason"]`.
 *
 * ## The fix this file pins
 *
 * Select by `field === 'permitted_analysis_mode'`, never by position, and fall
 * back to `null` — NEVER to another reason. Silence is correct there; the
 * affirmative sentence is not. The shape is copied from
 * `buildAnalysisNewViewModel.ts:1700` (merged as #1404), which already serves it.
 *
 * ## What these tests bind to (CLAUDE.md traps 19, 22)
 *
 * ⚠ THE ASSERTIONS BIND BY `field`, NOT BY MESSAGE TEXT. In the real payload
 * `reasons[1]` and `reasons[2]` carry the IDENTICAL message string, so a
 * message-based assertion passes on the wrong object. The order-invariance pair
 * below is what proves the binding is to `field` and not to a slot.
 *
 * The payload is the live capture, VERBATIM. A hand-written stand-in would
 * encode this author's model of the producer rather than the producer — and the
 * index ordering is the whole point of the defect.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * String assertions over a built model plus a jsdom render. They prove the
 * SELECTION, the WORDING and the absence-path. They do not prove layout, and
 * they say nothing about any surface other than the hero panel.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import {
  PERMITTED_VERDICT,
  WITHHELD_VERDICT,
  withheldFixtureOptions as options,
} from '../../__fixtures__/withheldDesignations.fixtures'

const TESTID = 'hero-designation-withheld-reason'
const PANEL_PROPS = { rerunDisabled: false, focusPanelMounted: false } as const

/**
 * The live capture, verbatim — the SAME payload
 * `analysisNew/__tests__/refusalIsLegible.spec.tsx` embeds, so both surfaces are
 * provably described by one producer observation rather than by two fixtures
 * that can drift apart.
 *
 * Measured on `staging--olumi.netlify.app`, served `103ac4fd`, bundle
 * `index-C5Gildj6.js`, fresh guest, 2026-09-09.
 *
 * ⚠ NOTE THE TWO IDENTICAL MESSAGES at `[1]` and `[2]`. That is why nothing
 * here asserts on message text alone to establish WHICH reason was picked.
 */
const CAPTURED_REFUSAL = {
  structurally_analysable: true,
  missing_important_inputs: [],
  semantic_quality_sufficient: false,
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [
    {
      field: 'structurally_analysable',
      code: 'READY_TO_COMPARE',
      message: 'Analysis can run on this model as it stands.',
    },
    {
      field: 'semantic_quality_sufficient',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
  ],
}

/** The same capture after one factor value was set by the user. Model LICENSES. */
const CAPTURED_PERMITTED = {
  ...CAPTURED_REFUSAL,
  semantic_quality_sufficient: true,
  permitted_analysis_mode: 'comparative_leader',
  reasons: [
    CAPTURED_REFUSAL.reasons[0],
    {
      field: 'semantic_quality_sufficient',
      code: 'CONFIDENCE_PARAMETERS_PARTLY_USER_STATED',
      message:
        'At least one of the estimates this comparison rests on is yours, so a leading option can be named.',
    },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_PARTLY_USER_STATED',
      message:
        'At least one of the estimates this comparison rests on is yours, so a leading option can be named.',
    },
  ],
}

/** The sentence a reader needs — the `permitted_analysis_mode` conjunct. */
const REMEDY = CAPTURED_REFUSAL.reasons[2].message
/** What the positional read rendered instead. The defect, in one string. */
const AFFIRMATIVE = CAPTURED_REFUSAL.reasons[0].message

/**
 * ⚠ THE FIXTURE ANSWERS BOTH CONJUNCTS, exactly as `useResultsSectionData`
 * publishes them. `leaderDesignationPermitted` is
 * `modelLicensesComparativeClaim && resultSeparatesArms`, so omitting the
 * composed field does not exercise the composed arm at all — see the long note
 * in `admissionReason.hero.spec.tsx`, which this mirrors rather than restates.
 */
function heroModel(opts: {
  verdict: typeof WITHHELD_VERDICT
  analysisAdmission?: unknown
  /** Q2 — did this RESULT separate the arms? */
  resultSeparatesArms?: boolean
}): HeroChartModel {
  const admission = opts.analysisAdmission as { permitted_analysis_mode?: string } | undefined
  const q1 = admission == null ? true : admission.permitted_analysis_mode === 'comparative_leader'
  const q2 = opts.resultSeparatesArms ?? opts.verdict.hasLeadingOption === true
  return buildHeroModel(
    makeHeroData({
      options: options(),
      recommendation: {
        verdict: opts.verdict,
        analysisAdmission: opts.analysisAdmission,
        leaderDesignationPermitted: q1 && q2,
        storyHeadlines: {},
      } as NonNullable<Parameters<typeof makeHeroData>[0]>['recommendation'],
    }),
  ) as HeroChartModel
}

/** The withheld-by-Q1 run the slot exists for: model refuses, arms separate. */
const refusedBy = (analysisAdmission: unknown) =>
  heroModel({
    verdict: PERMITTED_VERDICT,
    analysisAdmission,
    resultSeparatesArms: true,
  })

describe('hero withheld reason — selected by FIELD, never by array position', () => {
  it('renders the permitted_analysis_mode conjunct, NOT the affirmative reason at index 0', () => {
    const model = refusedBy(CAPTURED_REFUSAL)

    // PRECONDITIONS PINNED IN-TEST. Without these the assertions below could
    // pass on a model that never refused anything, or on a payload whose
    // index 0 is not actually the affirmative conjunct — in which case the
    // test would be about nothing.
    expect(model.designationsWithheld, 'fixture must reproduce the withheld state').toBe(true)
    expect(
      CAPTURED_REFUSAL.reasons[0].field,
      'the defect requires index 0 to be the affirmative conjunct',
    ).toBe('structurally_analysable')
    expect(CAPTURED_REFUSAL.reasons[2].field).toBe('permitted_analysis_mode')

    expect(model.designationWithheldReason).toBe(REMEDY)
    // THE DEFECT, asserted directly: the slot must not carry the affirmative
    // sentence. This is the string that was live on staging.
    expect(model.designationWithheldReason).not.toBe(AFFIRMATIVE)
  })

  it('renders it in the panel, and the panel never shows the affirmative sentence', () => {
    const model = refusedBy(CAPTURED_REFUSAL)
    expect(model.designationsWithheld).toBe(true)

    const { getByTestId, queryAllByText } = render(
      <AnalysisHeroPanel model={model} {...PANEL_PROPS} />,
    )
    expect(getByTestId(TESTID).textContent).toBe(REMEDY)
    expect(queryAllByText(AFFIRMATIVE)).toHaveLength(0)
  })

  /**
   * ⭐⭐ HALF ONE OF THE DISCRIMINATING PAIR. Neither half alone shows binding:
   * this one proves the selection is not positional, and the next proves the
   * selector did not simply become a scan that takes whatever it finds.
   *
   * Reversed, the `permitted_analysis_mode` conjunct sits at index 0 and the
   * affirmative at index 2 — so a positional reader swaps its answer while a
   * `field` reader does not move. The discrimination is the ORDER-INVARIANCE.
   */
  it('⭐ REORDERED reasons produce the SAME sentence — order-invariant', () => {
    const reversed = { ...CAPTURED_REFUSAL, reasons: [...CAPTURED_REFUSAL.reasons].reverse() }

    // The reordering must actually move the target, or this asserts nothing.
    expect(reversed.reasons[0].field, 'the reversal must move the target off index 2').toBe(
      'permitted_analysis_mode',
    )
    expect(reversed.reasons[2].field).toBe('structurally_analysable')

    const forward = refusedBy(CAPTURED_REFUSAL)
    const backward = refusedBy(reversed)

    expect(backward.designationsWithheld).toBe(true)
    expect(backward.designationWithheldReason).toBe(forward.designationWithheldReason)
    expect(backward.designationWithheldReason).toBe(REMEDY)
  })

  /**
   * ⭐⭐ HALF TWO OF THE DISCRIMINATING PAIR, and the rule the brief is firm on:
   * FALL BACK TO `null`, NEVER TO ANOTHER REASON.
   *
   * With the `permitted_analysis_mode` conjunct removed, the array still holds
   * two perfectly renderable sentences — one of them the affirmative. Any
   * implementation that reaches for `[0]`, or for "the first reason that has a
   * message", renders a falsehood here. Silence is the correct answer.
   */
  it('⭐ says NOTHING when the permitted_analysis_mode conjunct is ABSENT', () => {
    const withoutTarget = {
      ...CAPTURED_REFUSAL,
      reasons: CAPTURED_REFUSAL.reasons.filter((r) => r.field !== 'permitted_analysis_mode'),
    }
    // Preconditions: the target is gone AND other reasons remain, so a
    // fallback-to-another-reason implementation has something to render.
    expect(withoutTarget.reasons.some((r) => r.field === 'permitted_analysis_mode')).toBe(false)
    expect(withoutTarget.reasons.length, 'other reasons must remain for this to discriminate')
      .toBeGreaterThan(0)

    const model = refusedBy(withoutTarget)
    expect(model.designationsWithheld, 'the run must still be withheld').toBe(true)
    expect(model.designationWithheldReason).toBeNull()

    const { queryByTestId } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)
    expect(queryByTestId(TESTID)).toBeNull()
  })

  /**
   * ⭐⭐ THE CELL THAT DISCRIMINATES THE GATE. Without it, swapping the gate for
   * `leaderDesignationPermitted(rec) !== true` survives the entire battery —
   * measured on #1404, where exactly this mutant survived until this case existed.
   *
   * `leaderDesignationPermitted` is `modelLicensesComparativeClaim &&
   * resultSeparatesArms`, so its falsity has TWO causes. Here the model LICENSED
   * (`comparative_leader`) and the arms did not separate. A gate keyed on the
   * composed field renders here — and what it renders is the PERMITTED
   * admission's sentence, "a leading option can be named", under a heading about
   * what the run may NOT conclude. That is a model refusal the producer never made.
   */
  it('⭐ says NOTHING when the model LICENSED but the arms did not separate', () => {
    const model = heroModel({
      verdict: WITHHELD_VERDICT,
      analysisAdmission: CAPTURED_PERMITTED,
      resultSeparatesArms: false,
    })

    // Preconditions pinned in-test: composed withheld, model licensing, and a
    // renderable permitted_analysis_mode message sitting right there.
    expect(model.designationsWithheld, 'the run withholds — via Q2').toBe(true)
    expect(CAPTURED_PERMITTED.permitted_analysis_mode).toBe('comparative_leader')
    expect(
      CAPTURED_PERMITTED.reasons.find((r) => r.field === 'permitted_analysis_mode')?.message.length,
      'a message must be present, or this cell cannot discriminate',
    ).toBeGreaterThan(0)

    expect(model.designationWithheldReason).toBeNull()
    const { queryByTestId } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)
    expect(queryByTestId(TESTID)).toBeNull()
  })

  it('says NOTHING when there is no admission at all', () => {
    // ⚠ ABSENCE IS NOT A REFUSAL. `ceeAnalysisReady` is nulled by
    // `invalidateAnalysisReady` on every analytical edit, so this state is
    // reached on the user's own keystroke.
    const model = heroModel({ verdict: WITHHELD_VERDICT, analysisAdmission: undefined })
    expect(model.designationsWithheld).toBe(true)
    expect(model.designationWithheldReason).toBeNull()
    const { queryByTestId } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)
    expect(queryByTestId(TESTID)).toBeNull()
  })
})
