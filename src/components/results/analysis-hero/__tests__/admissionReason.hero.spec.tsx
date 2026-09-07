/**
 * WHY NO LEADER WAS NAMED — the hero says it, instead of going silent.
 *
 * ## The defect being closed
 *
 * On a run whose model does not license a comparative claim, the hero
 * correctly withholds every designation and headlines the neutral
 * "Here is how your options compare." That refusal is right, and it is
 * INDISTINGUISHABLE from an ordinary run: nothing on screen tells the user a
 * refusal happened, or what would change it.
 *
 * CEE already sends the sentence. `analysis_admission.reasons[].message` is
 * typed on `AnalysisAdmissionReason` as "User-facing sentence. By contract
 * `reasons` is NEVER empty on a refusal", `useResultsSectionData` already
 * carries it onto `recommendation.analysisAdmission`, and — before this
 * change — nothing read it.
 *
 * ## What these tests bind to
 *
 * The sentence is bound by IDENTITY: a unique sentinel string compared with
 * `toBe`, never a substring another string could satisfy. Every case also
 * PINS ITS OWN PRECONDITION (`designationsWithheld`), so a fixture that stops
 * reproducing the withheld state fails loudly instead of passing vacuously.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * String assertions over a built model, plus a jsdom render. They prove the
 * WORDING, the PRESENCE and the absence-path markup. They do not prove
 * layout, and they say nothing about any surface other than the hero panel.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import {
  PERMITTED_VERDICT,
  WITHHELD_VERDICT,
  withheldFixtureOptions as options,
} from '../../__fixtures__/withheldDesignations.fixtures'

/**
 * The producer's sentence, verbatim. A distinctive sentinel, compared with
 * `toBe` throughout: a pass cannot come from a substring, a paraphrase or a
 * truncation, only from this exact string reaching the slot.
 */
const ADMISSION_MESSAGE =
  'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.'

/** A SECOND reason, to pin which one is rendered when several arrive. */
const SECOND_MESSAGE = 'A second admission reason that must not appear on its own.'

const TESTID = 'hero-designation-withheld-reason'

const PANEL_PROPS = { rerunDisabled: false, focusPanelMounted: false } as const

/**
 * ⭐⭐ THE ADMISSION IS Q1. THE VERDICT IS Q2. THE FIXTURE MUST SET BOTH.
 *
 * ⚠ THIS COMMENT DESCRIBED THE PRE-MERGE HELPER AND THE MERGE FALSIFIED IT.
 * It said `leaderDesignationPermitted(rec)` is `rec.leaderDesignationPermitted
 * ?? rec.verdict?.hasLeadingOption`. At `leaderDesignation.ts:77/:80` it is now
 * the composed field when present (`!= null`, so a composed `false` survives),
 * and otherwise `rec.verdict?.hasLeadingOption === false ? false : undefined`.
 *
 * ⛔ THE DIFFERENCE IS THE WHOLE POINT OF THE SEAM. Omitting the composed field
 * used to yield the PERMISSIVE answer via the verdict arm; it now yields
 * `undefined` — WITHHELD. Absence of the composed answer is not permission: Q2
 * is one of two conjuncts, so it may only ever withhold, never license. Leaving
 * the old sentence here would have taught the inferred-licence read that the
 * merged docstring exists to abolish, restated as fact inside the regression
 * pin for that very behaviour.
 *
 * What still holds, and is why the fixtures below set BOTH: a fixture omitting
 * the composed field does not exercise the composed arm at all, and every case
 * in this file was landing on the fallback. The tests passed, the product was right, and they were pointed at a
 * different cause: they could not distinguish "explains the admission refusal"
 * from "printed whenever the run failed to separate".
 *
 * Measured before this was fixed — model refuses, run separates:
 *   headline = "Hire two developers has the highest chance … 80%."
 *   reason   = null            ← an admission refusal rendered NOTHING
 *
 * `useResultsSectionData` publishes the CONJUNCTION as
 * `leaderDesignationPermitted`, so the fixture below mirrors the producer and
 * sets it from Q1 && Q2 rather than leaving it absent.
 */
const MODE_REFUSES = 'quantified_provisional'
const MODE_PERMITS = 'comparative_leader'

function admission(messages: string[], mode: string = MODE_REFUSES) {
  return {
    permitted_analysis_mode: mode,
    reasons: messages.map((message, i) => ({ field: `field_${i}`, message })),
  }
}

