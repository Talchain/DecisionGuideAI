/**
 * ⭐⭐ THE PRODUCER'S CAVEAT REACHED ONLY THE PARKED TAB.
 *
 * `robustness_caveat` is a `DecisionBriefV1` member CEE already sends and the
 * browser already holds. Swept at `origin/staging`: exactly TWO non-test
 * occurrences, both in `decision-brief/decisionBriefViewModel.ts`, feeding a
 * section whose only mount is `ResultsBody.tsx` — the parked tab. Contrast
 * control, same sweep: the sibling members return 16 lines, so the probe sees
 * the family and the absence is real.
 *
 * ⚠⚠ THE GATE IS THE POINT OF THIS FILE. The caveat is a LEADER-RANKING member:
 * CEE strips it on a withheld turn and its absence IS the withheld signal, so
 * its presence may never be read as licence to speak about a ranking. Half these
 * cases exist to make a missing gate RED rather than to prove the text renders.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { RobustnessCaveat } from '../sections/RobustnessCaveat'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision, decisionWithLeaderWithheld } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const TID = 'analysis-new-robustness-caveat'

const PRODUCER_TEXT =
  'The ordering held in 84% of runs; below a 12% conversion rate it reverses.'
const PRODUCER_BASIS = '2,000 simulated futures'

/** A valid DecisionBriefV1 whose only populated member is the caveat. */
const briefWithCaveat = (text = PRODUCER_TEXT, basis = PRODUCER_BASIS) => ({
  version: '1',
  brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  created_at: '2026-09-08T12:00:00.000Z',
  robustness_caveat: { text, basis },
})

const setBrief = (decision_brief: unknown) => {
  useCanvasStore.setState({
    results: { ...useCanvasStore.getState().results, report: { decision_brief } },
  } as never)
}

beforeEach(() => setBrief(briefWithCaveat()))
afterEach(cleanup)

