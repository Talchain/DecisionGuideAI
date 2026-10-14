import { describe, expect, it } from 'vitest'
import { resolveLodMetricLine, type LodMetricLineInputs } from '../lodMetricLine'
import { buildRunView } from '../../../runView/runView'

const licence = { code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
  option_ids: ['a', 'b'], pct_by_option: { a: 41, b: 20 }, withheld_option_ids: [],
  target: { comparator: 'at_least', value: 100, unit: '£' } }
const ctx = { goalChanceHeroSays: true, labelOf: (id: string) => id }
const inputs = { nodeType: 'option', data: {}, label: 'a',
  displayMetadata: { isResultsMode: true, winRate: 0.8 },
  facts: { optionResultCaption: 'Current model', optionInterventionCount: 2 } } as LodMetricLineInputs

describe('reduced option line uses the same RunView chance cell', () => {
  it('figure: exact cell text after the run-currency caption', () => {
    const view = buildRunView({ inference_warnings: [licence] })
    expect(view.chanceCellOf).toBeTypeOf('function')
    const cell = view.chanceCellOf('a', ctx)
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: cell } })).toBe(`Current model · ${cell.text}`)
  })
  it('none: winRate cannot block the existing Changes N factors fall-through', () => {
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: { kind: 'none', text: null } } })).toBe('Changes 2 factors')
  })
})
