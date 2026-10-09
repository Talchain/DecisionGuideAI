/**
 * Existing synthetic tests predate RunView. Give their explicitly supplied goal quantity a
 * test licence so they keep exercising their positive branch; joint-only, identity-held and
 * certainty-held entries remain unlicensed. S1's served-byte parity suite independently tests
 * disagreeing/withheld/range cells and a raw figure with no licence.
 */
export function licensedTestReport<T>(report: T): T {
  if (!report || typeof report !== 'object') return report
  const record = report as Record<string, any>
  if (record.inference_warnings?.some((w: any) => w.code === 'GOAL_CHANCE_LICENSED')) return report
  const entries = Object.entries(record.option_probabilities ?? {}).filter(([, value]) => {
    const p = value as any
    return p && p.goalIdentityWithheld !== true && p.goalCertaintyUnearned === undefined
      && typeof (p.goal_probability ?? p.probability_of_goal) === 'number'
  })
  if (entries.length === 0) return report
  // The licence schema compares at least two options; singleton fixtures name a separate control.
  if (entries.length === 1) entries.push(['s1_control_option', { goal_probability: 0 }])
  return { ...record, inference_warnings: [...(record.inference_warnings ?? []), {
    code: 'GOAL_CHANCE_LICENSED', form: 'each', severity: 'info', message: 'licensed',
    target: { unit: 'GBP', value: 100, comparator: 'at_least' },
    option_ids: entries.map(([id]) => id),
    pct_by_option: Object.fromEntries(entries.map(([id, p]) => [id, Math.round(((p as any).goal_probability ?? (p as any).probability_of_goal) * 100)])),
  }] } as T
}
