/** P02 GR2: the persisted chat card keeps Olumi's reading in each figure's sentence. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import capture from './fixtures/scout-s1-run1.analysis-block.json'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { mapV5Block } from '../mapV5Blocks'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as AnalysisBlock } from '../../../canvas/conversation/types'

const READING_LABEL = {
  v: 1, source: 'olumi_reading',
  goal: { id: 'mrr', label: 'MRR' },
  factors: [
    { id: 'pro_plan_price', label: 'Pro plan price' },
    { id: 'pro_paying_subscribers', label: 'Pro paying subscribers' },
  ],
  addends: [{ id: 'mrr_lost_to_price_driven_churn', label: 'MRR lost to price-driven churn', sign: 'less' }],
}
const INITIAL_STATE = useCanvasStore.getState()

function block(readingLabel?: unknown): AnalysisBlock {
  const wire = structuredClone(capture.block)
  if (arguments.length > 0) {
    const licence = (wire.enrichment.inference_warnings as Record<string, unknown>[])
      .find((warning) => warning.code === 'GOAL_CHANCE_LICENSED')!
    licence.reading_label = readingLabel
  }
  return mapV5Block(wire as unknown as Parameters<typeof mapV5Block>[0]) as AnalysisBlock
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: capture.block.enrichment.option_comparison.map((option) => ({
      id: option.option_id,
      type: 'option',
      position: { x: 0, y: 0 },
      data: { label: option.label },
    })),
    results: null,
    ceeAnalysisReady: null,
  } as never)
})
afterEach(() => { cleanup(); useCanvasStore.setState(INITIAL_STATE, true) })

describe('P02 GR2: the chat card renders the goal reading beside every figure', () => {
  it('renders the exact labelled sentences from this persisted block, including its zero chance', () => {
    render(<V5AnalysisResultBlock block={block(READING_LABEL)} />)
    const lines = within(screen.getByTestId('v5-analysis-result-goal-chances')).getAllByRole('listitem')
    expect(lines.map((line) => line.dataset.optionId)).toEqual([
      'raise_prices_by_10', 'launch_starter_tier', 'keep_pricing_as_it_is',
    ])
    expect(lines.map((line) => line.textContent)).toEqual([
      '‘Raise prices by 10%’: about 33% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’, less ‘MRR lost to price-driven churn’ (Olumi’s reading).',
      '‘Launch starter tier’: about 51% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’, less ‘MRR lost to price-driven churn’ (Olumi’s reading).',
      '‘Keep pricing as it is’: less than 1% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’, less ‘MRR lost to price-driven churn’ (Olumi’s reading).',
    ])
  })

  it('CONTROL: without reading_label the served card keeps the exact plain figure sentences', () => {
    render(<V5AnalysisResultBlock block={block()} />)
    expect(within(screen.getByTestId('v5-analysis-result-goal-chances')).getAllByRole('listitem').map((line) => line.textContent)).toEqual([
      '‘Raise prices by 10%’: about 33% chance of meeting your goal, in this model.',
      '‘Launch starter tier’: about 51% chance of meeting your goal, in this model.',
      '‘Keep pricing as it is’: less than 1% chance of meeting your goal, in this model.',
    ])
  })

  it('a malformed reading_label never renders a bare goal-chance figure', () => {
    render(<V5AnalysisResultBlock block={block({ ...READING_LABEL, factors: [READING_LABEL.factors[0]] })} />)
    expect(screen.queryByTestId('v5-analysis-result-goal-chances')).not.toBeInTheDocument()
  })

  it('D: a persisted reading withhold without a reading_label cannot print plain licensed figures', () => {
    const card = block()
    const warnings = card.enrichment!.inference_warnings as unknown[]
    warnings.push({
      code: 'GOAL_FIGURES_READING_UNCONFIRMED', option_ids: ['raise_prices_by_10'],
      withheld_claims: ['joint_probability'], message: 'Not shown. Confirm the goal reading.',
    })
    render(<V5AnalysisResultBlock block={card} />)
    expect(screen.queryByTestId('v5-analysis-result-goal-chances')).not.toBeInTheDocument()
  })
})
