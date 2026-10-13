/** U7: the visible analysis summary uses the existing result card treatment. */
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

/**
 * #2747 re-scope 2 (U0 rewrite): the card's body used to be the leader-named win-share row, which C does not show (DL
 * ruling (A)). Review prose (the 0.30 `decision_review` shape) is a body, so this twin keeps the framed card.
 */
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


/**
 * ⭐ DS v5 §21.2 ON THE ANALYSIS RESULT CARD (Paul's chat design list; routed by AI Conversation #70 5849309793).
 * A FactBlock is the success colour: a complete `border-success/30` border and an 8px success dot, top-left.
 * ONLY the framed card form carries it. The inline form (#2118: no frame, the fold + the uncertainty line) never
 * does, or a dot would sit orphaned beside "▸ Details". The dot is painted by the block itself, because only the
 * block knows which form it renders (the parent's `resolveBlockBadgeDotClass` has no `v5_analysis_result` case).
 */
describe('DS v5 §21.2: the framed analysis result card is the success block', () => {
  it('⭐ the card form (served block, with review prose) carries a complete success border and ONE success dot', () => {
    const { getByTestId, getAllByTestId } = mount(proseTwin(), REPLY_WORDS)
    const card = getByTestId('v5-analysis-result')
    expect(card.getAttribute('data-presentation')).toBe('card')
    expect(card.className.split(/\s+/)).toContain('border-success/30')
    expect(card.className.split(/\s+/)).not.toContain('border-panel-border')
    const dots = getAllByTestId('block-badge-dot')
    expect(dots).toHaveLength(1)
    expect(card.contains(dots[0]!)).toBe(true)
    expect(dots[0]!.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-success', 'rounded-full']))
    expect(dots[0]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('U7: the full summary keeps its card frame beside the reply', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), REPLY_WORDS)
    const anchor = getByTestId('v5-analysis-result')
    expect(anchor.getAttribute('data-presentation')).toBe('card')
    expect(queryByTestId('block-badge-dot')).toBeVisible()
    expect(anchor.className.split(/\s+/)).toContain('border-success/30')
  })

  it('the open card with no reply on screen (the only account of the run) is the success block too', () => {
    const { getByTestId, getAllByTestId } = mount(servedBlock(), 0)
    expect(getByTestId('v5-analysis-result').className.split(/\s+/)).toContain('border-success/30')
    expect(getAllByTestId('block-badge-dot')).toHaveLength(1)
  })
})
