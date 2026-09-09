/**
 * ⭐⭐ THE REFUSAL IS LEGIBLE. NOW IT IS ACTIONABLE.
 *
 * `refusalIsLegible.spec.tsx` closed the first half: a run whose model declined
 * to license a comparative claim renders the producer's own sentence saying why,
 * instead of the silence that is indistinguishable from an ordinary run. The
 * sentence, live from CEE on `staging--olumi.netlify.app`:
 *
 *   "Every estimate this comparison rests on is Olumi's, not yours. Figures can
 *    be shown as provisional, but no option can be called the leader and no
 *    result can be called stable or robust until you have set at least one of
 *    them."
 *
 * That is TRUE, it names a remedy in words, and it leaves the reader nowhere to
 * go. It is `honestSentenceHasAMove.spec.tsx`'s complaint exactly — "the panel
 * was optimised for truthfulness and never for usefulness" — one slot further
 * down. This file is that spec's sibling: the ACT half.
 *
 * ── WHAT THE CONTROL MAY AND MAY NOT SAY ──────────────────────────────────
 * ⛔⛔ IT MAY NOT PROMISE A BETTER ANSWER, AND THIS IS A MEASUREMENT, NOT A
 * PREFERENCE. Measured on the live wire: ONE user-stated value out of twenty
 * flips CEE from `quantified_provisional` to `comparative_leader`, while the
 * other nineteen estimates remain Olumi's own. So a control captioned "set a
 * value to get a confident answer" would be describing a real state transition
 * and still lying about what it means — the model licenses the CLAIM because a
 * human has entered the loop, not because the evidence got stronger.
 *
 * ⛔ AND IT MAY NOT COACH A RUBBER-STAMP. "Confirm these figures" on a panel
 * whose whole complaint is that the figures are Olumi's own is an instruction to
 * launder a machine estimate into a user-stated one. The offer is to REVIEW OR
 * SET, which is the only honest description of what the destination does.
 *
 * The third test below is a copy CEILING over those two rules, with a positive
 * control proving it can fail on a plausible breach (CLAUDE.md trap 13 — an
 * absence assertion with no demonstrated presence asserts nothing).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

const SENTENCE = 'analysis-new-glance-withheld-reason'
const CONTROL = 'analysis-new-glance-withheld-review-estimates'

/**
 * The live capture, verbatim — the same payload `refusalIsLegible.spec.tsx`
 * carries, for the same reason: a hand-written stand-in would encode this
 * author's model of the producer rather than the producer.
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

const withAdmission = (
  data: ResultsSectionDataReturn,
  admission: unknown,
): ResultsSectionDataReturn =>
  ({
    ...data,
    recommendation: { ...data.recommendation, analysisAdmission: admission },
  }) as ResultsSectionDataReturn

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

const renderGlance = (data: ResultsSectionDataReturn, over: Record<string, unknown> = {}) =>
  render(
    <AtAGlance
      glance={glanceOf(data)}
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      onReanalyse={vi.fn()}
      {...over}
    />,
  )

/** The withheld state, pinned in-test everywhere it is used. */
const withheld = () => withAdmission(decisionWithLeaderWithheld(), CAPTURED_REFUSAL)

afterEach(() => cleanup())