function heroModel(opts: {
  verdict: typeof WITHHELD_VERDICT
  analysisAdmission?: ReturnType<typeof admission>
  /**
   * Q2 — did this RESULT separate the arms? Defaults to the verdict's own
   * answer, which is what a run with no surprises reports.
   */
  resultSeparatesArms?: boolean
}): HeroChartModel {
  const q1 = opts.analysisAdmission == null
    ? true
    : opts.analysisAdmission.permitted_analysis_mode === MODE_PERMITS
  const q2 = opts.resultSeparatesArms ?? opts.verdict.hasLeadingOption === true
  return buildHeroModel(
    makeHeroData({
      options: options(),
      recommendation: {
        verdict: opts.verdict,
        analysisAdmission: opts.analysisAdmission,
        // THE COMPOSED ANSWER, exactly as `useResultsSectionData` publishes it.
        leaderDesignationPermitted: q1 && q2,
        storyHeadlines: {},
      } as NonNullable<Parameters<typeof makeHeroData>[0]>['recommendation'],
    }),
  ) as HeroChartModel
}

describe('analysis hero — the withheld run says WHY no leader was named', () => {
  it('carries the producer sentence VERBATIM on a withheld run', () => {
    const model = heroModel({
      verdict: WITHHELD_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE]),
    })

    // PRECONDITION, pinned in-test: this payload really does reach the
    // withheld state. Without this the assertion below could pass on a model
    // that never refused anything.
    expect(model.designationsWithheld, 'fixture must reproduce the withheld state').toBe(true)

    expect(model.designationWithheldReason).toBe(ADMISSION_MESSAGE)
  })

  it('renders that sentence in the hero panel, byte-for-byte', () => {
    const model = heroModel({
      verdict: WITHHELD_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE]),
    })
    expect(model.designationsWithheld, 'fixture must reproduce the withheld state').toBe(true)

    const { getByTestId } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)

    // textContent, not a matcher: the sentence must arrive unparaphrased,
    // untruncated and untemplated.
    expect(getByTestId(TESTID).textContent).toBe(ADMISSION_MESSAGE)
  })

  it('renders the FIRST reason only when several arrive', () => {
    const model = heroModel({
      verdict: WITHHELD_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE, SECOND_MESSAGE]),
    })
    expect(model.designationsWithheld, 'fixture must reproduce the withheld state').toBe(true)

    const { getByTestId, queryAllByText } = render(
      <AnalysisHeroPanel model={model} {...PANEL_PROPS} />,
    )
    expect(getByTestId(TESTID).textContent).toBe(ADMISSION_MESSAGE)
    // The others are NOT rendered here. Documented, not smuggled: this hero
    // slot shows one sentence, and the rest do not reach this surface.
    expect(queryAllByText(SECOND_MESSAGE)).toHaveLength(0)
  })

  it('adds NOTHING when the run withholds but no admission message arrived', () => {
    const model = heroModel({ verdict: WITHHELD_VERDICT })
    expect(model.designationsWithheld, 'fixture must reproduce the withheld state').toBe(true)
    expect(model.designationWithheldReason).toBeNull()

    // BYTE-IDENTICAL TO THE PRE-CHANGE SHAPE, measured rather than asserted:
    // render the same model with the new field stripped entirely (what a
    // pre-change model literally was) and compare the markup.
    //
    // ⚠ REACT `useId` TOKENS ARE NORMALISED FIRST. Two renders in one test
    // draw different `:r<n>:` ids from the same counter, so a raw comparison
    // fails on the instrument rather than on the markup — measured, not
    // assumed: the first version of this test failed exactly that way. The
    // normalisation CANNOT mask this change, which adds a `<p data-testid>`
    // and no id at all, and the control below proves the comparison still
    // discriminates after normalising.
    const normalise = (html: string) => html.replace(/:r[0-9a-z]+:/g, ':rID:')
    const preChangeShape = { ...model } as Partial<HeroChartModel>
    delete preChangeShape.designationWithheldReason
    const withField = normalise(
      render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />).container.innerHTML,
    )
    const withoutField = normalise(
      render(<AnalysisHeroPanel model={preChangeShape as HeroChartModel} {...PANEL_PROPS} />)
        .container.innerHTML,
    )
    expect(withField.length, 'render must not be empty').toBeGreaterThan(0)
    expect(withField).toBe(withoutField)

    // CONTROL — the comparison above must still be capable of failing. The
    // SAME model carrying a message renders different markup after the same
    // normalisation; without this the equality could be a normalisation
    // artefact rather than evidence about the absence path.
    const withMessage = normalise(
      render(
        <AnalysisHeroPanel
          model={{ ...model, designationWithheldReason: ADMISSION_MESSAGE }}
          {...PANEL_PROPS}
        />,
      ).container.innerHTML,
    )
    expect(withMessage).not.toBe(withField)

    // And the headline is still the neutral comparison line it was.
    expect(model.headline).toBe(HERO_COPY.headline.noLeader)
  })

  it('does NOT render a refusal sentence on a run that PERMITTED the designation', () => {
    // The opposite-direction twin. An admission message present on a
    // permitted run is not an explanation of a silence that never happened —
    // rendering it would invent a refusal.
    //
    // ⚠ THE ADMISSION MUST PERMIT, or this is not a permitted run. The fixture
    // used to leave the mode at its refusing default and still expect
    // `designationsWithheld === false`; that only held because the composed
    // field was absent and the reader fell through to the verdict. Now that
    // the fixture answers both questions the way the producer does, a
    // refusing admission makes the run WITHHELD — so reproducing "permitted"
    // means permitting on both conjuncts, and the reason must still be null
    // even though a message rode along.
    const model = heroModel({
      verdict: PERMITTED_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE], MODE_PERMITS),
    })
    expect(model.designationsWithheld, 'control must reproduce the PERMITTED state').toBe(false)

    expect(model.designationWithheldReason).toBeNull()
    const { queryByTestId } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)
    expect(queryByTestId(TESTID)).toBeNull()
  })
})

