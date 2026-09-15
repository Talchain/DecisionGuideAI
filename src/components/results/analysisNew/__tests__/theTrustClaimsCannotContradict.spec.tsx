/**
 * ⛔⛔ TWO SURFACES, OPPOSITE POLARITY, ONE RUN — AND NOTHING COUPLES THEM.
 *
 * `ModelHeldUp` renders a POSITIVE claim about the whole model ("Your model
 * held up under testing"). `RobustnessCaveat` renders a NEGATIVE one about the
 * same run's robustness. Their gates are INDEPENDENT:
 *
 *   ModelHeldUp      : !preRun && !stale && !provisional
 *                      && verdictTone === 'stable'
 *                      && evidenceAssessed && gapCount === 0
 *   RobustnessCaveat : leaderClaimPermitted
 *                      && a producer `robustness_caveat` exists
 *                      && it does not duplicate the verdict reason
 *
 * Neither predicate mentions the other's inputs, so a run that satisfies both
 * puts a reassurance and a caveat about the same thing on one screen.
 *
 * ⭐ THIS IS THE SAME DEFECT `ModelHeldUp`'s OWN HEADER RECORDS HAVING FIXED,
 * AGAINST A DIFFERENT NEIGHBOUR. Its comment describes rendering "Your model
 * held up" directly beneath an `AtAGlance` naming results that never came
 * back — "the surface would contradict itself in adjacent elements, with the
 * confident sentence second" — and closes it by adding an `isProvisional`
 * limb. That remedy was scoped to THAT neighbour. `RobustnessCaveat` is a
 * second neighbour and the limb does not reach it.
 *
 * ⚠ WHAT THIS SPEC CLAIMS, PRECISELY. It claims the two components CAN render
 * together for one run's inputs. It does NOT claim CEE emits a
 * `robustness_caveat` on a `stable` run — that is a producer question, settled
 * upstream, and the coupling defect is worth closing either way: a predicate
 * pair that can contradict is a latent contradiction whether or not today's
 * producer happens to walk into it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { ModelHeldUp } from '../sections/ModelHeldUp'
import { RobustnessCaveat } from '../sections/RobustnessCaveat'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useCanvasStore } from '../../../../canvas/store'

const CAVEAT_TID = 'analysis-new-robustness-caveat'

/** A valid DecisionBriefV1 whose only populated member is the caveat. */
const briefWithCaveat = () => ({
  version: '1',
  brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  created_at: '2026-09-08T12:00:00.000Z',
  robustness_caveat: {
    text: 'The ordering held in 84% of runs; below a 12% conversion rate it reverses.',
    basis: '2,000 simulated futures',
  },
})

const setBrief = (decision_brief: unknown) => {
  useCanvasStore.setState({
    results: { ...useCanvasStore.getState().results, report: { decision_brief } },
  } as never)
}

beforeEach(() => setBrief(briefWithCaveat()))
afterEach(() => cleanup())

describe('the panel cannot reassure and caveat the same run', () => {
  /**
   * The run `ModelHeldUp` demands. Every value is one the component REQUIRES —
   * none is chosen to provoke, and removing any one takes the section off the
   * screen on its own.
   */
  const heldUpInputs = {
    verdictTone: 'stable' as const,
    evidenceAssessed: true,
    gapCount: 0,
    isStale: false,
    isPreRun: false,
    isProvisional: false,
  }

  /**
   * ⭐ CONTROL A — THE REASSURANCE IS REACHABLE. Without it, the case below
   * passes for the wrong reason: a `ModelHeldUp` that never renders at all
   * cannot contradict anything, and the suite would applaud.
   */
  it('CONTROL A: with no producer caveat, the reassurance renders', () => {
    setBrief({ version: '1', brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', created_at: '2026-09-08T12:00:00.000Z' })
    render(<ModelHeldUp {...heldUpInputs} testId="held-up" />)
    expect(screen.getByTestId('held-up')).toBeInTheDocument()
  })

  /**
   * ⭐ CONTROL B — THE CAVEAT IS REACHABLE ON THE SAME RUN. Together with A
   * this proves BOTH statements are live for these inputs, so the case below
   * is a real discrimination and not a vacuous pass.
   */
  it('CONTROL B: with a producer caveat, the caveat renders', () => {
    setBrief(briefWithCaveat())
    render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
    expect(screen.getByTestId(CAVEAT_TID)).toBeInTheDocument()
  })

  /**
   * ⛔ THE CASE. One run, both surfaces mounted as the tab mounts them.
   */
  it('never puts the reassurance and the caveat on one screen', () => {
    setBrief(briefWithCaveat())
    render(
      <>
        <ModelHeldUp {...heldUpInputs} testId="held-up" />
        <RobustnessCaveat leaderClaimPermitted verdictReason={null} />
      </>,
    )

    const reassurance = screen.queryByText(COPY.heldUp.title)
    const caveat = screen.queryByTestId(CAVEAT_TID)

    expect(
      reassurance !== null && caveat !== null,
      'the panel told the reader the model held up AND named the condition under which it reverses, for the same run',
    ).toBe(false)
    // ⭐ AND THE SURVIVOR IS THE PRODUCER'S, NOT OURS. Suppressing the wrong
    // one would pass the assertion above while hiding a measured condition.
    expect(caveat, 'the producer-authored caveat must be the statement that survives').not.toBeNull()
  })

  /**
   * ⭐ THE WITHHELD RUN KEEPS ITS REASSURANCE. A caveat CEE sent but the
   * surface may not show is not on screen, so it cannot contradict — and must
   * not silence anything. Without this the fix trades one defect for a run
   * that says nothing at all.
   */
  it('a caveat the surface may not show does not silence the reassurance', () => {
    setBrief(briefWithCaveat())
    render(<ModelHeldUp {...heldUpInputs} leaderClaimPermitted={false} testId="held-up" />)
    expect(screen.getByTestId('held-up')).toBeInTheDocument()
  })
})
