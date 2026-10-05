import { sanitizeCoachingText } from './cleanFactorLabel'

/**
 * The goal label the Results section speaks of: framing goal > goal node label > "your goal".
 *
 * ⛔ THE GOAL'S OWN LABEL, VERBATIM (DL 0df0e1, ban hit #8, red team #87 6004182580). A one-word label, or one
 * that collides with an option or factor name, used to be wrapped as "the best outcome for {label}" to avoid
 * reading as "To Cat". That served "Olumi doesn't hold today's level of ‘the best outcome for no-shows’":
 * "best" (Paul: never a winner) and nonsense (the level of an outcome). Every sentence that names the goal
 * quotes it, so the label stands on its own.
 */
export function resultsGoalLabel(framingGoal: string | null | undefined, goalNodeLabel: unknown): string {
  let raw = 'your goal'
  if (framingGoal) {
    raw = framingGoal
  } else if (typeof goalNodeLabel === 'string') {
    raw = goalNodeLabel
  }
  if (raw === 'your goal') return raw

  // Sanitize encoding notation and arrows
  const cleaned = sanitizeCoachingText(raw)
  if (!cleaned || cleaned === 'your goal') return 'your goal'
  return cleaned
}
