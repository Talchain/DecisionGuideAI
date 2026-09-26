/**
 * ⭐⭐ S1 — "WHAT THIS RUN MAY NOT CONCLUDE" LEAVES THE DEFAULT SCROLL.
 *
 * Panel-lane design audit, 2026-09-25 (design wave 2). Paul's own withheld
 * run rendered the producer's refusal — "Every estimate this comparison
 * rests on is Olumi's, not yours…", the named parameters, and the "Review or
 * set an estimate" act — unconditionally, directly under "Record your view".
 * The prototype's default scroll ends at a single quiet "About this
 * analysis" line; nothing else is on it.
 *
 * The claim is not deleted and not reworded (`AtAGlance.tsx`'s own doc
 * comment on the block: "The sentence is the PRODUCER'S, rendered
 * unparaphrased and untruncated"). It moves behind a closed-at-rest
 * disclosure, one click away — this file pins that move.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheldAndReason } from './analysisNewFixtures'

const TOGGLE = 'analysis-new-glance-withheld-toggle'
const SENTENCE = 'analysis-new-glance-withheld-reason'
const CONTROL = 'analysis-new-glance-withheld-review-estimates'

const renderBody = (onReviewEstimates?: () => void) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={decisionWithLeaderWithheldAndReason()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_withheld_one_click"
      onReviewEstimates={onReviewEstimates}
    />,
  )

afterEach(() => {
  cleanup()
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})

describe('the withheld conclusion is closed at rest', () => {
  it('renders no refusal sentence, no named parameters and no review-estimates act on mount', () => {
    renderBody(vi.fn())
    expect(screen.queryByTestId(SENTENCE)).toBeNull()
    expect(screen.queryByTestId('analysis-new-glance-withheld-parameters')).toBeNull()
    expect(screen.queryByTestId(CONTROL)).toBeNull()
  })

  it('renders a closed toggle carrying the producer-facing label, not silence', () => {
    renderBody(vi.fn())
    const toggle = screen.getByTestId(TOGGLE)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle).toHaveTextContent(COPY.glance.eyebrowWhyWithheld)
  })

  it('is one click away: the toggle reveals the byte-identical sentence and act', () => {
    const onReviewEstimates = vi.fn()
    renderBody(onReviewEstimates)
    fireEvent.click(screen.getByTestId(TOGGLE))

    expect(screen.getByTestId(TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    const sentence = screen.getByTestId(SENTENCE)
    expect(sentence.textContent).toContain('no option can be called the leader')

    const control = screen.getByTestId(CONTROL)
    fireEvent.click(control)
    expect(onReviewEstimates).toHaveBeenCalledTimes(1)
  })

  it('closes again on a second click — a real disclosure, not a one-way reveal', () => {
    renderBody(vi.fn())
    const toggle = screen.getByTestId(TOGGLE)
    fireEvent.click(toggle)
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByTestId(SENTENCE)).toBeNull()
  })

  /**
   * ⭐ THE LABEL SAYS ITSELF ONCE, NOT TWICE. `firstViewportCensus.spec.tsx`'s
   * cross-section detector caught this the first time: the toggle's own label
   * and an inner "eyebrow" repeating it landed in two sections at once
   * ("root" + the opened region) the moment the disclosure opened.
   */
  it('does not restate its own label once opened', () => {
    renderBody(vi.fn())
    fireEvent.click(screen.getByTestId(TOGGLE))
    // The opened content's own `role="status"` region, not the toggle above
    // it (which legitimately carries the label as its button text).
    const region = screen.getByRole('status')
    expect(region.textContent).not.toContain(COPY.glance.eyebrowWhyWithheld)
  })
})

describe('the act stays reachable from the first screen even though its sentence does not', () => {
  const LINK = 'analysis-new-review-estimates-under-commitment'

  it('renders a quiet act directly under "Record your view", with no disclosure to open first', () => {
    renderBody(vi.fn())
    // Not gated behind the toggle above — reachable with zero clicks.
    expect(screen.queryByTestId(TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    const link = screen.getByTestId(LINK)
    expect(link).toBeInTheDocument()
    expect(link).toHaveTextContent(COPY.glance.reviewEstimates)
  })

  it('calls the SAME handler the disclosure\'s own act calls — one act, two doors', async () => {
    const onReviewEstimates = vi.fn()
    renderBody(onReviewEstimates)
    fireEvent.click(screen.getByTestId(LINK))
    expect(onReviewEstimates).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when there is no route to give the act', () => {
    renderBody(undefined)
    expect(screen.queryByTestId(LINK)).toBeNull()
  })

  it('renders nothing on a run whose refusal does not ask for an estimate', () => {
    // NOTHING_TO_COMPARE: the producer's own words ask for a different fix
    // ("Name at least two different options you are weighing"), which an
    // estimate cannot answer — `buildAnalysisNewViewModel.ts`'s own corpus
    // note names this exact code as one of the three that is "not about
    // estimates". This link reads `designationWithheldRemedy`, the identical
    // field `AtAGlance`'s own act gates on, so the two cannot disagree.
    const data = decisionWithLeaderWithheldAndReason()
    const withNoEstimateRemedy = {
      ...data,
      recommendation: {
        ...data.recommendation,
        analysisAdmission: {
          structurally_analysable: true,
          missing_important_inputs: [],
          semantic_quality_sufficient: false,
          permitted_analysis_mode: 'exploratory',
          reasons: [
            {
              field: 'permitted_analysis_mode',
              code: 'NOTHING_TO_COMPARE',
              message: 'Name at least two different options you are weighing.',
            },
          ],
        },
      },
    } as unknown as ResultsSectionDataReturn

    render(
      <AnalysisNewTabBody
        resultsSectionData={withNoEstimateRemedy}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_no_remedy"
        onReviewEstimates={vi.fn()}
      />,
    )
    // PRECONDITION, pinned in-test: the refusal itself is still on screen
    // (behind its own toggle), so the link's absence below is not simply the
    // whole withheld state failing to render (CLAUDE.md trap 13b).
    fireEvent.click(screen.getByTestId(TOGGLE))
    expect(screen.getByTestId(SENTENCE)).toHaveTextContent(
      'Name at least two different options you are weighing.',
    )
    expect(screen.queryByTestId(LINK)).toBeNull()
  })
})
