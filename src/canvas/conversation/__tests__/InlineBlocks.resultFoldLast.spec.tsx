/** U7: the open analysis summary retains its producer order ahead of the uncertainty line. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

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

afterEach(() => cleanup())

type Wire = { assistant_text?: string; blocks?: Array<Record<string, unknown>> }
const C2_RUN = (servedJourneyC673223 as { turns: Array<{ turn: string; json: Wire }> }).turns.find(
  (t) => t.turn === 'C2 run',
)!.json
const SERVED = C2_RUN.blocks!.find((b) => b.type === 'analysis_result')!

const servedBlock = (): V5AnalysisResultBlockType =>
  ({ ...JSON.parse(JSON.stringify(SERVED)), type: 'v5_analysis_result' }) as V5AnalysisResultBlockType
const leaderNamedTwin = (): V5AnalysisResultBlockType => ({ ...servedBlock(), leading_option_id: 'Raise to £59 with release' })

const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function mount(block: V5AnalysisResultBlockType, words: number) {
  return render(<InlineBlocks blocks={[block]} turnId="t-run" assistantTextWordCount={words} />)
}

describe('B4: the result fold closes the result, never opens it', () => {

  it('CONTRAST — no reply on the turn: nothing is folded; the summary is the card\'s first body text, as today', () => {
    const { getByTestId, queryByTestId } = mount(leaderNamedTwin(), 0)
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(follows(getByTestId('v5-analysis-result-heading'), getByTestId('v5-analysis-result-summary'))).toBe(true)
    expect(follows(getByTestId('v5-analysis-result-summary'), getByTestId('v5-analysis-result-uncertainty-copy'))).toBe(true)
  })
})
