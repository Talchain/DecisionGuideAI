import { withCanonicalTestCells } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { buildRunView } from '../../runView/runView'
import * as resultsData from '../../../components/results/useResultsSectionData'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../../../components/results/analysis-hero/__fixtures__/hero.fixtures'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
// #2931: the card's line is the served face less its own leading ‘label’: (spelt here, never the provider's helper, so a
// regression in that helper turns this RED). The face must carry the prefix, or the expectation would be vacuous.
const lineOf = (face: string) => {
  expect(face, 'the served face starts with its own ‘label’:').toMatch(/^‘.+?’: ./)
  return face.replace(/^‘.+?’: /, '')
}

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
  // Post-C UI item 1 (DL, 12 Oct): the card says CEE's served cell for this option, verbatim (`servedCellOf`). In C it showed
  // none (U0). The negatives stay: no joint words, no share of runs.
  it('the card says CEE\'s served cell verbatim, with no joint words or share of runs', () => {
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
    const served = data.runView!.servedCellOf(a.id)
    const cellText = served?.kind === 'figure' ? served.face ?? served.display : ''
    expect(cellText).toContain('73%')
    const card = render(<ReactFlowProvider><OptionChanceCellProvider>
      <OptionNode id={a.id} type="option" data={node.data as never} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </OptionChanceCellProvider></ReactFlowProvider>)
    const face = screen.getByTestId(`option-win-readout-${a.id}`)
    const row = screen.getByTestId(`option-analysis-currency-${a.id}`)
    // #2931 (DL 22 Oct): the named card drops the face's own ‘label’: prefix; its accessible name keeps the full face.
    expect(face.textContent).toBe(lineOf(cellText))
    expect(face.textContent).not.toContain(a.label)
    // Currentness is a separate, existing prefix in the row's name.
    expect(row).toHaveAccessibleName(`Current model · ${cellText}`)
    expect(card.container.textContent).not.toMatch(/and limits|limits together/i)
    expect(card.container.textContent).not.toMatch(/of runs/i)
    for (const element of card.container.querySelectorAll('[aria-label]')) {
      expect(element.getAttribute('aria-label')).not.toMatch(/and limits|limits together|of runs/i)
    }
  })
})
