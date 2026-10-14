/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE GOAL-CHANCE HEADLINE'S WORDS. Since #2747 re-scope 2 round 2 the headline is CEE's own
 * words for what the chance is OF (`chance_words`), said as each option's chance and model-relative ("In this model, on
 * current information"); the UI composes no chance sentence of its own (DL rules C and D, 12 Oct). The Run's detail lines
 * are CEE's per-target words and served displays, in CEE's order (`goalChanceDetailLines`).
 */
import type { GoalChanceLicence } from '../utils/goalChanceLicence'
import type { GoalChanceRangeEntry } from '../utils/goalChanceRange'
import type { CanonicalGoalChanceDetail } from '../../../canvas/runView/canonicalAnalysisView'

/**
 * The shared renderer reads the Run's RC4 counts, never a count of current canvas links. Recovery Batch C (C CEE
 * amendment 7): Olumi's estimated starting values, and an option's own Olumi settings on that option's line, make the
 * chance provisional too, said in CEE's words (`olumiEstimateWords`): "1 starting value, 2 option settings and 3
 * relationships".
 */
function estimateLinkAttribution(licence: GoalChanceLicence, optionId?: string): string {
  const part = (n: number | undefined, one: string, many: string): string[] => (n !== undefined && n > 0 ? [`${n} ${n === 1 ? one : many}`] : [])
  const parts = [...part(licence.olumiEstimateValueCount, 'starting value', 'starting values'),
    ...part(optionId === undefined ? undefined : licence.olumiEstimateSettingsByOption?.[optionId], 'option setting', 'option settings'),
    ...part(licence.olumiEstimateLinkCount, 'relationship', 'relationships')]
  if (parts.length === 0) return ''
  const words = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `, using Olumi's estimates for ${words} (see Check estimates)`
}

export function goalChanceHeadline(licence: GoalChanceLicence, chanceWords?: string | null): string | null {
  // Recovery Batch C (rulings 18 to 22): the Run's licence carries its own words for what the chance is a chance OF (a level,
  // a change from today, several targets); every form is then said as each option's chance, and no summary is composed here.
  // #2747 re-scope 2 round 2 (DL rules C and D): with no served chance words the hero says no goal-chance headline. The c6
  // sentences it composed instead ("has the highest chance of meeting your goal (target): …") put the UI's own target words
  // (a frame read by the UI) around the cells' figures; each option's cell already says its chance in CEE's words.
  if (!chanceWords) return null
  const text = `In this model, on current information, each option’s ${chanceWords}:`
  const attribution = estimateLinkAttribution(licence)
  return attribution === '' ? text : `${text.slice(0, -1)}${attribution}:`
}

/**
 * Recovery Batch C: the Run's goal-chance detail as the screen says it, in CEE's order and words
 * (`goalChanceNotesForAgent`): with several targets, the joint's withheld line and its bound, then each target on its own;
 * the status quo by assumption; then the licence's disclosures. A licensed joint adds no line here (each option's cell
 * already says it). An option with no sayable label is left out of a target's line, as CEE does.
 */
export type GoalChanceDetailLine = { readonly kind: 'joint_withheld' | 'joint_bound' | 'target' | 'status_quo' | 'note'; readonly text: string }

export function goalChanceDetailLines(
  detail: CanonicalGoalChanceDetail, labelOf: (optionId: string) => string | null,
  /** True when the status-quo option's own cell already says CEE's status-quo line (its "Why?"): it is not said twice. */
  statusQuoSaidByItsCell = false,
): GoalChanceDetailLine[] {
  const lines: GoalChanceDetailLine[] = []
  const targets = detail.targets
  if (targets !== undefined) {
    if (targets.joint.status === 'withheld') {
      lines.push({ kind: 'joint_withheld', text: targets.joint.line })
      if (targets.joint.frechet_line !== undefined) lines.push({ kind: 'joint_bound', text: targets.joint.frechet_line })
    }
    for (const t of targets.per_target) {
      const each = t.options.flatMap((o) => {
        const label = labelOf(o.option_id)
        return label === null || label.trim() === '' ? [] : [`‘${label}’ ${o.display}`]
      })
      if (each.length > 0) lines.push({ kind: 'target', text: `On its own, the chance of ${t.words}, in this model: ${each.join('; ')}.` })
    }
  }
  if (detail.status_quo !== undefined && !statusQuoSaidByItsCell) lines.push({ kind: 'status_quo', text: detail.status_quo.line })
  for (const note of detail.notes ?? []) lines.push({ kind: 'note', text: note })
  return lines
}

/*
 * #2747 re-scope 2 round 2: `goalChanceOptionLines` (c6's per-option lines, its spread note and the share-by-date launch
 * grammar) lost its last production caller when the chat card moved to CEE's served cells (this PR, round 1); it composed
 * "chance of meeting your goal" lines of its own and is deleted with `runView.licensedOptionChanceLines`.
 */
export const GOAL_CHANCE_RANGE_ACTION: Readonly<Record<Exclude<GoalChanceRangeEntry['kind'], 'stated_time'>, string>> = {
  link_strength: 'Size it to see where it lands',
  link_existence: 'Confirm or remove it to see where it lands',
}
