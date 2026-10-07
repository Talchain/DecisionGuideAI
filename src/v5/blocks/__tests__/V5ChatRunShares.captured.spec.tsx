import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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

// Ignore percentages that are part of the OPTION'S OWN NAME ("Raise prices by 10%").
// Mutation control: restoring either old formatter makes these exact row assertions RED.
const SHARES: Record<string, string> = {
  'Launch starter tier': '60%',
  'Raise prices by 10%': '35%',
  'Keep pricing as it is': '6%',
}

describe('chat run shares on S1 draw 1 (UI ed8889ae / CEE bdf5716)', () => {
  it('the real analysis block labels every share, retaining the captured goal probabilities', () => {
    expect(capture.block.enrichment.option_comparison.map(option => option.probability_of_goal)).toEqual([0.331, 0.5055, 0])
    render(<V5AnalysisResultBlock block={analysis()} />)
    const rows = within(screen.getByTestId('v5-analysis-result-probabilities')).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      const label = row.querySelector('.font-medium')!.textContent!
      expect(row).toHaveTextContent(`${label}· supported by ${SHARES[label]} of runs`)
      expect(row.lastElementChild!.textContent).not.toMatch(/^\s*·\s*\d+%\s*$/)
    }
  })

  it('the comparison table uses the same share caption for the captured values', () => {
    render(<V5ComparisonBlock block={comparison()} />)
    for (const option of capture.block.enrichment.option_comparison) {
      const cells = within(screen.getByTestId(`v5-comparison-row-${option.option_id}`)).getAllByRole('cell')
      expect(cells[1].textContent).toBe(`supported by ${SHARES[option.label]} of runs`)
      expect(cells[1].textContent).not.toMatch(/^\d+%$/)
    }
  })

  it('keeps per-option chance prose verbatim and before the smaller share details', () => {
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
    const shares = screen.getByTestId('v5-analysis-result-probabilities')
    for (const row of screen.getAllByTestId('v5-analysis-result-story-headline')) {
      expect(row.lastElementChild!.textContent).toBe(stories[row.dataset.optionId as keyof typeof stories])
      expect(row.compareDocumentPosition(shares) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(within(shares).getAllByRole('listitem')[0].className).toContain('text-xs')
  })

  it('keeps the real withheld-goal run words and share suppression unchanged', () => {
    render(<V5AnalysisResultBlock block={analysis(withheldCapture.block)} />)
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toBe(withheldCapture.block.summary)
    expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    useCanvasStore.setState({ results: { report: {
      producer_leader_permission: { permitted: false, producer_cause: 'constraint_verdict_withheld' },
    } } } as unknown as Partial<ReturnType<typeof useCanvasStore.getState>>)
    render(<V5ComparisonBlock block={comparison()} />)
    expect(screen.getByTestId('v5-comparison-not-ranked')).toHaveTextContent("An exploratory comparison: Olumi couldn't check your target or limits on this run, so it isn't naming an option.")
    expect(screen.queryByText(/supported by .* of runs/)).toBeNull()
  })
})
