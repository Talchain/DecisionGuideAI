/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE GOAL-CHANCE HEADLINE'S WORDS (Wording c6 #87 6005196947, amendment 6005256134, and the
 * 6 Oct rulings for the no-superlative headline; DL 0df0e1 6005048156). Each sentence is SELECTED by the `form` CEE
 * decided (`readGoalChanceLicence`, by identity) and FILLED with the option labels, the percentage CEE stored for each
 * option and the target as the user stated it. Nothing here compares a number.
 *
 * Every line is model-relative ("In this model, on current information") and says "chance of MEETING your goal" —
 * never "reaching" (`goalFigureSaysModelRuns` bans it, DL 6005048156 + c6 6005196947), never a contest word.
 */
import type { GoalChanceComparator, GoalChanceLicence } from '../utils/goalChanceLicence'
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

const about = (pct: number | undefined): string => `about ${pct}%`

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
    case 'each':
      return `${lead} each option’s chance of meeting your goal (${target}):`
  }
}

/**
 * c6's per-option line (or, for an option CEE withheld for its own path, c6's withheld line), in the MODEL'S option order (`licence.optionIds`) — never sorted by chance: below the 10-point
 * licence a sort is a ranking the Run does not grant. `null` when any label cannot be said.
 */
export function goalChanceOptionLines(licence: GoalChanceLicence, labelOf: (optionId: string) => string | null): string[] | null {
  const lines: string[] = []
  for (const id of licence.optionIds) {
    const label = labelOf(id)
    if (label === null) return null
    // c6 (6 Oct): an option withheld for its own path keeps its place, and says so — never "unknown", never "0%".
    lines.push(licence.withheldOptionIds.includes(id)
      ? `‘${label}’: Olumi can’t yet say its chance of meeting your goal, in this model.`
      : `‘${label}’: ${about(licence.pctByOption[id])} chance of meeting your goal, in this model.`)
  }
  return lines
}
