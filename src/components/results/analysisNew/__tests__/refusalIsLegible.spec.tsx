/**
 * ⭐⭐ THE REASONING TAB INHERITED THE ADMISSION'S GATE AND DROPPED ITS EXPLANATION.
 *
 * `useResultsSectionData.ts:2275-2292` calls `licensesComparativeLeaderClaim` over
 * `analysis_admission` and conjoins it away from its own name into
 * `leaderDesignationPermitted`. Three surfaces on this tab already gate on that
 * composed field — the glance headline (`buildAnalysisNewViewModel.ts:1675`),
 * `modelImplication` (`:1999`) and the "What we checked" leader row (`:2422`) —
 * and ALL THREE GO SILENT when it is withheld. The producer's sentence saying WHY
 * reached no part of this tab.
 *
 * The hero already named this hazard and already solved it, `heroTypes.ts:411-412`:
 *   "The withheld headline … is SILENCE, not a denial, and silence is
 *    indistinguishable from an ordinary run. This slot is what makes the refusal
 *    legible."
 * This is that slot, for Reasoning.
 *
 * ⚠⚠ SELECTED BY `field`, NEVER BY POSITION — AND THE HERO GETS THIS WRONG.
 * `buildHeroModel.ts:952` reads `reasons?.[0]?.message`. On the live wire
 * `reasons[0]` is the AFFIRMATIVE `READY_TO_COMPARE` — "Analysis can run on this
 * model as it stands" — and the remedy sits at `[1]`/`[2]`. Measured on
 * `staging--olumi.netlify.app`, served `103ac4fd`, bundle `index-C5Gildj6.js`,
 * fresh guest, 2026-09-09; the payload below is that capture, unedited.
 *
 * ⚠ THE ASSERTIONS BIND BY `field`, NOT BY MESSAGE TEXT. `reasons[1]` and
 * `reasons[2]` carry the IDENTICAL message string, so a message-based assertion
 * passes on the wrong object (trap 19). The mutant pair below discriminates.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

/**
 * The live capture, verbatim. NOT a paraphrase — a hand-written stand-in would
 * encode this author's model of the producer rather than the producer, and the
 * index ordering is the whole point.
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

const REMEDY = CAPTURED_REFUSAL.reasons[2].message
const AFFIRMATIVE = CAPTURED_REFUSAL.reasons[0].message

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

const renderGlance = (data: ResultsSectionDataReturn) =>
  render(
    <AtAGlance
      glance={glanceOf(data)}
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      onReanalyse={vi.fn()}
    />,
  )

afterEach(() => cleanup())

describe('a withheld leader designation says why', () => {
  it('renders the producer sentence that explains the refusal', () => {
    const data = withAdmission(decisionWithLeaderWithheld(), CAPTURED_REFUSAL)

    // ⚠ PRECONDITION PINNED IN-TEST. If this fixture stopped withholding, the
    // assertion below would be about a state the surface never reaches.
    expect(glanceOf(data).headline).toBeNull()

    renderGlance(data)
    expect(screen.getByTestId('analysis-new-glance-withheld-reason')).toHaveTextContent(REMEDY)
  })

  it('carries the REMEDY, not the affirmative reason sitting at index 0', () => {
    const data = withAdmission(decisionWithLeaderWithheld(), CAPTURED_REFUSAL)
    renderGlance(data)
    const slot = screen.getByTestId('analysis-new-glance-withheld-reason')
    // The discriminator: reasons[0] is affirmative. A positional read renders it.
    expect(slot).not.toHaveTextContent(AFFIRMATIVE)
  })

  it('selects the permitted_analysis_mode conjunct BY FIELD, not by array order', () => {
    // Same three reasons, reversed. A positional reader now lands on the remedy
    // by luck and this test would pass either way — so the discrimination is the
    // ORDER-INVARIANCE: both orderings must produce the same sentence.
    const reversed = { ...CAPTURED_REFUSAL, reasons: [...CAPTURED_REFUSAL.reasons].reverse() }
    const forward = withAdmission(decisionWithLeaderWithheld(), CAPTURED_REFUSAL)
    const backward = withAdmission(decisionWithLeaderWithheld(), reversed)
    expect(glanceOf(backward).designationWithheldReason).toBe(
      glanceOf(forward).designationWithheldReason,
    )
    expect(glanceOf(backward).designationWithheldReason).toBe(REMEDY)
  })

  it('says NOTHING when the model licensed the claim', () => {
    // The opposite-direction twin. A slot that renders whenever an admission is
    // present would put "a leading option can be named" under a refusal heading.
    const data = withAdmission(genuineDecision(), CAPTURED_PERMITTED)
    renderGlance(data)
    expect(screen.queryByTestId('analysis-new-glance-withheld-reason')).not.toBeInTheDocument()
  })

  it('says NOTHING when the model licensed but the ARMS did not separate', () => {
    /**
     * ⭐⭐ THE CELL THAT DISCRIMINATES THE GATE, and it was a SURVIVING MUTANT
     * until this case existed. `leaderDesignationPermitted` is
     * `modelLicensesComparativeClaim && resultSeparatesArms`
     * (`useResultsSectionData.ts:2292`), so its falsity has TWO causes. Here the
     * model LICENSED (`permitted_analysis_mode: 'comparative_leader'`) and the
     * arms did not separate — composed `false`, Q1 `true`.
     *
     * A gate written as `leaderDesignationPermitted(rec) !== true` renders here,
     * and what it renders is the PERMITTED admission's sentence — "At least one
     * of the estimates … is yours, so a leading option can be named" — under a
     * heading saying what the run may NOT conclude. That is a model refusal the
     * producer never made, asserted by the panel.
     *
     * Every other case in this file passes under BOTH gates. This one does not,
     * which is the whole reason it is here.
     */
    const data = withAdmission(decisionWithLeaderWithheld(), CAPTURED_PERMITTED)

    // Preconditions pinned in-test: composed withheld, model licensing.
    expect(glanceOf(data).headline).toBeNull()
    expect(CAPTURED_PERMITTED.permitted_analysis_mode).toBe('comparative_leader')

    renderGlance(data)
    expect(screen.queryByTestId('analysis-new-glance-withheld-reason')).not.toBeInTheDocument()
  })

  it('says NOTHING when there is no admission at all', () => {
    // ⚠ ABSENCE IS NOT A REFUSAL. `ceeAnalysisReady` is nulled by
    // `invalidateAnalysisReady` on every analytical edit (`store.ts:1893-1904`),
    // so this state is reached on the user's own keystroke — measured live at
    // +300ms after a factor edit. A slot gated on `!== true` would assert a
    // refusal the producer never made, on a run that may never have happened.
    const data = withAdmission(decisionWithLeaderWithheld(), undefined)
    renderGlance(data)
    expect(screen.queryByTestId('analysis-new-glance-withheld-reason')).not.toBeInTheDocument()
  })

  it('NAMES the leader when there is no admission and the arms DID separate', () => {
    /**
     * ⭐⭐⭐ THE MISSING CELL. Every `undefined`-admission case above this one uses
     * `decisionWithLeaderWithheld()` — NON-SEPARATING arms, composed `false`. Over
     * that shape a `!== true` gate and a `=== false` gate AGREE, so the absence
     * cases were all measured on the one input class that cannot tell them apart.
     *
     * THE SEPARATING × ABSENT CELL IS WHERE THE LIVE DEFECT LIVED, and until this
     * case existed this file could not see it: the corpus tested one direction, so
     * the suite stayed green while the deployed product replaced CEE's refusal with
     * "Most likely to serve your goal / Double Down on SMB" 59ms after a factor
     * edit (staging 9eb30b54, 2026-09-10).
     *
     * ⚠ AND THIS CASE MUST STAY GREEN. Read it as the OLD-PRODUCER half of the
     * pair: nothing was ever retained, so the absence genuinely means "no
     * authority", the leader stands, and no refusal is asserted. The repair lives
     * upstream in `resolveEffectiveAdmission`, which distinguishes this from the
     * absence the consumer inflicted on itself — so a future change that closes the
     * defect by inverting the absence arm INSTEAD of distinguishing the two cases
     * goes RED here, which is exactly what this cell is for.
     *
     * Both directions are asserted. The withheld slot's absence alone would also
     * hold on a build that renders nothing at all — the gap my inventory found in
     * the licensed-admission case above.
     */
    const data = withAdmission(genuineDecision(), undefined)

    // Preconditions pinned in-test, so the assertions below are the code's doing.
    expect(
      data.recommendation?.verdict?.hasLeadingOption,
      'precondition: this cell is about SEPARATING arms — the other absence cases cover the rest',
    ).toBe(true)
    expect(
      data.recommendation?.analysisAdmission,
      'precondition: no admission at all, or this is not the absence cell',
    ).toBeUndefined()
    expect(glanceOf(data).headline, 'precondition: the glance must have an answer to give').not.toBeNull()

    renderGlance(data)
    expect(screen.queryByTestId('analysis-new-glance-withheld-reason')).not.toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-glance-headline')).toBeInTheDocument()
  })
})
