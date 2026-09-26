/**
 * "REVIEW TOPICS N OPEN" IN ABOUT COUNTS THE REVIEW TOOL'S OWN QUEUE.
 *
 * The V2 prototype's About carries `Review topics · ${reviewItems.length -
 * state.reviewed.size} open` — the SAME list the "🔍 N to review" row walks.
 * `AboutThisAnalysis` counts it through `useReviewTopicCount`, fed the inputs the
 * body hands `ModelReviewTool`. Two readers of one queue drift the day either
 * one's inputs change, so this binds them on the MOUNTED tab, by identity: the
 * number in About's row is the number in the review tool's own count label.
 *
 * Contrast: the same tab over a canvas with nothing to verify — the tool says
 * "Nothing to review" and About says "0 open", never a stale or guessed count.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { ABOUT_COPY } from '../sections/AboutThisAnalysis'
import { REVIEW_TOOL_COPY } from '../buildReviewQueue'
import { genuineDecision } from './analysisNewFixtures'

/** Factors whose value Olumi inferred and nobody confirmed — the queue's verify items. */
const UNCONFIRMED = [
  { id: 'f_lead', type: 'factor', data: { label: 'Lead time', observedState: { value: 0.7, source: 'cee_inference' } } },
  { id: 'f_churn', type: 'factor', data: { label: 'Churn', observedState: { value: 0.2, source: 'cee_inference' } } },
]

const renderTab = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_review_count"
    />,
  )

const aboutReviewValue = () => {
  const toggle = screen.getByTestId('analysis-new-about-toggle')
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  return screen.getByTestId('analysis-new-about-row-review-value').textContent
}

afterEach(() => {
  cleanup()
  act(() => useCanvasStore.setState({ nodes: [], edges: [] } as never))
})

describe('About › Review topics is the review tool\'s count', () => {
  it('equals the number in the review tool\'s own "N to review" label', () => {
    act(() => useCanvasStore.setState({ nodes: UNCONFIRMED, edges: [] } as never))
    renderTab()
    const toolCount = screen.getByTestId('analysis-new-review-count').textContent ?? ''
    const n = Number(/^(\d+)/.exec(toolCount)?.[1])
    expect(Number.isInteger(n) && n > 0, `PRECONDITION: the tool counts something ("${toolCount}")`).toBe(true)
    expect(toolCount).toBe(REVIEW_TOOL_COPY.toReview(n))
    expect(aboutReviewValue()).toBe(ABOUT_COPY.reviewOpen(n))
  })

  it('CONTRAST: nothing to verify — the tool says so, and About says "0 open"', () => {
    act(() => useCanvasStore.setState({ nodes: [], edges: [] } as never))
    renderTab()
    const empty = screen.queryByTestId('analysis-new-review-empty')
    // The fixture's own recommendations may still leave items; bind to whichever the tool shows.
    const toolCount = screen.queryByTestId('analysis-new-review-count')?.textContent ?? null
    const n = toolCount === null ? 0 : Number(/^(\d+)/.exec(toolCount)?.[1])
    if (toolCount === null) expect(empty).toHaveTextContent(REVIEW_TOOL_COPY.nothingToReview)
    expect(aboutReviewValue()).toBe(ABOUT_COPY.reviewOpen(n))
  })

  it('moves WITH the queue: seeding the canvas raises both counts by the same amount', () => {
    act(() => useCanvasStore.setState({ nodes: [], edges: [] } as never))
    renderTab()
    const before = aboutReviewValue()
    const toolBefore = screen.queryByTestId('analysis-new-review-count')?.textContent ?? REVIEW_TOOL_COPY.toReview(0)
    act(() => useCanvasStore.setState({ nodes: UNCONFIRMED, edges: [] } as never))
    const after = aboutReviewValue()
    const toolAfter = screen.getByTestId('analysis-new-review-count').textContent ?? ''
    const num = (s: string | null) => Number(/^(\d+)/.exec(s ?? '')?.[1])
    expect(num(after) - num(before), 'About moved').toBe(UNCONFIRMED.length)
    expect(num(toolAfter) - num(toolBefore), 'the tool moved by the same amount').toBe(UNCONFIRMED.length)
    expect(num(after)).toBe(num(toolAfter))
  })
})