/**
 * ⭐⭐ THE DISCRIMINATING ARMS — these are what make this file about the
 * ADMISSION rather than about separation. Each one holds the other question
 * fixed, so a passing result can only be caused by the question it names.
 */
describe('the sentence answers Q1, and only Q1', () => {
  it('⭐ MODEL REFUSES, RUN SEPARATES → the sentence appears', () => {
    // The flagship case the feature exists for, and the one the old fixture
    // could not reach: Q2 is TRUE, so only the admission can be withholding.
    const model = heroModel({
      verdict: PERMITTED_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE], MODE_REFUSES),
      resultSeparatesArms: true,
    })
    expect(model.designationsWithheld, 'Q1 alone must withhold here').toBe(true)
    expect(model.designationWithheldReason).toBe(ADMISSION_MESSAGE)
  })

  it('⭐ THE TWIN: MODEL PERMITS, RUN TIES → no admission sentence', () => {
    // Q1 permitted the claim; the arms merely tied. The admission refused
    // NOTHING, so attaching its wording here would state a refusal that did
    // not happen. Before the Q1 gate this rendered the sentence.
    const model = heroModel({
      verdict: WITHHELD_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE], MODE_PERMITS),
      resultSeparatesArms: false,
    })
    expect(model.designationsWithheld, 'the run still withholds — via Q2').toBe(true)
    expect(model.designationWithheldReason).toBeNull()
  })

  it('the pair actually DIFFER — the discrimination is asserted, not assumed', () => {
    const q1Refused = heroModel({
      verdict: PERMITTED_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE], MODE_REFUSES),
      resultSeparatesArms: true,
    })
    const q2Tied = heroModel({
      verdict: WITHHELD_VERDICT,
      analysisAdmission: admission([ADMISSION_MESSAGE], MODE_PERMITS),
      resultSeparatesArms: false,
    })
    // Both are withheld runs carrying the SAME admission message. Only the
    // refusing conjunct differs, and it must change the answer.
    expect(q1Refused.designationsWithheld).toBe(q2Tied.designationsWithheld)
    expect(q1Refused.designationWithheldReason).not.toBe(q2Tied.designationWithheldReason)
  })

  it('a whitespace-only producer message is an absence, not an empty paragraph', () => {
    const model = heroModel({
      verdict: PERMITTED_VERDICT,
      analysisAdmission: admission(['   '], MODE_REFUSES),
      resultSeparatesArms: true,
    })
    expect(model.designationsWithheld).toBe(true)
    expect(model.designationWithheldReason).toBeNull()
    const { queryByTestId } = render(
      <AnalysisHeroPanel model={model} {...PANEL_PROPS} />,
    )
    expect(queryByTestId(TESTID)).toBeNull()
  })

  it('the slot obeys house style — em dashes become hyphens, like every producer slot', () => {
    const EM = 'No leader — the estimates are ours, not yours.'
    const model = heroModel({
      verdict: PERMITTED_VERDICT,
      analysisAdmission: admission([EM], MODE_REFUSES),
      resultSeparatesArms: true,
    })
    const { getByTestId } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)
    expect(getByTestId(TESTID).textContent).toBe('No leader - the estimates are ours, not yours.')
    // The guard is a GLYPH swap: no words added, removed or reordered.
    expect(getByTestId(TESTID).textContent).toContain('the estimates are ours, not yours.')
  })
})
