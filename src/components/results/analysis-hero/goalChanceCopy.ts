/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE GOAL-CHANCE HEADLINE'S WORDS (Wording c6 #87 6005196947, amendment 6005256134, and the
 * 6 Oct rulings for the no-superlative headline; DL 0df0e1 6005048156). Each sentence is SELECTED by the `form` CEE
 * decided (`readGoalChanceLicence`, by identity) and FILLED with the option labels, the percentage CEE stored for each
 * option and the target as the user stated it. Nothing here compares a number.
 *
 * Every line is model-relative ("In this model, on current information") and says "chance of MEETING your goal" —
 * never "reaching" (`goalFigureSaysModelRuns` bans it, DL 6005048156 + c6 6005196947), never a contest word.
 */
import type { GoalChanceComparator, GoalChanceDriver, GoalChanceDriverNames, GoalChanceLicence } from '../utils/goalChanceLicence'
import { formatGoalTarget } from '../utils/formatGoalTarget'
import { GOAL_CHANCE_LABEL, goalProbabilityWords } from '../utils/goalAnchorCopy'
import { readGoalChanceByDate, type GoalChanceTarget } from '../utils/goalChanceTarget'
import type { GoalChanceRangeEntry } from '../utils/goalChanceRange'
import type { RunDeltaGoalChanceSide } from '@talchain/schemas/boundary'

const COMPARATOR_WORDS: Readonly<Record<GoalChanceComparator, string>> = {
  at_least: 'at least',
  above: 'above',
  at_most: 'at most',
  below: 'below',
}

