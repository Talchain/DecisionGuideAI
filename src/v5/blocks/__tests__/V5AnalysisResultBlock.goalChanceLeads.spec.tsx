import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import { useCanonicalAnalysisViewStore } from '../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../canvas/runView/canonicalAnalysisView'
import { goalProbabilityWords } from '../../../components/results/utils/goalAnchorCopy'

const OPTIONS = [
  ['launch', 'Launch starter tier'],
  ['raise', 'Raise prices 10%'],
  ['annual', 'Offer annual contracts'],
  ['hold', 'Keep the current plan'],
] as const

const LICENCE = {
  code: 'GOAL_CHANCE_LICENSED',
  severity: 'info',
  message: 'Goal chances licensed.',
  form: 'each',
  option_ids: OPTIONS.map(([id]) => id),
  pct_by_option: { launch: 52, raise: 16, annual: 0, hold: 0 },
  target: { comparator: 'at_least', value: 1000, unit: 'customers' },
}

function d1w5Block(warning: Record<string, unknown> | null = LICENCE): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    computed_against_hash: 'graph-hash-d1w5',
    // #2747 r2: the run id the card's own turn stamped on it (its canonical view's Run).
    run_id: 'run-d1w5',
    summary: 'The analysis completed for all four options.',
    leading_option_id: 'launch',
    // The served d1w-5 values. The first value deliberately differs from the
    // licence's 52% goal chance: 73% is only the share of runs.
    win_probabilities: {
      'Launch starter tier': 0.73,
      'Raise prices 10%': 0.18,
      'Offer annual contracts': 0.06,
      'Keep the current plan': 0.03,
    },
    enrichment: {
      option_comparison: OPTIONS.map(([option_id, label], index) => ({
        option_id,
        label,
        probability_of_goal: [0.5222, 0.1567, 0, 0][index],
      })),
      inference_warnings: warning === null ? [] : [warning],
    },
  } as V5AnalysisResultBlockType
}

const initialState = useCanvasStore.getState()

/**
 * #2747 chance authority gate: the card's Run held with its matching (run id AND graph hash), current canonical view.
 * #2747 r2: CEE's served cells carry each option's sentence as their face (`goal-chance-screen-lines.ts`: the label, the
 * displayed figure, then "chance of meeting your goal, in this model."); the card says it verbatim.
 */
function hold(licence: { option_ids: readonly string[]; pct_by_option: Record<string, number> }) {
  const labelOf = (id: string) => OPTIONS.find(([optionId]) => optionId === id)?.[1]
  useCanonicalAnalysisViewStore.getState().adopt('scn-d1w5', parseCanonicalAnalysisView({
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', leader_licence: 'withheld',
    run: { run_id: 'run-d1w5', graph_hash_at_run: 'graph-hash-d1w5', computed_at: null },
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
      limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    options: licence.option_ids.map(option_id => ({ option_id, main_driver: { kind: 'not_recorded' },
      cell: { kind: 'figure', display: goalProbabilityWords(`${licence.pct_by_option[option_id]}%`),
        face: `‘${labelOf(option_id)}’: ${goalProbabilityWords(`${licence.pct_by_option[option_id]}%`)} chance of meeting your goal, in this model.` } })),
  }))
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: OPTIONS.map(([id, label]) => ({
      id,
      type: 'option',
      position: { x: 0, y: 0 },
      data: { label },
    })),
    results: null,
    ceeAnalysisReady: null,
    currentScenarioId: 'scn-d1w5',
  } as never)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState(initialState, true)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('V5AnalysisResultBlock goal chances lead run shares', () => {
  it('R1: the served each licence puts the goal chance before the first percentage', () => {
    hold(LICENCE)
    const { container } = render(<V5AnalysisResultBlock block={d1w5Block()} />)
    const chances = screen.getByTestId('v5-analysis-result-goal-chances')
    expect(within(chances).getAllByRole('listitem').map((line) => line.textContent)).toEqual([
      '‘Launch starter tier’: about 52% chance of meeting your goal, in this model.',
      '‘Raise prices 10%’: about 16% chance of meeting your goal, in this model.',
      '‘Offer annual contracts’: less than 1% chance of meeting your goal, in this model.',
      '‘Keep the current plan’: less than 1% chance of meeting your goal, in this model.',
    ])

    // The first TEXT node carrying a % in document order is what the user reads first; its element must be a chance line.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let firstPercentElement: HTMLElement | undefined
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      if (n.textContent?.includes('%')) { firstPercentElement = n.parentElement ?? undefined; break }
    }
    expect(firstPercentElement).toBeDefined()
    expect(chances).toContainElement(firstPercentElement!)
    expect(firstPercentElement).toHaveTextContent('chance of meeting your goal')
  })

  it('R2: without this Run\'s licence, no headline is added and the pills are unchanged', () => {
    render(<V5AnalysisResultBlock block={d1w5Block(null)} />)
    expect(screen.queryByTestId('v5-analysis-result-goal-chances')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('v5-analysis-result-probabilities')).getAllByRole('listitem').map((pill) => pill.textContent)).toEqual([
      'Launch starter tier· supported by 73% of runs',
      'Raise prices 10%· supported by 18% of runs',
      'Offer annual contracts· supported by 6% of runs',
      'Keep the current plan· supported by 3% of runs',
    ])
  })

  it('R3: a highest licence follows option_ids rather than descending run share', () => {
    const optionIds = ['hold', 'raise', 'launch', 'annual']
    const highest = {
      ...LICENCE,
      form: 'highest',
      option_ids: optionIds,
      leader_option_id: 'hold',
      next_option_id: 'raise',
      pct_by_option: { hold: 64, raise: 43, launch: 30, annual: 12 },
    }
    hold(highest)
    render(<V5AnalysisResultBlock block={d1w5Block(highest)} />)
    const lines = within(screen.getByTestId('v5-analysis-result-goal-chances')).getAllByRole('listitem')
    expect(lines.map((line) => line.dataset.optionId)).toEqual(optionIds)
    expect(lines.map((line) => OPTIONS.find(([id]) => line.dataset.optionId === id)?.[1])).toEqual([
      'Keep the current plan',
      'Raise prices 10%',
      'Launch starter tier',
      'Offer annual contracts',
    ])
  })
})