describe('the withheld-designation sentence carries the act that answers it', () => {
  it('offers the control beside the sentence, and it calls the handler', async () => {
    // ⚠ PRECONDITION PINNED IN-TEST. If this fixture stopped withholding, every
    // assertion below would be about a state the surface never reaches, and the
    // whole file would pass by testing nothing (CLAUDE.md trap 13b).
    expect(glanceOf(withheld()).headline).toBeNull()
    expect(glanceOf(withheld()).designationWithheldReason).toBeTruthy()

    const onReviewEstimates = vi.fn()
    renderGlance(withheld(), { onReviewEstimates })

    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(CONTROL))
    expect(onReviewEstimates).toHaveBeenCalledTimes(1)
  })

  /**
   * ⭐ BESIDE THE SENTENCE, NOT MERELY SOMEWHERE ON THE PANEL — bound by
   * CONTAINMENT rather than by co-presence. Two testids both being in the
   * document is satisfied by a control rendered anywhere at all, including in a
   * block that states something else (CLAUDE.md trap 19: an assertion must bind
   * to its object by identity, never by a predicate another object satisfies).
   * The refusal block carries `role="status"`; a control that drifted out of it
   * would be an orphaned button under a heading it no longer answers.
   */
  it('renders INSIDE the refusal block, not merely elsewhere on the panel', () => {
    renderGlance(withheld(), { onReviewEstimates: vi.fn() })
    const sentence = screen.getByTestId(SENTENCE)
    const control = screen.getByTestId(CONTROL)
    const block = sentence.closest('[role="status"]')
    expect(block, 'the refusal block lost its role="status"').not.toBeNull()
    expect(block!.contains(control)).toBe(true)
  })

  /**
   * ⚠ FAIL-CLOSED, AND IT IS THE DISCRIMINATING HALF. Without this, the cases
   * above pass on a component that renders the control unconditionally —
   * including on every host that supplies no handler, where pressing it does
   * nothing. `AtAGlance`'s own `onReanalyse` prop already states the rule for
   * this surface: "a staleness sentence with a dead button beside it is worse
   * than the sentence alone."
   */
  it('renders the sentence ALONE when no handler is supplied', () => {
    renderGlance(withheld(), { onReviewEstimates: undefined })
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). A control gated on the
   * HANDLER alone renders on every run, including the ones that concluded — an
   * offer to go and fix estimates on a panel that just named a leading option,
   * under no heading at all, because the refusal block is not rendered there.
   */
  it('renders NO control on a run that DID conclude', () => {
    const data = genuineDecision()
    expect(glanceOf(data).designationWithheldReason).toBeFalsy()
    renderGlance(data, { onReviewEstimates: vi.fn() })
    expect(screen.queryByTestId(SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })
})

describe('the control offers a review, and promises nothing', () => {
  /**
   * ⛔ THE CEILING. Hand-written, and deliberately so: a guard DERIVED from the
   * label could only prove the label agrees with itself (CLAUDE.md trap 12d —
   * derivation stops consumers drifting, only a corpus notices the list is
   * wrong). Its power therefore rests entirely on the positive control below.
   */
  const PROMISES_A_BETTER_RESULT: ReadonlyArray<RegExp> = [
    /\bmore (?:confident|reliable|accurate|certain|robust|stable)\b/i,
    /\b(?:improve|strengthen|increase|boost|raise)s?\b.*\b(?:confidence|certainty|reliability|accuracy)\b/i,
    /\b(?:unlock|enable|get|receive|reach)\b.*\b(?:leader|leading option|answer|verdict|conclusion|result)\b/i,
    /\bto (?:see|get|reveal)\b.*\b(?:which|the)\b.*\b(?:leading|best|top)\b/i,
    /\bbetter\b.*\b(?:answer|result|analysis|verdict)\b/i,
  ]

  /** ⛔ Rubber-stamping: an instruction to accept the machine's figure as-is. */
  const COACHES_A_RUBBER_STAMP: ReadonlyArray<RegExp> = [
    /\b(?:confirm|accept|approve|agree with|sign off|ok)\b.*\b(?:these|the|olumi|our)\b.*\b(?:figures?|estimates?|values?|numbers?)\b/i,
    /\b(?:looks? right|as[- ]is|keep (?:these|them))\b/i,
  ]

  const LABEL = COPY.glance.reviewEstimates

  /**
   * ⭐⭐ THE LOAD-BEARING TEST. A ceiling that cannot fail on the sentence it
   * exists to forbid is theatre, and every "the label is clean" assertion below
   * would then be passing by testing nothing. These two breaches are the ones
   * that were genuinely tempting to ship: the first is what the measurement
   * makes true-sounding, the second is what an author reaches for to keep the
   * label short.
   */
  it('the ceiling can FAIL on the two breaches it exists to forbid', () => {
    const PROMISE_BREACH = 'Set an estimate to get a more confident answer'
    const STAMP_BREACH = 'Confirm these estimates'
    expect(
      PROMISES_A_BETTER_RESULT.some((p) => p.test(PROMISE_BREACH)),
      'the ceiling must be capable of failing the sentence it is cited for',
    ).toBe(true)
    expect(
      COACHES_A_RUBBER_STAMP.some((p) => p.test(STAMP_BREACH)),
      'the ceiling must be capable of failing the rubber-stamp sentence',
    ).toBe(true)
  })

  it('the label promises no better result', () => {
    const hit = PROMISES_A_BETTER_RESULT.find((p) => p.test(LABEL))
    expect(
      hit ? `${LABEL} matched ${hit}` : null,
      'One user-stated value out of twenty flips the model from ' +
        'quantified_provisional to comparative_leader while nineteen estimates ' +
        'stay Olumi’s own. The claim licensed by that transition is that a human ' +
        'entered the loop — never that the answer got better.',
    ).toBeNull()
  })

  it('the label does not coach a rubber-stamp', () => {
    const hit = COACHES_A_RUBBER_STAMP.find((p) => p.test(LABEL))
    expect(
      hit ? `${LABEL} matched ${hit}` : null,
      'Confirming an Olumi figure as-is launders a machine estimate into a ' +
        'user-stated one, which is the precise thing the producer’s sentence is ' +
        'complaining about.',
    ).toBeNull()
  })

  it('the label offers a review or a change, in words', () => {
    // Identity, not vibes: the offer must actually name the act.
    expect(LABEL).toMatch(/\b(?:review|set|change|edit)\b/i)
  })
})

describe('the tab actually threads the handler', () => {
  /**
   * ⭐⭐ THE PROP EXISTING IS NOT THE PROP ARRIVING. `AtAGlance` is fail-closed,
   * so a tab body that accepts the handler and forgets to pass it down renders
   * the sentence alone and every component-level test above still passes — the
   * estate's first chronic failure ("we build more than we plug in") reproduced
   * at one component boundary.
   */
  it('renders the control when AnalysisNewTabBody is given the handler', async () => {
    const onReviewEstimates = vi.fn()
    render(
      <AnalysisNewTabBody
        resultsSectionData={withheld()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        canRunAnalysis
        runBlockedReason={null}
        onReviewEstimates={onReviewEstimates}
      />,
    )
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(CONTROL))
    expect(onReviewEstimates).toHaveBeenCalledTimes(1)
  })

  it('renders the sentence alone through the tab body when no handler is given', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withheld()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        canRunAnalysis
        runBlockedReason={null}
      />,
    )
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })
})
