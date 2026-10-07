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
import { GOAL_CHANCE_LABEL } from '../utils/goalAnchorCopy'

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
export const about = (pct: number | undefined): string =>
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
    lines.push(`‘${label}’: ${about(licence.pctByOption[id])} ${GOAL_CHANCE_LABEL}.`
      + (driver === undefined ? '' : ` ${driver}`))
  }
  return lines
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
