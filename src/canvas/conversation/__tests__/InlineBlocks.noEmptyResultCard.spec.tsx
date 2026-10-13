/** U7: the full summary remains visible. K1: preserve uncertainty and never expose an unlicensed probability. */
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

/** The served line, byte for byte (audit #8 and `uncertaintyCalibration.ts` TENTATIVE_TEXT). */
const TENTATIVE = 'This result is tentative. The uncertainty is substantial.'

const servedBlock = (): V5AnalysisResultBlockType =>
  ({ ...JSON.parse(JSON.stringify(SERVED)), type: 'v5_analysis_result' }) as V5AnalysisResultBlockType

/** The same bytes with the producer's leader named. In C no win-share row renders for it (ruling (A)), so no body. */
const leaderNamedTwin = (): V5AnalysisResultBlockType => ({
  ...servedBlock(),
  leading_option_id: 'Raise to £59 with release',
})

/** The same bytes with review prose (the 0.30 `decision_review` shape): a body, so the card keeps its frame. */
const proseTwin = (): V5AnalysisResultBlockType => {
  const b = servedBlock() as unknown as { enrichment: Record<string, unknown> }
  return { ...b, enrichment: { ...b.enrichment, decision_review: { produced_at: '2026-07-30T00:00:00.000Z',
    narrative_summary: 'The review’s own account of the run.' } } } as unknown as V5AnalysisResultBlockType
}

function mount(block: V5AnalysisResultBlockType, assistantTextWordCount: number) {
  return render(
    <InlineBlocks blocks={[block]} turnId="t-run" assistantTextWordCount={assistantTextWordCount} />,
  )
}

describe('audit #8: the served withheld Run renders no empty result card', () => {
  it('PRECONDITION: the served block is the audit shape (withheld leader, no review prose, low robustness)', () => {
    const b = servedBlock() as unknown as Record<string, unknown>
    const enrichment = b.enrichment as Record<string, unknown>
    expect(b.leading_option_id).toBeNull()
    expect(enrichment.decision_review ?? null).toBeNull()
    expect((enrichment.robustness as Record<string, unknown>).level).toBe('low')
    expect(Object.keys(b.win_probabilities as Record<string, number>).length).toBe(3)
    expect(REPLY_WORDS).toBeGreaterThan(0)
  })

  it('U7: with the reply on screen, the whole summary and uncertainty remain visible', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), REPLY_WORDS)
    expect(getByTestId('v5-analysis-result-heading')).toBeVisible()

    const line = getByTestId('v5-analysis-result-uncertainty-copy')
    expect(line.textContent).toBe(TENTATIVE)
    expect(line).toBeVisible()

    // The anchor the Run-return scroll lands on survives, unframed.
    const anchor = getByTestId('v5-analysis-result')
    expect(anchor.getAttribute('data-presentation')).toBe('card')
    expect(anchor.className.split(/\s+/)).toContain('border')

    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary')).toBeVisible()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(String(SERVED.summary))
  })

  it('U7: even a one-word reply keeps the full summary visible', () => {
    const { getByTestId } = mount(servedBlock(), 1)
    expect(getByTestId('v5-analysis-result-heading')).toBeVisible()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(String(SERVED.summary))
  })

  // #2747 re-scope 2 (U0 rewrite): the leader-named twin's body was the win-share pill row, which C does not show (DL ruling
  // (A)). The body is now the review's prose; the leader-named twin has no body, so it is unframed like the served block.
  it('K1: review prose stays visible; a named leader never exposes an unlicensed probability', () => {
    const { getByTestId, unmount } = mount(proseTwin(), REPLY_WORDS)
    expect(getByTestId('v5-analysis-result-narrative-summary')).toBeInTheDocument()
    expect(getByTestId('v5-analysis-result-heading').textContent).toBe('Analysis result')
    expect(getByTestId('v5-analysis-result-summary')).toBeVisible()
    expect(getByTestId('v5-analysis-result').getAttribute('data-presentation')).toBe('card')
    unmount()
    const named = mount(leaderNamedTwin(), REPLY_WORDS)
    expect(named.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    expect(named.getByTestId('v5-analysis-result').getAttribute('data-presentation')).toBe('card')
  })

  it('CONTROL — no reply text on the turn: the framed card with the open summary stays (it is the only account)', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), 0)
    expect(getByTestId('v5-analysis-result-heading').textContent).toBe('Analysis result')
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(String(SERVED.summary))
    expect(getByTestId('v5-analysis-result-uncertainty-copy').textContent).toBe(TENTATIVE)
  })
})
