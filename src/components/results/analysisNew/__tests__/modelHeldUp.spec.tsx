/**
 * The success state renders on success, and — far more importantly — refuses
 * to render on the states that merely LOOK like it.
 *
 * ⚠⚠ THE REFUSALS ARE THE LOAD-BEARING CASES. This is the most dangerous
 * component on the panel: it speaks in the surface's most confident voice at
 * the moment a team is most likely to act. Every limb of its condition is a
 * different way of being wrong about that, so each gets its own case.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModelHeldUp, modelHeldUp } from '../sections/ModelHeldUp'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

afterEach(cleanup)

const PASSING = {
  verdictTone: 'stable' as const,
  evidenceAssessed: true,
  gapCount: 0,
  isStale: false,
  isPreRun: false,
  isProvisional: false,
}

const draw = (over: Partial<React.ComponentProps<typeof ModelHeldUp>> = {}) =>
  render(<ModelHeldUp {...PASSING} testId="held" {...over} />)

describe('it renders when the model genuinely held up', () => {
  it('states the result, and states it as a result about the MODEL', () => {
    draw()
    expect(screen.getByTestId('held-title')).toHaveTextContent(COPY.heldUp.title)
    expect(screen.getByTestId('held-limit')).toHaveTextContent(COPY.heldUp.limit)
  })

})

describe('it refuses every state that merely looks like success', () => {
  /**
   * ⭐⭐ THE ONE THAT MATTERS MOST. An empty gap list answers two questions —
   * "assessed, none found" and "never assessed" — and only the first licenses
   * this component. Without this limb the surface congratulates a team on a
   * model whose evidence was never examined.
   */
  it('NEVER renders when evidence was not assessed, even with zero gaps', () => {
    draw({ evidenceAssessed: false })
    expect(screen.queryByTestId('held')).toBeNull()
  })

  it('does not render when gaps were found', () => {
    draw({ gapCount: 1 })
    expect(screen.queryByTestId('held')).toBeNull()
  })

  it.each([['mixed'], ['sensitive']] as const)(
    'does not render on a %s verdict',
    (tone) => {
      draw({ verdictTone: tone })
      expect(screen.queryByTestId('held')).toBeNull()
    },
  )

  it('does not render with no verdict at all', () => {
    draw({ verdictTone: null })
    expect(screen.queryByTestId('held')).toBeNull()
  })

  /**
   * ⭐⭐ THE LIMB INDEPENDENT REVIEW FOUND, AND ITS OPPOSITE-DIRECTION TWIN.
   *
   * `robustnessVerdict` reads `robustness.display_verdict`, which is
   * independent of `win_probability` / `expected_outcome` completeness — so a
   * partial run still yields a `stable` tone and passed all four original
   * limbs. The banner would render DIRECTLY BENEATH an `AtAGlance` naming the
   * results that did not come back.
   *
   * ⚠ THE PAIR IS THE CLAIM. The refusal alone passes on a fifth limb that
   * suppresses the banner everywhere; the twin proves it suppresses only the
   * provisional case. They fail on DIFFERENT assertions — one that the banner
   * is absent, one that it is present.
   */
  it('does not render on a PARTIAL run, even with every other limb passing', () => {
    draw({ isProvisional: true })
    expect(screen.queryByTestId('held')).toBeNull()
  })

  it('…and STILL renders when the run is not partial — the twin', () => {
    draw({ isProvisional: false })
    expect(screen.getByTestId('held')).toBeInTheDocument()
  })

  /** A stale report cannot certify a model it may no longer describe. */
  it('does not render on a stale report', () => {
    draw({ isStale: true })
    expect(screen.queryByTestId('held')).toBeNull()
  })

  it('does not render pre-run — nothing has had the chance to hold up', () => {
    draw({ isPreRun: true })
    expect(screen.queryByTestId('held')).toBeNull()
  })
})

describe('the condition is testable as a condition', () => {
  it('is true only on the full conjunction', () => {
    expect(modelHeldUp(PASSING)).toBe(true)
  })

  /**
   * ⚠ EVERY LIMB IS LOAD-BEARING, ASSERTED ONE AT A TIME. A conjunction whose
   * limbs are only ever tested together can lose one silently — the remaining
   * limbs keep the happy path green and nothing reds.
   */
  it.each([
    ['evidence unassessed', { evidenceAssessed: false }],
    ['a gap found', { gapCount: 1 }],
    ['a mixed verdict', { verdictTone: 'mixed' as const }],
    ['no verdict', { verdictTone: null }],
    ['a stale report', { isStale: true }],
    ['pre-run', { isPreRun: true }],
    ['a partial run', { isProvisional: true }],
  ])('is false with %s', (_name, over) => {
    expect(modelHeldUp({ ...PASSING, ...over })).toBe(false)
  })
})

describe('the move', () => {
  it('offers the decision-recording ask', async () => {
    const onRecord = vi.fn()
    draw({ onRecord })
    await userEvent.click(screen.getByTestId('held-record'))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  /** Fail-closed: no handler, no button — never a dead affordance. */
  it('renders no button when there is nothing to run', () => {
    draw({ onRecord: undefined })
    expect(screen.getByTestId('held')).toBeInTheDocument()
    expect(screen.queryByTestId('held-record')).toBeNull()
  })
})
