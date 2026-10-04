/**
 * The goal card's "Today" line (AIQ 5902409861). The number is the user's; on a reading, only taking it as THIS goal's
 * level today is Olumi's, so the user's own words are quoted and never called "your brief".
 */
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import type { GoalTodayLevel } from '../../domain/goalTarget'

export function goalTodayLevelCopy(t: GoalTodayLevel): string {
  const figure = formatGoalTarget(t.level, t.unit) ?? String(t.level)
  if (t.basis === 'olumi_reading' && t.quote !== null) return `Today: ${figure} — Olumi's reading of ‘${t.quote}’`
  if (t.basis === 'from_brief') return `Today: ${figure} — from your brief`
  return t.basis === 'user_confirmed' ? `Today: ${figure} — you confirmed` : `Today: ${figure} — you said`
}
