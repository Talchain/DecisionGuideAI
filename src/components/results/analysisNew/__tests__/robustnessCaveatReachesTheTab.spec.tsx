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

import { RobustnessCaveat } from '../sections/RobustnessCaveat'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useCanvasStore } from '../../../../canvas/store'

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
})
