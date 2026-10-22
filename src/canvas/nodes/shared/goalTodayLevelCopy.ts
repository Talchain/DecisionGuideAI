/**
 * The goal card's "Today" line (AIQ 5902409861). The number is the user's; on a reading, only taking it as THIS goal's
 * level today is Olumi's, so the user's own words are quoted and never called "your brief".
 */
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import type { GoalTodayLevel } from '../../domain/goalTarget'

export function goalTodayLevelCopy(t: GoalTodayLevel, labelOf: (id: string) => string): string {
  // #2747 r2: a level that is not a finite number is never printed (census B R2).
  // target-text: today's LEVEL of the goal's quantity, never its target (a change target is said apart from it)
  const figure = formatGoalTarget(t.level, t.unit) ?? 'not recorded'
  if (t.basis === 'olumi_reading' && t.quote !== null) return `Today: ${figure} — Olumi's reading of ‘${t.quote}’`
  if (t.basis === 'from_brief') return `Today: ${figure} — from your brief`
  if (t.basis === 'from_parts') {
    // Named by its parts ("Weekly customers × Average spend per customer"); an operation the UI cannot spell, or a part
    // with no label on the canvas, says "its parts".
    const labels = (t.parts?.factorIds ?? []).map(labelOf)
    const operator = t.parts?.operator
    return `Today: ${figure} — worked out from ${operator && labels.every(l => l.trim() !== '') ? labels.join(` ${operator} `) : 'its parts'}`
  }
  return t.basis === 'user_confirmed' ? `Today: ${figure} — you confirmed` : `Today: ${figure} — you said`
}
