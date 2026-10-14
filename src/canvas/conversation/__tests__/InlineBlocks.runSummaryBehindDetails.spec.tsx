/** U7: the served analysis summary remains visible alongside assistant_text; no default Details fold. */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

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

describe('U7: the served Run summary is visible in full', () => {
  it('keeps the summary visible beside the reply, with no closed Details fold', () => {
    const { getByTestId, queryByTestId } = mount(REPLY_WORDS)
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary')).toBeVisible()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(BLOCK.summary)
  })
  it('PRECONDITION: the served summary is long and restates the reply', () => {
    expect(BLOCK.summary.split(/\s+/).length).toBeGreaterThan(100)
    expect(BLOCK.summary).toContain('could not be checked')
    expect(REPLY_WORDS).toBeGreaterThan(0)
  })

  it('CONTROL — no reply text on the turn: the summary stays open (it is the only account)', () => {
    const { queryByTestId, getByTestId } = mount(0)
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary')).toBeVisible()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(BLOCK.summary)
  })
})
