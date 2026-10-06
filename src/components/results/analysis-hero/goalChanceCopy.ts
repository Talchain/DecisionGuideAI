/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE GOAL-CHANCE HEADLINE'S WORDS (Wording c6 #87 6005196947, amendment 6005256134, and the
 * 6 Oct rulings for the no-superlative headline; DL 0df0e1 6005048156). Each sentence is SELECTED by the `form` CEE
 * decided (`readGoalChanceLicence`, by identity) and FILLED with the option labels, the percentage CEE stored for each
 * option and the target as the user stated it. Nothing here compares a number.
 *
 * Every line is model-relative ("In this model, on current information") and says "chance of MEETING your goal" —
 * never "reaching" (`goalFigureSaysModelRuns` bans it, DL 6005048156 + c6 6005196947), never a contest word.
 */
import type { GoalChanceComparator, GoalChanceDriver, GoalChanceLicence } from '../utils/goalChanceLicence'
import { formatGoalTarget } from '../utils/formatGoalTarget'

const COMPARATOR_WORDS: Readonly<Record<GoalChanceComparator, string>> = {
  at_least: 'at least',
  above: 'above',
  at_most: 'at most',
  below: 'below',
}

/** The target as the user stated it, in their unit: "at most 400 cancellations/month". */
export function goalChanceTargetWords(licence: GoalChanceLicence): string | null {
  const figure = formatGoalTarget(licence.target.value, licence.target.unit, 'level')
  return figure === null ? null : `${COMPARATOR_WORDS[licence.target.comparator]} ${figure}`
}

/**
 * The displayed figure in words (c6 6 Oct): a chance that DISPLAYS as 0 (under 0.5%) is "less than 1%" and one that
 * displays as 100 (99.5% or more) is "more than 99%" — never "about 0%" (it reads as impossible) or "about 100%".
 */
const about = (pct: number | undefined): string =>
  pct === 0 ? 'less than 1%' : pct === 100 ? 'more than 99%' : `about ${pct}%`
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
 */
export function goalChanceOptionLines(
  licence: GoalChanceLicence, labelOf: (optionId: string) => string | null, except: readonly string[] = [],
  driverLines: Readonly<Record<string, string>> = {},
): string[] | null {
  const lines: string[] = []
  for (const id of licence.optionIds) {
    if (except.includes(id)) continue
    const label = labelOf(id)
    if (label === null) return null
    // c6 (6 Oct): an option withheld for its own path keeps its place, and says so — never "unknown", never "0%".
    if (licence.withheldOptionIds.includes(id)) {
      lines.push(`‘${label}’: Olumi can’t yet say its chance of meeting your goal, in this model.`)
      continue
    }
    // P3: what this option's chance rests on most follows its own line, when CEE named one that can be worded.
    const driver = driverLines[id]
    lines.push(`‘${label}’: ${about(licence.pctByOption[id])} chance of meeting your goal, in this model.`
      + (driver === undefined ? '' : ` ${driver}`))
  }
  return lines
}

/** How the driver sentence names things: a model node's label, and a factor's unit as the user stated it. */
export interface GoalChanceDriverNames {
  readonly labelOf: (nodeId: string) => string | null
  readonly unitOf: (nodeId: string) => string | null
}

const FALLING_SIDE_WORDS: Readonly<Record<'low' | 'high', string>> = { low: 'below', high: 'above' }

/**
 * ⭐ G4/G5 phase 2, P3 — WHAT AN OPTION'S CHANCE RESTS ON MOST (design-g4g6 Q6 cases A–E; DL rulings 6 Oct). Said after the
 * option's own chance line. Each sentence is SELECTED by what CEE decided (the driver's kind, the side where the chance
 * falls, whose assumption it is) and FILLED with the model's labels, the cut in the user's units and the figure CEE
 * stored. Nothing here compares a number.
 *
 * `null` (nothing is said, the chance line stands) when a label or the cut cannot be said, and for the claims the
 * rulings give no words: a strength driver on a link the user sized, an existence driver whose falling side is the
 * runs WITH the link, and a link claim with no author. A link's strength never carries a figure.
 */
export function goalChanceDriverLine(driver: GoalChanceDriver, names: GoalChanceDriverNames): string | null {
  if (driver.kind === 'factor_value') {
    const label = names.labelOf(driver.factorId)
    if (label === null) return null
    const cut = formatGoalTarget(driver.cutValue, names.unitOf(driver.factorId) ?? '', 'level')
    if (cut === null) return null
    const falls = `if it is ${FALLING_SIDE_WORDS[driver.side]} ${cut}, the chance falls to ${about(driver.pctIfSide)}.`
    // Olumi's own range says so and asks; the user's, or one CEE could not attribute, claims no author.
    return driver.authoredBy === 'olumi'
      ? `It rests most on ‘${label}’, using a range Olumi assumed: ${falls} Do you know it more precisely?`
      : `It rests most on ‘${label}’: ${falls}`
  }
  if (driver.authoredBy !== 'olumi') return null
  const from = names.labelOf(driver.from)
  const to = names.labelOf(driver.to)
  if (from === null || to === null) return null
  if (driver.kind === 'link_strength') {
    return `It rests most on Olumi’s own estimate of how strongly ‘${from}’ affects ‘${to}’: `
      + `if that effect is ${driver.strength} than Olumi assumed, the chance falls. Is that estimate right?`
  }
  if (driver.side !== 'absent') return null
  return driver.userStatedLink
    ? `It rests most on your link from ‘${from}’ to ‘${to}’: Olumi’s model also allows that it does not hold, `
      + `and in those runs the chance is ${about(driver.pctIfSide)}.`
    : `It rests most on Olumi’s own assumption that ‘${from}’ affects ‘${to}’: `
      + `in the model runs without that link, the chance is ${about(driver.pctIfSide)}. Is that right?`
}

/** The driver sentence for each option that has one that can be worded, by option id. */
export function goalChanceDriverLines(licence: GoalChanceLicence | null, names: GoalChanceDriverNames): Readonly<Record<string, string>> {
  const lines: Record<string, string> = {}
  for (const [id, driver] of Object.entries(licence?.driverByOption ?? {})) {
    const line = goalChanceDriverLine(driver, names)
    if (line !== null) lines[id] = line
  }
  return lines
}


/** The existence line lives with the licence reader (`utils/goalChanceLicence`), so the hero and the WinGauge share it. */
export { goalChanceExistenceLine, goalChanceDisclosureLines, goalChanceSummaryWithheldLine } from '../utils/goalChanceLicence'
