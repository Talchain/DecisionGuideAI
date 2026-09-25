/**
 * ⭐ AFTER A RUN, THE REPLY LEADS AND THE ANALYSIS SUMMARY WAITS BEHIND "Details".
 *
 * Paul's brief for the chat after a Run: the conclusion first, one decisive
 * caveat, one real next action, and detail behind disclosure. On the served
 * OpenAI route (`c673223` "C2 run") the reply already says the conclusion in
 * five short lines, and the turn's `analysis_result.summary` then repeated it
 * as a ~140-word paragraph, open, straight underneath.
 *
 * THE RULE: when the turn's reply text is on screen (`assistantTextWordCount`
 * > 0), the card's summary sits inside a closed "Details" disclosure. Nothing
 * is removed or reworded; one click shows it verbatim. A turn with NO reply
 * text keeps the summary open, because then it is the only account of the run.
 *
 * CLAIM TYPE: jsdom DOM. The block is the served bytes, verbatim. No model calls.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import servedJourneyC673223 from './fixtures/openai-route-coaching-journey.c673223.json'
import { InlineBlocks } from '../InlineBlocks'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../types'

vi.mock('../../store', () => {
  const mockState = {
    nodes: [] as Array<{ id: string }>,
    selectNodeWithoutHistory: vi.fn(),
    selectNodes: vi.fn(),
    setShowInspectorPanel: vi.fn(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

type Wire = { assistant_text?: string; blocks?: Array<Record<string, unknown>> }
const C2_RUN = (servedJourneyC673223 as { turns: Array<{ turn: string; json: Wire }> }).turns.find(
  (t) => t.turn === 'C2 run',
)!.json
const served = C2_RUN.blocks!.find((b) => b.type === 'analysis_result')!
const BLOCK: V5AnalysisResultBlockType = {
  type: 'v5_analysis_result',
  summary: String(served.summary),
  leading_option_id: null,
}
const REPLY_WORDS = String(C2_RUN.assistant_text).trim().split(/\s+/).length

function mount(assistantTextWordCount: number) {
  return render(
    <InlineBlocks blocks={[BLOCK]} turnId="t-run" assistantTextWordCount={assistantTextWordCount} />,
  )
}

describe('the served Run turn: analysis summary placement (c673223 "C2 run")', () => {
  it('PRECONDITION: the served summary is long and restates the reply', () => {
    expect(BLOCK.summary.split(/\s+/).length).toBeGreaterThan(100)
    expect(BLOCK.summary).toContain('could not be checked')
    expect(REPLY_WORDS).toBeGreaterThan(0)
  })

  it('⭐ with the reply on screen: the summary is folded behind a closed "Details", verbatim inside', () => {
    const { getByTestId } = mount(REPLY_WORDS)
    const details = getByTestId('v5-analysis-result-summary-details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(getByTestId('v5-analysis-result-summary-toggle').textContent).toContain('Details')
    expect(getByTestId('v5-analysis-result-summary')).not.toBeVisible()
    // Nothing is lost: one click shows the producer's paragraph byte for byte.
    fireEvent.click(getByTestId('v5-analysis-result-summary-toggle'))
    expect(details.open).toBe(true)
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(BLOCK.summary)
  })

  it('CONTROL — no reply text on the turn: the summary stays open (it is the only account)', () => {
    const { queryByTestId, getByTestId } = mount(0)
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary')).toBeVisible()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(BLOCK.summary)
  })
})
