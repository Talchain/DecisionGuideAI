/**
 * (Shared set-up copied from InlineBlocks.noEmptyResultCard.spec.tsx.)
 * ⭐ AFTER A RUN, NO EMPTY "Analysis result ▸ Details" CARD (design audit #8, 26 Sep 2026).
 *
 * Served on UI `853feeb7` (pricing starter, one OpenAI Run, 1280×800): the Olumi
 * tab held a 382×107.5 bordered card whose whole face was a heading, a closed
 * "▸ Details" and one sentence, "This result is tentative. The uncertainty is
 * substantial." The folded summary restates the reply directly above it, so the
 * card read as an empty frame (screenshot
 * `run-1280x800-pricing-model-03-tab-Olumi.png`; rerun capture
 * `joined-1-cd6a82e4-5f941f2/06-rerun.png` shows one such frame per Run).
 *
 * THE RULE: when the summary is behind the disclosure (the reply is on screen)
 * and nothing else would render on the card (no win-share row, no review prose),
 * there is no card FRAME: no heading, no border. The closed "Details" fold (the
 * summary, verbatim) and the uncertainty line render inline. Nothing is removed:
 * `assistantTextWordCount > 0` holds for a one-word reply too, so the reply is
 * never assumed to carry the summary's account. The `v5-analysis-result` element
 * stays as the unframed anchor the Run-return scroll lands on.
 *
 * FIXTURE: the served `analysis_result` block of the c673223 "C2 run" turn,
 * whole (summary, enrichment, win_probabilities, `leading_option_id: null`).
 * That is the audit's shape: a withheld leader (no pill row), `decision_review:
 * null` (no prose), `robustness.level: 'low'` (the TENTATIVE line).
 *
 * CLAIM TYPE: jsdom DOM through `InlineBlocks`, the call site that sets
 * `summaryBehindDisclosure`. No model calls.
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

/** The same bytes with the producer's leader named: the win-share row renders, so the card has a body. */
const leaderNamedTwin = (): V5AnalysisResultBlockType => ({
  ...servedBlock(),
  leading_option_id: 'Raise to £59 with release',
})

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
  it('⭐ the card form (served block, leader named) carries a complete success border and ONE success dot', () => {
    const { getByTestId, getAllByTestId } = mount(leaderNamedTwin(), REPLY_WORDS)
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

  it('CONTRAST: the inline form (served withheld block, reply on screen) has no dot and no border', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), REPLY_WORDS)
    const anchor = getByTestId('v5-analysis-result')
    expect(anchor.getAttribute('data-presentation')).toBe('inline')
    expect(queryByTestId('block-badge-dot')).toBeNull()
    expect(anchor.className.split(/\s+/)).not.toContain('border-success/30')
  })

  it('the open card with no reply on screen (the only account of the run) is the success block too', () => {
    const { getByTestId, getAllByTestId } = mount(servedBlock(), 0)
    expect(getByTestId('v5-analysis-result').className.split(/\s+/)).toContain('border-success/30')
    expect(getAllByTestId('block-badge-dot')).toHaveLength(1)
  })
})
