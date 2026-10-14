import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as AnalysisBlock, V5ComparisonBlock as ComparisonBlock } from '../../../canvas/conversation/types'
import { mapV5Block } from '../mapV5Blocks'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { V5ComparisonBlock } from '../V5ComparisonBlock'
import capture from './fixtures/scout-s1-run1.analysis-block.json'
import withheldCapture from './fixtures/openai-57f903c-pricing-explicit-run.analysis-block.json'

const analysis = (wire: unknown = capture.block): AnalysisBlock =>
  mapV5Block(wire as Parameters<typeof mapV5Block>[0]) as AnalysisBlock
const comparison = (): ComparisonBlock => ({
  type: 'v5_comparison',
  options: capture.block.enrichment.option_comparison.map(option => ({
    option_id: option.option_id, label: option.label, win_probability: option.win_probability,
  })),
})
const initialState = useCanvasStore.getState()
afterEach(() => { cleanup(); useCanvasStore.setState(initialState, true) })

// #2747 re-scope 2: the captured share captions (SHARES) went with the pill-row assertions that read them, below.

describe('chat run shares on S1 draw 1 (UI ed8889ae / CEE bdf5716)', () => {
  // #2747 re-scope 2 (U0 rewrite): was "the real analysis block labels every share, retaining the captured goal
  // probabilities". The captured-goal-probabilities assertion is kept as written; the three "supported by N% of runs"
  // pill assertions became the absence check (DL ruling (A): C shows no win share on any Run), on the same S1 capture.
  it('the real analysis block retains the captured goal probabilities: still no win-share row in C (ruling (A))', () => {
    expect(capture.block.enrichment.option_comparison.map(option => option.probability_of_goal)).toEqual([0.331, 0.5055, 0])
    render(<V5AnalysisResultBlock block={analysis()} />)
    // Non-vacuity: the card rendered its summary.
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toBe(capture.block.summary)
    expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    // ⚠ This capture's CEE-authored summary itself says "…in 60% of runs of this model…", rendered verbatim, so the
    // `/of runs/` scan reads the card WITHOUT that one node (fixture unchanged; flagged to the DL). The pill caption
    // ("supported by N% of runs") is checked across the whole card.
    const card = screen.getByTestId('v5-analysis-result')
    expect(card.textContent ?? '').not.toMatch(/supported by .* of runs/)
    const cardWithoutSummary = card.cloneNode(true) as HTMLElement
    cardWithoutSummary.querySelector('[data-testid="v5-analysis-result-summary"]')!.remove()
    expect(cardWithoutSummary.textContent ?? '').not.toMatch(/of runs/)
  })

  // #2747 re-scope 2 (DL ruling (A)): row 'the comparison table uses the same share caption for the captured values'
  // deleted — its only subject, the chat comparison block's share column, was removed in C (V5ComparisonBlock: Option-only
  // table; census row V5ComparisonBlock covers the absence).

  // #2747 re-scope 2 (mixed row, DL ruling (A)): was "keeps per-option chance prose verbatim and before the smaller
  // share details". The pill assertions are deleted (each story headline precedes the pill row; the first pill is
  // `text-xs`): C shows no win-share row. The verbatim per-option chance prose assertion is kept as written.
  it('keeps per-option chance prose verbatim', () => {
    // Controlled 0.30 review twin: the scout's chances are delivered outside this
    // card. Exercise the card's existing story channel without inventing a goal formatter.
    const stories = {
      raise_prices_by_10: 'about 33% chance of meeting your goal',
      launch_starter_tier: 'about 51% chance of meeting your goal',
      keep_pricing_as_it_is: 'less than 1% chance of meeting your goal',
    }
    const block = analysis({ ...capture.block, enrichment: {
      ...capture.block.enrichment,
      decision_review: { produced_at: '2026-10-06T23:27:37Z', story_headlines: stories },
    } })
    render(<V5AnalysisResultBlock block={block} />)
    for (const row of screen.getAllByTestId('v5-analysis-result-story-headline')) {
      expect(row.lastElementChild!.textContent).toBe(stories[row.dataset.optionId as keyof typeof stories])
    }
  })

  it('keeps the real withheld-goal run words and share suppression unchanged', () => {
    render(<V5AnalysisResultBlock block={analysis(withheldCapture.block)} />)
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toBe(withheldCapture.block.summary)
    expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    useCanvasStore.setState({ results: { report: {
      producer_leader_permission: { permitted: false, producer_cause: 'constraint_verdict_withheld' },
    } } } as unknown as Partial<ReturnType<typeof useCanvasStore.getState>>)
    render(<V5ComparisonBlock block={comparison()} />)
    // #2747 re-scope 2 (DL ruling (A)): the `v5-comparison-not-ranked` line assertion deleted — that line was removed with
    // the comparison block's share column in C. The no-share negative stays.
    expect(screen.queryByText(/supported by .* of runs/)).toBeNull()
  })
})
