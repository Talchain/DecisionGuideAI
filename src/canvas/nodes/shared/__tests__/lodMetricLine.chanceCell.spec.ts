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
    // Vision spec row 2 (23 Oct): a current Run's "Current model" caption is retired from the line.
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: cell } })).toBe(cell.text)
  })
  it('vision spec row 1: the reduced line is the card\'s headline, CEE\'s own display, verbatim; a "Last run" caption stays', () => {
    const cell = { kind: 'figure', text: 'about 66% chance of ‘Reach 150 orders’ being at least 150, in this model.', display: 'about 66%' } as const
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: cell } })).toBe('about 66%')
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionResultCaption: 'Last run', optionChanceCell: cell } }))
      .toBe('Last run · about 66%')
    const range = { kind: 'range', text: 'between about 30% and 60% chance of ‘Reach 150 orders’, in this model.', display: 'between about 30% and 60%' } as const
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: range } })).toBe('between about 30% and 60%')
    // CONTRAST: a withheld cell has no display and keeps CEE's withheld face.
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: { kind: 'withheld', text: 'Chance not shown yet' } } }))
      .toBe('Chance not shown yet')
  })
  it('none: winRate cannot block the existing Changes N factors fall-through', () => {
    expect(resolveLodMetricLine({ ...inputs, facts: { ...inputs.facts, optionChanceCell: { kind: 'none', text: null } } })).toBe('Changes 2 factors')
  })
})
