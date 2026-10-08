import { buildRunView } from '../../src/canvas/runView/runView'

/** Isolated card mounts supply the Results context boundary, using the real RunView authority.
 * Chance figures are explicit fixture inputs, never derived from win shares or display metadata.
 */
export function optionChanceFixture(pctByOption: Record<string, number>) {
  const view = buildRunView({ inference_warnings: [{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
    option_ids: Object.keys(pctByOption), pct_by_option: pctByOption, withheld_option_ids: [],
    target: { comparator: 'at_least', value: 100, unit: '£' },
  }] })
  return (id: string) => view.chanceCellOf(id, { goalChanceHeroSays: true, labelOf: optionId => optionId })
}