describe('the producer caveat on the Reasoning tab', () => {
  it('renders the producer sentence and its basis VERBATIM', () => {
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.getByTestId(`${TID}-text`)).toHaveTextContent(PRODUCER_TEXT)
    expect(screen.getByTestId(`${TID}-basis`)).toHaveTextContent(
      `${COPY.robustnessCaveat.basisPrefix}${PRODUCER_BASIS}`,
    )
  })

  /**
   * ⭐⭐ THE GATE. A withheld run must not get a leader-ranking member on screen,
   * whatever the payload still contains.
   */
  it('renders NOTHING when the ranking may not be spoken about', () => {
    render(<RobustnessCaveat leaderClaimPermitted={false} verdictReason={null} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  /**
   * ⭐ THE RESTATEMENT GUARD. `ModelHeldUp` records shipping exactly this defect
   * with the neighbouring field: one surface said "the ordering held across the
   * simulated range" twice. Different wire fields; the reader sees only words.
   */
  it('says nothing when its sentence is already on screen as the verdict reason', () => {
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={PRODUCER_TEXT} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  it('CONTROL: a DIFFERENT verdict reason does not suppress it', () => {
    render(
      <RobustnessCaveat
        leaderClaimPermitted
        verdictReason="Sensitive — small changes could flip this result"
      />,
    )
    expect(screen.getByTestId(`${TID}-text`)).toHaveTextContent(PRODUCER_TEXT)
  })

  it('CONTROL: case and surrounding space do not defeat the restatement guard', () => {
    render(
      <RobustnessCaveat leaderClaimPermitted verdictReason={`  ${PRODUCER_TEXT.toUpperCase()}  `} />,
    )
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  it('CONTROL: renders nothing when the producer sent no caveat', () => {
    setBrief({
      version: '1',
      brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      created_at: '2026-09-08T12:00:00.000Z',
      key_assumptions: ['Something else entirely.'],
    })
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  it('CONTROL: renders nothing when there is no brief at all', () => {
    setBrief(undefined)
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  /**
   * ⭐ THE SHARED PARSER IS THE ONE THAT DECIDES. A caveat missing its basis is
   * rejected by `readDecisionBriefViewModel`, and this surface must inherit that
   * judgement rather than render half a claim.
   */
  it('CONTROL: a caveat with no basis is rejected, not rendered half', () => {
    setBrief({
      version: '1',
      brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      created_at: '2026-09-08T12:00:00.000Z',
      robustness_caveat: { text: PRODUCER_TEXT },
    })
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  /**
   * ⭐⭐ THIS SURFACE IS THE FIRST TO DISPLAY `basis` AT ALL, and the shared
   * parser screened only `text` until review caught it. The parked tab renders
   * `.text` alone, so an id-shaped `basis` had never been user-visible and the
   * asymmetry had never cost anything — mounting it here is what made it a leak.
   *
   * PLoT's documented fallback when a display label is absent is the
   * model-element id, so the reachable failure is the user reading
   * `Tested against: factor_price_elasticity`.
   */
  /**
   * ⚠ THE BLAST RADIUS CHANGED, AND THE ASSERTION MOVED WITH IT. This asserted
   * the WHOLE section was absent, because an unusable basis used to null the
   * whole caveat. It now costs the LABEL only: the leak is still refused, and
   * the sentence telling the user how far to trust the ranking survives, which
   * is the half that was being thrown away. See `decisionBriefViewModel.ts`.
   */
  it('⛔ an id-shaped BASIS is refused, and the sentence is kept', () => {
    setBrief(briefWithCaveat(PRODUCER_TEXT, 'factor_price_elasticity'))
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.queryByTestId(`${TID}-basis`)).toBeNull()
    expect(screen.queryByText(/factor_price_elasticity/)).toBeNull()
    expect(screen.getByTestId(`${TID}-text`)).toHaveTextContent(PRODUCER_TEXT)
  })

  /**
   * The other half of the pair. `text` was already screened — this case is here
   * so that if someone later drops the screen from the WRONG field, exactly one
   * of these two REDs and names which one went.
   */
  it('⛔ an id-shaped TEXT is rejected too (the pre-existing half of the screen)', () => {
    setBrief(briefWithCaveat('The ordering held except for risk_budget_overrun.', PRODUCER_BASIS))
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  /**
   * ⚠ AND THE SCREEN IS NOT JUST ALWAYS-ON. Without this, both cases above would
   * pass on a guard that rejects every caveat ever sent.
   */
  it('CONTROL: the legitimate basis is NOT id-shaped and still renders', () => {
    setBrief(briefWithCaveat())
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.getByTestId(`${TID}-basis`)).toHaveTextContent(
      `${COPY.robustnessCaveat.basisPrefix}${PRODUCER_BASIS}`,
    )
  })
})

/**
 * ⭐⭐⭐ AND IT REACHES THE TAB — WHICH IS WHAT THIS FILE IS NAMED AFTER.
 *
 * ⚠⚠ EVERY CASE ABOVE RENDERS `<RobustnessCaveat/>` DIRECTLY, so not one of them
 * says a word about whether `AnalysisNewTabBody` mounts it. Review measured the
 * consequence with a mutation kit: deleting the `<RobustnessCaveat/>` line from
 * the tab left 389 files / 6190 tests IDENTICAL to baseline, and hardcoding the
 * `leaderClaimPermitted` prop to `true` did the same. The section could go dark,
 * or go fail-OPEN, under a fully green suite.
 *
 * That is trap 3b, and it is the exact failure class this PR exists to close —
 * `robustness_caveat` was computed and unreachable because its only consumer
 * mounted on the parked tab. Reproducing it one level up, in the spec whose NAME
 * is "reaches the tab", is the defect the name denies.
 *
 * ⚠ THE PRECONDITION IS PINNED BY THE FIRST CASE, deliberately. It asserts the
 * section is PRESENT with the producer's sentence through the real tab body — so
 * the brief parses, the mount exists, and the testid is reachable from here.
 * Only then is an absence in the two withheld cases attributable to THE GATE
 * rather than to a fixture that quietly rendered nothing (trap 13b: a "not
 * mounted" result is otherwise indistinguishable from a correct refusal). Both
 * withheld cases additionally assert the TAB ITSELF rendered, so "absent" can
 * never silently mean "the whole surface threw".
 */
const drawTab = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

/**
 * The authority could not answer AT ALL — neither conjunct present.
 *
 * ⚠ THIS IS THE CELL THE OTHER TWO FIXTURES CANNOT REACH, and it is the one that
 * matters. `decisionWithLeaderWithheld()` sets the composed field to an explicit
 * `false`, so it cannot discriminate `=== true` from `!== false`: `false !==
 * false` is false, and the section stays hidden either way. Dropping the field
 * entirely — while leaving `verdict.hasLeadingOption: true`, so the Q2-only
 * withholding arm does not fire instead — makes `leaderDesignationPermitted()`
 * return `undefined`, which is where the two idioms finally disagree:
 *
 *   `undefined === true`  -> false -> withheld  (what the code does)
 *   `undefined !== false` -> true  -> SPOKEN    (the fail-OPEN relaxation)
 */
const authorityCouldNotAnswer = (): ResultsSectionDataReturn => {
  const data = genuineDecision()
  const recommendation = { ...data.recommendation }
  // `delete`, not `= undefined`. The reader's first branch is
  // `rec.leaderDesignationPermitted != null`, which an explicit `undefined`
  // also fails — but ABSENT is the shape the hook emits when its producer never
  // ran, and a fixture should be the shape rather than a value that happens to
  // behave like it. The field is optional on the type, so this is legal.
  delete recommendation.leaderDesignationPermitted
  return { ...data, recommendation }
}

describe('the producer caveat is MOUNTED on the tab, with the real authority', () => {
  beforeEach(() => setBrief(briefWithCaveat()))

  /**
   * ⭐ THE MOUNT. Delete the `<RobustnessCaveat/>` line from
   * `AnalysisNewTabBody` and this is the case that REDs.
   */
  it('is mounted, and renders the producer sentence through the tab', () => {
    drawTab(genuineDecision())
    expect(screen.getByTestId(`${TID}-text`)).toHaveTextContent(PRODUCER_TEXT)
  })

  /**
   * ⭐ THE AUTHORITY PASS-THROUGH, WITHHELD ARM. Hardcode the prop at the mount
   * site to `true`, or hardcode `leaderClaimPermitted` in the view model, and
   * this REDs — the harm the component's own header warns about.
   */
  it('says nothing when the producer withheld the ranking — through the mount, not the prop', () => {
    drawTab(decisionWithLeaderWithheld())
    expect(screen.getByTestId('analysis-new-tab-body')).toBeInTheDocument()
    expect(screen.queryByTestId(TID)).toBeNull()
  })

  /**
   * ⭐⭐ THE FAIL-OPEN DIRECTION, and the only case that can see it. Relax the
   * view model's `=== true` to `!== false` and this REDs while its twin above
   * stays green — sensitivity to the NAMED cell, not to the predicate at large.
   */
  it('says nothing when the authority could not answer at all', () => {
    drawTab(authorityCouldNotAnswer())
    expect(screen.getByTestId('analysis-new-tab-body')).toBeInTheDocument()
    expect(screen.queryByTestId(TID)).toBeNull()
  })
})
