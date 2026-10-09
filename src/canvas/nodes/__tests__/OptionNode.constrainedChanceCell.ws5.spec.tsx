import { withCanonicalTestCells } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { buildRunView } from '../../runView/runView'
import * as resultsData from '../../../components/results/useResultsSectionData'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../../../components/results/analysis-hero/__fixtures__/hero.fixtures'
import { DecisionMatrix } from '../../../components/results/analysisNew/sections/DecisionMatrix'
import { buildAnalysisNewViewModel } from '../../../components/results/analysisNew/buildAnalysisNewViewModel'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))

// Same diagnostic fixture as constrainedGoalFit.ws5.spec.tsx: goal 40%,
// joint 20%, and a deliberately distinct licensed cell (73%).
const CONSTRAINED = {
  probability_of_goal: 0.4,
  probability_of_joint_goal: 0.2,
  constraint_analysis: {
    constraints: [{ constraint_id: 'c1', node_id: 'n1', direction: 'max', threshold: 1 }],
    joint_probability: 0.2,
  },
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useCanvasStore.setState({ nodes: [], edges: [], results: { status: 'idle', report: null }, analysisFreshness: null, analysisFreshnessDirty: false } as never)
})

describe('WS5 constrained option card chance cell', () => {
  it('face and accessible chance equal the Matrix cell without joint words or share of runs', () => {
    const selection = selectGoalProbability(CONSTRAINED)
    expect(selection.goalProbability).toBe(0.4)
    expect(selection.jointGoalProbability).toBe(0.2)
    const a = makeOption({ ...OPTION_A, goalProbability: selection.goalProbability,
      constraintAnalysis: CONSTRAINED.constraint_analysis as never })
    const data = makeHeroData({ options: [a, OPTION_B], recommendation: { storyHeadlines: {} } })
    const report = { inference_warnings: [{
      code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
      option_ids: [a.id, OPTION_B.id], pct_by_option: { [a.id]: 73, [OPTION_B.id]: 49 },
      target: { comparator: 'at_least', value: 62, unit: 'count' },
    }] }
    data.runView = buildRunView(report)
    data.goalChanceLicence = data.runView.goalChance
    Object.assign(data, withCanonicalTestCells(data))
    // Only the Results projection is supplied; the real provider resolves
    // the card's cell from RunView with the same context as the Matrix.
    vi.spyOn(resultsData, 'useResultsSectionData').mockReturnValue(data)
    const node = { id: a.id, type: 'option', position: { x: 0, y: 0 }, data: { label: a.label } }
    useCanvasStore.setState({ nodes: [node], edges: [], results: { status: 'complete', report },
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false } as never)
    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    const matrix = render(<DecisionMatrix data={data} comparison={vm.optionsComparison}
      optionOrder={[a.id, OPTION_B.id]} run={{}} isStale={false} />)
    fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
    const cellText = screen.getByTestId(`decision-matrix-chance-${a.id}`).querySelector('span')!.textContent!
    expect(cellText).toContain('73%')
    matrix.unmount()
    const card = render(<ReactFlowProvider><OptionChanceCellProvider>
      <OptionNode id={a.id} type="option" data={node.data as never} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </OptionChanceCellProvider></ReactFlowProvider>)
    const face = screen.getByTestId(`option-win-readout-${a.id}`)
    const row = screen.getByTestId(`option-analysis-currency-${a.id}`)
    expect(face.textContent).toBe(cellText)
    // Currentness is a separate, existing prefix in the row's name.
    expect(row).toHaveAccessibleName(`Current model · ${cellText}`)
    expect(row.getAttribute('aria-label')!.slice('Current model · '.length)).toBe(cellText)
    expect(card.container.textContent).not.toMatch(/and limits|limits together/i)
    expect(card.container.textContent).not.toMatch(/of runs/i)
    for (const element of card.container.querySelectorAll('[aria-label]')) {
      expect(element.getAttribute('aria-label')).not.toMatch(/and limits|limits together|of runs/i)
    }
  })
})
