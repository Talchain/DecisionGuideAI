import { optionChanceCell, runViewOf } from '../../../runView/runView'

/** Add an explicit chance licence without changing the fixture's comparative runs shares. */
export function withLicensedOptionChances<T extends object>(report: T, percentages: Record<string, number>) {
  const source = report as Record<string, unknown>
  const probabilities = (source.option_probabilities ?? {}) as Record<string, object>
  return {
    ...report,
    option_probabilities: Object.fromEntries(Object.entries(probabilities).map(([id, probability]) => [
      id, { ...probability, ...(id in percentages ? { goal_probability: percentages[id] / 100 } : {}) },
    ])),
    inference_warnings: [
      ...((source.inference_warnings ?? []) as object[]),
      {
        code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'Not shown.', form: 'each',
        option_ids: Object.keys(percentages), pct_by_option: percentages,
        target: { comparator: 'at_least', value: 100, unit: 'GBP' },
      },
    ],
  }
}

/** Expected words come from the same RunView authority, with the fixture's Results label context. */
export function fixtureChanceText(report: object, optionId: string, labels: Record<string, string>) {
  return optionChanceCell(runViewOf(report), optionId, {
    goalChanceHeroSays: true, labelOf: id => labels[id] ?? null,
  }).text
}
