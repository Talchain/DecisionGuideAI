/**
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

/** The served line, byte for byte (audit #8 and `uncertaintyCalibration.ts` TENTATIVE_TEXT). */
const TENTATIVE = 'This result is tentative. The uncertainty is substantial.'

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

  it('⭐ with the reply on screen: no heading, no frame; the fold and the uncertainty line are inline', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), REPLY_WORDS)
    expect(queryByTestId('v5-analysis-result-heading')).toBeNull()

    const line = getByTestId('v5-analysis-result-uncertainty-copy')
    expect(line.textContent).toBe(TENTATIVE)
    expect(line).toBeVisible()

    // The anchor the Run-return scroll lands on survives, unframed.
    const anchor = getByTestId('v5-analysis-result')
    expect(anchor.getAttribute('data-presentation')).toBe('inline')
    expect(anchor.className.split(/\s+/)).not.toContain('border')

    // Nothing is removed: the served summary is one click away, verbatim, behind a CLOSED fold.
    const fold = getByTestId('v5-analysis-result-summary-details') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(getByTestId('v5-analysis-result-summary-toggle').textContent).toContain('Details')
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(String(SERVED.summary))
  })

  it('⭐ a ONE-WORD reply ("Done.") also folds the summary, so it must stay reachable, never dropped', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), 1)
    expect(queryByTestId('v5-analysis-result-heading')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(String(SERVED.summary))
  })

  it('CONTROL — the leader-named twin keeps the framed card (the pill row is a body)', () => {
    const { getByTestId } = mount(leaderNamedTwin(), REPLY_WORDS)
    expect(getByTestId('v5-analysis-result-probabilities')).toBeInTheDocument()
    expect(getByTestId('v5-analysis-result-heading').textContent).toBe('Analysis result')
    expect(getByTestId('v5-analysis-result-summary-details')).toBeInTheDocument()
    expect(getByTestId('v5-analysis-result').getAttribute('data-presentation')).toBe('card')
  })

  it('CONTROL — no reply text on the turn: the framed card with the open summary stays (it is the only account)', () => {
    const { getByTestId, queryByTestId } = mount(servedBlock(), 0)
    expect(getByTestId('v5-analysis-result-heading').textContent).toBe('Analysis result')
    expect(queryByTestId('v5-analysis-result-summary-details')).toBeNull()
    expect(getByTestId('v5-analysis-result-summary').textContent).toBe(String(SERVED.summary))
    expect(getByTestId('v5-analysis-result-uncertainty-copy').textContent).toBe(TENTATIVE)
  })
})
