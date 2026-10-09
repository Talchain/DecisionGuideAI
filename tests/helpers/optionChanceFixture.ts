import { canonicalFixtureRunView } from '../../src/components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { buildRunView } from '../../src/canvas/runView/runView'

/** Isolated card mounts supply the Results context boundary, using the real RunView authority.
 * Chance figures are explicit fixture inputs, never derived from win shares or display metadata.
 */
export function optionChanceFixture(pctByOption: Record<string, number>, withCanonicalView = false) {
  const report = { inference_warnings: [{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
    option_ids: Object.keys(pctByOption), pct_by_option: pctByOption, withheld_option_ids: [],
    target: { comparator: 'at_least', value: 100, unit: '£' },
  }] }
  const ctx = { goalChanceHeroSays: true, labelOf: (optionId: string) => optionId }
  const view = withCanonicalView ? canonicalFixtureRunView(report, ctx) : buildRunView(report)
  return (id: string) => view.chanceCellOf(id, ctx)
}
