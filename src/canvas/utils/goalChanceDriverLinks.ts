import { runViewOf } from '../runView/runView'

export const GOAL_CHANCE_DRIVER_TAG = 'Chance rests most on this'

/** The tag paints above resting cards (z 0) and below a selected card (1000). */
export const GOAL_CHANCE_DRIVER_TAG_Z = 1

const EMPTY_LINKS: ReadonlyMap<string, readonly string[]> = new Map()
const reportCache = new WeakMap<object, ReadonlyMap<string, readonly string[]>>()

export function goalChanceDriverLinkKey(from: string, to: string): string {
  return `${from}\u0000${to}`
}

/** Project only the licence's quoted link drivers, preserving model option order. */
export function goalChanceDriverLinks(report: unknown): ReadonlyMap<string, readonly string[]> {
  if (report === null || typeof report !== 'object') return EMPTY_LINKS
  const cached = reportCache.get(report)
  if (cached) return cached

  const licence = runViewOf(report).goalChance
  const links = new Map<string, string[]>()
  for (const optionId of licence?.optionIds ?? []) {
    const driver = licence?.driverByOption?.[optionId]
    if (driver?.kind !== 'link_strength' && driver?.kind !== 'link_existence') continue
    const key = goalChanceDriverLinkKey(driver.from, driver.to)
    const ids = links.get(key)
    if (ids) ids.push(optionId)
    else links.set(key, [optionId])
  }
  reportCache.set(report, links)
  return links
}

export function goalChanceDriverTagAria(optionLabels: readonly string[]): string {
  if (optionLabels.length === 0) {
    return 'In this model, an option’s chance of meeting your goal rests most on this link. Open the link.'
  }
  const quoted = optionLabels.map(label => `‘${label}’`)
  const names = quoted.length === 1
    ? quoted[0]
    : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
  return `In this model, the chance of meeting your goal for ${names} rests most on this link. Open the link.`
}
