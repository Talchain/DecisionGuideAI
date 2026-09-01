/**
 * An honest sentence is followed by the move that answers it, and a section
 * holding one item does not charge a click to show it.
 *
 * ⚠⚠ WHY THESE TWO SIT TOGETHER. They are one complaint measured twice: the
 * panel was optimised for truthfulness and never for usefulness. "We cannot
 * confirm whether this analysis reflects the current model" is TRUE and leaves
 * the reader nowhere to go; a collapsed row reading "1" is HONEST and charges
 * an interaction for a single line. Neither is a falsehood, and both are the
 * same defect.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { genuineDecision } from './analysisNewFixtures'

afterEach(cleanup)

const draw = (over = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

describe('the staleness ribbon carries the act that settles it', () => {
  /**
   * ⚠ THE UNCONFIRMED STATE IS THE ONE THAT WAS STRANDED. The shell's
   * `ReanalyseBar` renders on `changed`, plus cannot-confirm ONLY under an
   * import hold — so an ordinary unconfirmed run got the sentence and no
   * control anywhere on the panel.
   */
  it('offers the re-run beside "we cannot confirm"', async () => {
    const onReanalyse = vi.fn()
    draw({ isStale: true, staleReason: 'unconfirmed', onReanalyse })
    expect(screen.getByTestId('analysis-new-status-freshness-unknown')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('analysis-new-glance-ribbon-reanalyse'))
    expect(onReanalyse).toHaveBeenCalledTimes(1)
  })

  it('offers it beside "the model changed" too — one act settles both', () => {
    draw({ isStale: true, staleReason: 'changed', onReanalyse: vi.fn() })
    expect(screen.getByTestId('analysis-new-status-stale')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-glance-ribbon-reanalyse')).toHaveTextContent(
      COPY.status.reanalyseToBeSure,
    )
  })

  /**
   * ⚠ FAIL-CLOSED, AND IT IS THE DISCRIMINATING HALF. Without this, the two
   * cases above would pass on a component that renders the button
   * unconditionally — including on hosts with no handler, where it would be a
   * dead affordance.
   */
  it('renders NO control when there is no handler to run', () => {
    draw({ isStale: true, staleReason: 'unconfirmed', onReanalyse: undefined })
    expect(screen.getByTestId('analysis-new-status-freshness-unknown')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-ribbon-reanalyse')).toBeNull()
  })

  /**
   * ⚠ AND NO RIBBON MEANS NO BUTTON. A control that outlived its own sentence
   * would be an unexplained affordance on a run with nothing wrong with it.
   */
  it('renders no control on a run that is not stale at all', () => {
    draw({ isStale: false, onReanalyse: vi.fn() })
    expect(screen.queryByTestId('analysis-new-glance-ribbon')).toBeNull()
    expect(screen.queryByTestId('analysis-new-glance-ribbon-reanalyse')).toBeNull()
  })
})
