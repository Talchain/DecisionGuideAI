/**
 * ⭐ P(goal) WITHHELD WHEN A DECLARED IDENTITY ON THE GOAL'S PATH WAS NOT EVALUATED
 * (AIQ #72 5885033487 (2) · DL 5885276225 · producer PLoT #416).
 *
 * The producer withholds `probability_of_goal` on every option and says so with ONE typed inference warning:
 * `{ code: 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED', node_ids, message }`. `message` is AIQ's exact words with the
 * graph's labels ("Not shown. '‹X›' depends on ‹A × B›, but this run couldn't calculate it that way, so the figures
 * for each option would be wrong."). The UI reads the typed code, never the reply text, and never composes the
 * sentence itself.
 *
 * ONE reader for every holder of the enrichment (the V5 mapper, the analysis-snapshot factory, the goal panel and
 * Analysis). The mappers stamp each option so `selectGoalProbability` withholds at EVERY figure site, even if a
 * producer ever sent a figure beside the code (fail-closed).
 */
export const GOAL_IDENTITY_NOT_EVALUATED_CODE = 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED'

/** Only when the producer's words are missing or unsafe to show. Like AIQ's words, it asks the user for nothing. */
export const GOAL_IDENTITY_WITHHELD_FALLBACK =
  "Not shown. This run couldn't calculate one of the formulas your goal depends on, so the figures for each option would be wrong."

export interface GoalIdentityWithheld {
  nodeIds: string[]
  message: string
}

/** snake_case ids or structural characters mean the text is not display-safe. */
const NOT_DISPLAY_SAFE = /\b[a-z0-9]+_[a-z0-9_]+\b|[{}[\]<>]/

export function readGoalIdentityWithheld(holder: unknown): GoalIdentityWithheld | null {
  if (!isPlainObject(holder)) return null
  const warnings = Array.isArray(holder.inference_warnings) ? holder.inference_warnings : []
  const warning = warnings.find(
    (w): w is Record<string, unknown> => isPlainObject(w) && w.code === GOAL_IDENTITY_NOT_EVALUATED_CODE,
  )
  if (warning === undefined) return null
  const nodeIds = Array.isArray(warning.node_ids)
    ? warning.node_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const raw = typeof warning.message === 'string' ? warning.message.trim() : ''
  const safe = raw.startsWith('Not shown.') && raw.length <= 400 && !NOT_DISPLAY_SAFE.test(raw)
  return { nodeIds, message: safe ? raw : GOAL_IDENTITY_WITHHELD_FALLBACK }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
