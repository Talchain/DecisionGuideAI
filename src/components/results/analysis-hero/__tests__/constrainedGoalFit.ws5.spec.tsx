import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { buildRunView } from '../../../../canvas/runView/runView'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { DecisionMatrix } from '../../analysisNew/sections/DecisionMatrix'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { goalChanceHeroArmOpen } from '../../utils/goalChanceLicence'
import { selectGoalProbability } from '../../utils/selectGoalProbability'
import { chanceCellOf } from './helpers/chanceCellOf'

// Existing fixture: useResultsSectionData.goalProbability.spec.ts,
// "CONSTRAINED: goal figure present ...": goal=.4, joint=.2, c1/n1 max 1.
// Staging measurement /private/tmp/ws5-core-constrained.md: staging selected
// goal_probability=.4 yet printed "About 40% chance of meeting your goal and
// limits, in this model." HEAD printed licence=73% with separate joint words.
// C-FALSE: joint words beside a goal-only figure removed (DL ruling 8 Oct; staging measurement /private/tmp/ws5-core-constrained.md)
const CONSTRAINED = {
  probability_of_goal: 0.4,
  probability_of_joint_goal: 0.2,
  constraint_analysis: {
    constraints: [{ constraint_id: 'c1', node_id: 'n1', direction: 'max', threshold: 1 }],
    joint_probability: 0.2,
  },
}
const JOINT_WORDS = /and limits|limits together/i

function dataFor(allConstrained: boolean) {
  const selection = selectGoalProbability(CONSTRAINED)
  const a = makeOption({ ...OPTION_A, goalProbability: selection.goalProbability,
    constraintAnalysis: CONSTRAINED.constraint_analysis as never })
  const b = makeOption({ ...OPTION_B,
    ...(allConstrained ? { constraintAnalysis: CONSTRAINED.constraint_analysis as never } : {}) })
  const data = makeHeroData({ options: [a, b], recommendation: { storyHeadlines: {} } })
  // Diagnostic licence, not live wire: distinguish it from both raw quantities.
  data.runView = buildRunView({ inference_warnings: [{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
    option_ids: [a.id, b.id], pct_by_option: { [a.id]: 73, [b.id]: 49 },
    target: { comparator: 'at_least', value: 62, unit: 'count' },
  }] })
  data.goalChanceLicence = data.runView.goalChance
  expect(data.goalChanceLicence).not.toBeNull()
  return data
}

function assertRows(allConstrained: boolean) {
  const data = dataFor(allConstrained)
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected populated chart')
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  render(<><AnalysisHeroPanel model={model} rerunDisabled={false} /><DecisionMatrix
    data={data} comparison={vm.optionsComparison} optionOrder={[OPTION_A.id, OPTION_B.id]}
    run={{}} isStale={false} /></>)
  fireEvent.click(screen.getByRole('tab', { name: /Goal fit/ }))
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  for (const row of model.rows) {
    const element = screen.getByTestId(`hero-option-row-${row.index}`)
    fireEvent.click(within(element).getByRole('button'))
    const detail = within(element).getByTestId('hero-detail-goal-fit')
    const cellText = screen.getByTestId(`decision-matrix-chance-${row.id}`).querySelector('span')!.textContent
    expect(cellText).toBeTruthy()
    expect(cellText).toBe(chanceCellOf(data, row.id).text)
    expect(row.goal.readout).toBe(cellText)
    expect(row.detail.goalFit).toBe(cellText)
    expect(element.querySelector('.text-right > span')!.textContent).toBe(cellText)
    expect(detail.textContent).toBe(cellText)
    // Check the whole row and expanded region: a separate false line must
    // fail even when the actual goal-fit sentence still equals the cell.
    expect(element.textContent, `${row.id}: no joint words beside its goal-only cell`).not.toMatch(JOINT_WORDS)
    expect(within(element).getByTestId('hero-option-detail').textContent).not.toMatch(JOINT_WORDS)
  }
  expect(model.rows.find(r => r.id === OPTION_A.id)!.goal.readout).toContain('73%')
  expect(model.rows.find(r => r.id === OPTION_B.id)!.goal.readout).toContain('49%')
  return data
}

afterEach(cleanup)

describe('WS5 constrained goal-fit acceptance', () => {
  it('constrained and unconstrained rows and details equal their Matrix cells without joint words', () => {
    assertRows(false)
  })
  it('all-constrained rows retain cell parity; the pre-existing lens caption stays unchanged', () => {
    const data = assertRows(true)
    expect(screen.getByTestId('hero-caption').textContent).toBe('Each value is the chance that option meets your goal and limits together.')
    expect(goalChanceHeroArmOpen(data.recommendation.goalThreshold, data.recommendation.allOptions)).toBe(false)
  })
  it('keeps the measured selector basis: goal and joint remain distinct quantities', () => {
    const selection = selectGoalProbability(CONSTRAINED)
    expect(selection.basis).toBe('goal_probability')
    expect(selection.goalProbability).toBe(0.4)
    expect(selection.jointGoalProbability).toBe(0.2)
  })
})
