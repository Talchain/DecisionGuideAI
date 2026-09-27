/**
 * ⭐ THE RESULT'S "DETAILS" FOLD COMES AFTER WHAT THE RESULT SAYS (Paul's test, 27 Sep 2026, UI e8ba18e6; AIC B4).
 *
 * The analysis block drew its closed "▸ Details" (the summary restating the reply) ABOVE its own content. On the
 * card, it sat between the heading and the reliability line and shares. Under a reply, it stacked as a third
 * disclosure below "Show more" and "N questions this model does not answer yet", in a different style (a caret, not
 * the chat's chevron). The content now comes first, and the fold closes the result, as "Show less" does (#2169).
 * No text changes.
 */
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
const REPLY_WORDS = String(C2_RUN.assistant_text).trim().split(/\s+/).length

const servedBlock = (): V5AnalysisResultBlockType =>
  ({ ...JSON.parse(JSON.stringify(SERVED)), type: 'v5_analysis_result' }) as V5AnalysisResultBlockType
const leaderNamedTwin = (): V5AnalysisResultBlockType => ({ ...servedBlock(), leading_option_id: 'Raise to £59 with release' })

const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function mount(block: V5AnalysisResultBlockType, words: number) {
  return render(<InlineBlocks blocks={[block]} turnId="t-run" assistantTextWordCount={words} />)
}

describe('B4: the result fold closes the result, never opens it', () => {
  it('RED (inline form, under a reply): the reliability line comes first, then "Details"', () => {
    const { getByTestId } = mount(servedBlock(), REPLY_WORDS)
    expect(getByTestId('v5-analysis-result')).toHaveAttribute('data-presentation', 'inline')
    const line = getByTestId('v5-analysis-result-uncertainty-copy')
    const fold = getByTestId('v5-analysis-result-summary-details')
    expect(follows(line, fold), 'the fold follows the line it would otherwise sit above').toBe(true)
  })

  it('RED (card form, leader named): the reliability line and the shares come first, the fold last', () => {
    const { getByTestId } = mount(leaderNamedTwin(), REPLY_WORDS)
    expect(getByTestId('v5-analysis-result')).toHaveAttribute('data-presentation', 'card')
    const fold = getByTestId('v5-analysis-result-summary-details')
    expect(follows(getByTestId('v5-analysis-result-heading'), getByTestId('v5-analysis-result-uncertainty-copy'))).toBe(true)
    expect(follows(getByTestId('v5-analysis-result-uncertainty-copy'), fold)).toBe(true)
    expect(follows(getByTestId('v5-analysis-result-probabilities'), fold)).toBe(true)
  })

  it('RED: the fold reads like the chat\'s other disclosures: the same word, the chevron instead of "▸"', () => {
    const { getByTestId } = mount(servedBlock(), REPLY_WORDS)
    const toggle = getByTestId('v5-analysis-result-summary-toggle')
    expect(toggle.textContent?.trim()).toBe('Details')
    expect(toggle.textContent).not.toContain('▸')
    expect(toggle.querySelector('svg'), 'a chevron icon, as on "Show more"').not.toBeNull()
  })

  it('CONTRAST — no reply on the turn: nothing is folded; the summary is the card\'s first body text, as today', () => {
    const { getByTestId, queryByTestId } = mount(leaderNamedTwin(), 0)
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(follows(getByTestId('v5-analysis-result-heading'), getByTestId('v5-analysis-result-summary'))).toBe(true)
    expect(follows(getByTestId('v5-analysis-result-summary'), getByTestId('v5-analysis-result-uncertainty-copy'))).toBe(true)
  })
})