/** Date words use UTC so the producer's calendar day cannot shift with the viewer's timezone. */
function shareByDateWords(target: GoalChanceTarget | undefined): { deliverable: string; date: string } | null {
  if (target === undefined || !target.unit.startsWith('% of ') || target.unit.slice(5).trim() === ''
    || readGoalChanceByDate(target.by_date) === undefined) return null
  return {
    deliverable: target.unit.slice(5),
    date: new Date(`${target.by_date}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }),
  }
}

/** The target as the user stated it, in their unit: "at most 400 cancellations/month". */
export function goalChanceTargetWords(licence: GoalChanceLicence): string | null {
  const share = shareByDateWords(licence.target)
  if (share !== null) return `${share.deliverable} done by ${share.date}`
  const figure = formatGoalTarget(licence.target.value, licence.target.unit, 'level')
  return figure === null ? null : `${COMPARATOR_WORDS[licence.target.comparator]} ${figure}`
}

/**
 * The displayed figure in words (c6 6 Oct): a chance that DISPLAYS as 0 (under 0.5%) is "less than 1%" and one that
 * displays as 100 (99.5% or more) is "more than 99%" — never "about 0%" (it reads as impossible) or "about 100%".
 */
const about = (pct: number | undefined): string =>
  goalProbabilityWords(`${pct}%`)
/** "a and b" / "a, b and c" — British, no serial comma. */
const listOf = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/**
 * The headline for a licensed Run, or `null` when a label or the target cannot be said (the surface then keeps the
 * headline it had). `labelOf` returns the option's display label, or null.
 */
export function goalChanceHeadline(licence: GoalChanceLicence, labelOf: (optionId: string) => string | null): string | null {
  const target = goalChanceTargetWords(licence)
  if (target === null) return null
  const lead = 'In this model, on current information,'
  switch (licence.form) {
    case 'highest': {
      const leader = labelOf(licence.leaderOptionId as string)
      const next = labelOf(licence.nextOptionId as string)
      if (leader === null || next === null) return null
      return `${lead} ‘${leader}’ has the highest chance of meeting your goal (${target}): `
        + `${about(licence.pctByOption[licence.leaderOptionId as string])}, against ${about(licence.pctByOption[licence.nextOptionId as string])} for ‘${next}’.`
    }
    case 'highest_all_likely_to_miss': {
      const leader = labelOf(licence.leaderOptionId as string)
      if (leader === null) return null
      return `${lead} every option is more likely to miss your goal (${target}) than meet it: `
        + `the highest chance is ${about(licence.pctByOption[licence.leaderOptionId as string])}, for ‘${leader}’.`
    }
    case 'all_likely_to_miss':
      return `${lead} every option is more likely to miss your goal (${target}) than meet it.`
    case 'similar': {
      // H2 (DL 0df0e1 6 Oct, below 10 points; c6 6 Oct: "similar", never "about the same" — 43 vs 48 is not the same): the
      // options in CEE's order, the figures in the same order, never one singled out.
      const labels = licence.similarOptionIds.map((id) => labelOf(id))
      if (labels.some((l) => l === null)) return null
      const named = listOf(labels.map((l) => `‘${l}’`))
      const figures = listOf(licence.similarOptionIds.map((id) => about(licence.pctByOption[id])))
      return `${lead} ${named} have similar chances of meeting your goal (${target}): ${figures}.`
    }
    case 'each':
      return `${lead} each option’s chance of meeting your goal (${target}):`
  }
}

/**
 * c6's per-option line (or, for an option CEE withheld for its own path, c6's withheld line), in the MODEL'S option order (`licence.optionIds`) — never sorted by chance: below the 10-point
 * licence a sort is a ranking the Run does not grant. `null` when any label cannot be said.
 * `includeQuotedDrivers` keeps a named driver's line for a quoted option, without repeating its headline percentage.
 */
export function goalChanceOptionLines(
  licence: GoalChanceLicence, labelOf: (optionId: string) => string | null, except: readonly string[] = [],
  driverLines: Readonly<Record<string, string>> = {},
  includeQuotedDrivers = false,
): string[] | null {
  const lines: string[] = []
  for (const id of licence.optionIds) {
    if (except.includes(id)) {
      const driver = driverLines[id]
      if (includeQuotedDrivers && driver !== undefined) {
        const label = labelOf(id)
        if (label === null) return null
        lines.push(`‘${label}’: ${driver}`)
      }
      continue
    }
    const label = labelOf(id)
    if (label === null) return null
    // c6 (6 Oct): an option withheld for its own path keeps its place, and says so — never "unknown", never "0%".
    if (licence.withheldOptionIds.includes(id)) {
      lines.push(`‘${label}’: Olumi can’t yet say its chance of meeting your goal, in this model.`)
      continue
    }
    // P3: what this option's chance rests on most follows its own line, when CEE named one that can be worded.
    const driver = driverLines[id]
    const share = shareByDateWords(licence.target)
    const chance = share === null ? GOAL_CHANCE_LABEL : `${shareChanceWords(share)}, in this model`
    lines.push(`‘${label}’: ${about(licence.pctByOption[id])} ${chance}.`
      + (driver === undefined ? '' : ` ${driver}`))
  }
  return lines
}

/** CEE `deliverableIsALaunch` twin (byte-for-byte logic, #2762 r5): the deliverable's HEAD (the words before the first
 * preposition) ends in "launch", or it is "launching <object>". "the security review before launch" is not a launch. */
const HEAD_PREPOSITIONS = new Set(['before', 'after', 'in', 'for', 'of', 'by', 'to', 'on', 'with', 'at', 'from', 'across'])
function deliverableIsALaunch(deliverable: string): boolean {
  const words = deliverable.trim().toLowerCase().split(/\s+/u)
  const preposition = words.findIndex(word => HEAD_PREPOSITIONS.has(word))
  const head = preposition < 0 ? words : words.slice(0, preposition)
  return head.at(-1) === 'launch'
    || (head[0] === 'launching' && head.slice(1).some(word => !['the', 'a', 'an', ''].includes(word)))
}

/**
 * The ruled share-by-date words (DL #2762 r3, CEE `shareGoalChanceWords` twin): a deliverable that names a launch reads
 * "chance of launching by <date>"; any other reads "chance of finishing <deliverable> by <date>".
 */
function shareChanceWords(share: { readonly deliverable: string; readonly date: string }): string {
  return deliverableIsALaunch(share.deliverable)
    ? `chance of launching by ${share.date}`
    : `chance of finishing ${share.deliverable} by ${share.date}`
}

/** CEE's range, with its stated estimate or canvas link labels; unresolved labels never expose ids. */
export function goalChanceRangeLine(
  range: GoalChanceRangeEntry, option: string | null, labelOf: (id: string) => string | null,
  target?: GoalChanceTarget,
): string | null {
  if (option === null || option.trim() === '') return null
  const share = shareByDateWords(target)
  if (range.kind === 'stated_time') {
    if (share === null) return null
    const estimate = range.statedEstimate
    const bounds = estimate.low === estimate.high ? `${estimate.low}` : `${estimate.low}–${estimate.high}`
    const stated = range.quantity === 'months_to_finish' ? `${bounds} months` : `${bounds}% a month`
    return `‘${option}’: between ${about(range.lowPct).replace(/^about /, '')} and ${about(range.highPct).replace(/^about /, '')} ${shareChanceWords(share)}, in this model, from the slow end of your ${stated} to the fast end.`
  }
  const from = labelOf(range.from)
  const to = labelOf(range.to)
  if (from === null || from.trim() === '' || to === null || to.trim() === '') return null
  const depends = range.among === 'unsized_links' ? 'Of the links not sized yet, it depends most on' : 'It depends most on'
  const link = range.kind === 'link_strength'
    ? `how strongly ‘${from}’ affects ‘${to}’, which isn’t sized in the model yet.`
    : `whether ‘${from}’ affects ‘${to}’ at all, which Olumi assumed.`
  return `‘${option}’: between ${about(range.lowPct)} and ${about(range.highPct).replace(/^about /, '')} chance of meeting your goal, in this model. ${depends} ${link}`
}

export const GOAL_CHANCE_RANGE_ACTION: Readonly<Record<Exclude<GoalChanceRangeEntry['kind'], 'stated_time'>, string>> = {
  link_strength: 'Size it to see where it lands',
  link_existence: 'Confirm or remove it to see where it lands',
}

const FALLING_SIDE_WORDS: Readonly<Record<'low' | 'high', string>> = { low: 'below', high: 'above' }

/**
 * ⭐ G4/G5 phase 2, P3 — WHAT AN OPTION'S CHANCE RESTS ON MOST (design-g4g6 Q6 cases A–E; DL rulings 6 Oct). Said after the
 * option's own chance line. Each sentence is SELECTED by what CEE decided (the driver's kind, the side where the chance
 * falls, whose assumption it is) and FILLED with the model's labels, the cut in the user's units and the figure CEE
 * stored. Nothing here compares a number.
 *
 * `null` (nothing is said, the chance line stands) when a label or the cut cannot be said, and for the claims the
 * rulings give no words: an existence driver whose falling side is the runs WITH the link, and an existence claim
 * that is not Olumi's. A link's strength never carries a figure. `ask` is false when an option shown earlier already
 * asked the same question about the same driver (DL ruling 6 Oct): the sentence is then said without its question.
 */
export function goalChanceDriverLine(
  driver: GoalChanceDriver, names: GoalChanceDriverNames, ask = true,
): string | null {
  if (driver.kind === 'factor_value') {
    const label = names.labelOf(driver.factorId)
    if (label === null) return null
    // The unit CEE carried with the cut (PLoT's own) is preferred; the canvas node's is the fallback.
    const cut = formatGoalTarget(driver.cutValue, driver.cutUnit ?? names.unitOf(driver.factorId) ?? '', 'level')
    if (cut === null) return null
    const falls = `if it is ${FALLING_SIDE_WORDS[driver.side]} ${cut}, the chance falls to ${about(driver.pctIfSide)}.`
    // Olumi's own range says so and asks; the user's, or one CEE could not attribute, claims no author.
    return driver.authoredBy === 'olumi'
      ? `It rests most on ‘${label}’, using a range Olumi assumed: ${falls}${ask ? ' Do you know it more precisely?' : ''}`
      : `It rests most on ‘${label}’: ${falls}`
  }
  const from = names.labelOf(driver.from)
  const to = names.labelOf(driver.to)
  if (from === null || to === null) return null
  if (driver.kind === 'link_strength') {
    if (driver.authoredBy === 'olumi') {
      return `It rests most on Olumi’s own estimate of how strongly ‘${from}’ affects ‘${to}’: `
        + `if that effect is ${driver.strength} than Olumi assumed, the chance falls.${ask ? ' Is that estimate right?' : ''}`
    }
    // U / N (DL ruling 6 Oct): the size is the user's, or nobody's CEE could name. Neither says whose spread it is.
    return driver.authoredBy === 'user'
      ? `It rests most on how strongly ‘${from}’ affects ‘${to}’, at the size you set: `
        + `if that effect is ${driver.strength} than that, the chance falls.${ask ? ' How sure are you of that size?' : ''}`
      : `It rests most on how strongly ‘${from}’ affects ‘${to}’: `
        + `if that effect is ${driver.strength} than this model assumes, the chance falls.`
  }
  if (driver.authoredBy !== 'olumi' || driver.side !== 'absent') return null
  return driver.userStatedLink
    ? `It rests most on your link from ‘${from}’ to ‘${to}’: Olumi’s model also allows that it does not hold, `
      + `and in those runs the chance is ${about(driver.pctIfSide)}.`
    : `It rests most on Olumi’s own assumption that ‘${from}’ affects ‘${to}’: `
      + `in the model runs without that link, the chance is ${about(driver.pctIfSide)}.${ask ? ' Is that right?' : ''}`
}

/**
 * The driver a sentence's closing question is about, or `null` for a sentence that asks nothing (A, E and N). Two
 * options resting on the same driver share one question, whichever side each falls on.
 */
function questionDriver(driver: GoalChanceDriver): string | null {
  if (driver.kind === 'factor_value') return driver.authoredBy === 'olumi' ? `factor:${driver.factorId}` : null
  const link = `${driver.from}->${driver.to}`
  if (driver.kind === 'link_strength') return driver.authoredBy === 'unattributed' ? null : `strength:${link}`
  return driver.userStatedLink ? null : `existence:${link}`
}

/**
 * The driver sentence for each option that has one that can be worded, by option id.
 *
 * `except` are the options that get no line of their own (the `similar` form quotes them in the headline). A sentence's
 * closing question is asked ONCE per driver, by the first option SHOWN (the model's order) that rests on it.
 */
export function goalChanceDriverLines(
  licence: GoalChanceLicence | null, names: GoalChanceDriverNames | null | undefined, except: readonly string[] = [],
): Readonly<Record<string, string>> {
  const lines: Record<string, string> = {}
  if (licence === null || names == null) return lines
  const asked = new Set<string>()
  for (const id of licence.optionIds) {
    const driver = licence.driverByOption?.[id]
    if (driver === undefined || except.includes(id)) continue
    const question = questionDriver(driver)
    const line = goalChanceDriverLine(driver, names, question === null || !asked.has(question))
    if (line === null) continue
    lines[id] = line
    if (question !== null) asked.add(question)
  }
  return lines
}


/** The existence line lives with the licence reader (`utils/goalChanceLicence`), so the hero and the WinGauge share it. */
export { goalChanceExistenceLine, goalChanceDisclosureLines, goalChanceSummaryWithheldLine } from '../utils/goalChanceLicence'

/**
 * Compare's section heading for `run_delta.goal_chances` (schemas 0.81.0; DL #87 6035414740). It names the quantity,
 * never a contest: each option's chance, never which option leads.
 */
export const COMPARE_GOAL_CHANCE_HEADING = 'Chance of meeting your goal, in this model'

/**
 * One Run's side of an option's chance, as THAT Run's Analysis showed it: the displayed figure in the hero's own words
 * (`about`, so 0 and 100 never read as certain), a range as the range line says it, and the two sides with no figure in
 * plain words. Figures only (DL ruling 2): nothing here says higher, lower or moved.
 */
export function goalChanceSideWords(side: RunDeltaGoalChanceSide): string {
  switch (side.kind) {
    case 'point': return about(side.pct)
    case 'range': return `between ${about(side.low_pct)} and ${about(side.high_pct).replace(/^about /, '')}`
    case 'withheld': return 'not shown'
    case 'not_recorded': return 'not recorded'
  }
}

/** "Earlier about 47% → Latest about 15%": each side in its own Run's words, earlier first. */
export function goalChanceCompareWords(prior: RunDeltaGoalChanceSide, current: RunDeltaGoalChanceSide): string {
  return `Earlier ${goalChanceSideWords(prior)} → Latest ${goalChanceSideWords(current)}`
}
