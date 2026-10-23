/**
 * The goal card's "Today" line (AIQ 5902409861). The number is the user's; on a reading, only taking it as THIS goal's
 * level today is Olumi's, so the user's own words are quoted and never called "your brief".
 */
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import type { GoalTodayLevel } from '../../domain/goalTarget'

export function goalTodayLevelCopy(t: GoalTodayLevel, labelOf: (id: string) => string | undefined = () => undefined): string {
  // #2747 r2: a level that is not a finite number is never printed (census B R2).
  // target-text: today's LEVEL of the goal's quantity, never its target (a change target is said apart from it)
  const figure = goalTodayLevelFigure(t)
  if (t.basis === 'olumi_reading' && t.quote !== null) return `Today: ${figure} — Olumi's reading of ‘${t.quote}’`
  if (t.basis === 'from_brief') return `Today: ${figure} — from your brief`
  if (t.basis === 'from_parts') {
    // A product names its parts ("Weekly customers × Average spend per customer"); anything else, or a part with no
    // label on the canvas, says "its parts".
    const labels = (t.parts?.factorIds ?? []).map(labelOf)
    const named = t.parts?.operation === 'product' && labels.every(l => typeof l === 'string' && l.trim() !== '')
    return `Today: ${figure} — worked out from ${named ? labels.join(' × ') : 'its parts'}`
  }
  return t.basis === 'user_confirmed' ? `Today: ${figure} — you confirmed` : `Today: ${figure} — you said`
}

/**
 * Vision spec §3 (23 Oct): the card shows "today <figure>"; whose it is moves to the author glyph before the figure,
 * and the sentence above (`goalTodayLevelCopy`) becomes that line's hover and accessible text, never dropped.
 */
export const GOAL_TODAY_WORD = 'today'
export function goalTodayLevelFigure(t: GoalTodayLevel): string {
  return formatGoalTarget(t.level, t.unit) ?? 'not recorded'
}

