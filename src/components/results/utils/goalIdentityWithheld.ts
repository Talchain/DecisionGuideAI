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
 * ⭐ 29 Sep 2026 (W1/W2): PLoT #422 withholds the SAME figures for a second typed reason, a user's link size cut to
 * the model's scale (`GOAL_FIGURES_USER_EFFECT_CLAMPED`). This reader matches the whole code set
 * (`GOAL_FIGURES_WITHHELD_CODES`), says every reason that applies in the producer's words, and falls back to one
 * cause-neutral sentence.
 *
 * ONE reader for every holder of the enrichment (the V5 mapper, the analysis-snapshot factory, the goal panel and
 * Analysis). The mappers stamp each option so `selectGoalProbability` withholds at EVERY figure site, even if a
 * producer ever sent a figure beside the code (fail-closed).
 */
export const GOAL_IDENTITY_NOT_EVALUATED_CODE = 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED'

/**
 * ⭐ PLoT #422 (AIQ #72 5893355501): a USER-STATED link size on the goal's path that was cut to the model's scale.
 * The same carrier withholds the same figures, and the warning says so in its own words ("Not shown. Your size for
 * how ‘A’ moves ‘B’ is bigger than this model's scale can hold, …").
 */
export const GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE = 'GOAL_FIGURES_USER_EFFECT_CLAMPED'

/**
 * EVERY typed reason the producer gives for withholding the goal figures (AIQ #72 5893824972: "Readers should match
 * {GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED, GOAL_FIGURES_USER_EFFECT_CLAMPED} and show the warning's own words").
 * ⚠ `EDGE_STRENGTH_CLAMPED` is NOT in it: that code DISCLOSES a cut the figures do not rest on, and withholds nothing.
 */
export const GOAL_FIGURES_WITHHELD_CODES: readonly string[] = [
  GOAL_IDENTITY_NOT_EVALUATED_CODE,
  GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE,
]

/**
 * Only when the producer's words are missing or unsafe to show. CAUSE-NEUTRAL (AIQ #72 5892977762, 5893824972): the
 * goal figures are withheld for three causes — a formula not evaluated, one not confirmed, a user's size cut — and
 * this sentence fires exactly when none of them has said which, so it names none. AIQ's sentence (5892977762), with
 * "figures" for "chance of reaching": the goal-figure wording guard forbids the latter, and every goal figure is withheld.
 */
export const GOAL_IDENTITY_WITHHELD_FALLBACK =
  "Not shown. Olumi can't give each option's figures for this goal from this run."

export interface GoalIdentityWithheld {
  nodeIds: string[]
  message: string
}

/** snake_case ids or structural characters mean the text is not display-safe. */
const NOT_DISPLAY_SAFE = /\b[a-z0-9]+_[a-z0-9_]+\b|[{}[\]<>]/

export function readGoalIdentityWithheld(holder: unknown): GoalIdentityWithheld | null {
  if (!isPlainObject(holder)) return null
  const warnings = Array.isArray(holder.inference_warnings) ? holder.inference_warnings : []
  const matched = warnings.filter(
    (w): w is Record<string, unknown> =>
      isPlainObject(w) && typeof w.code === 'string' && GOAL_FIGURES_WITHHELD_CODES.includes(w.code),
  )
  if (matched.length === 0) return null
  const nodeIds = [...new Set(matched.flatMap((w) => (Array.isArray(w.node_ids)
    ? w.node_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [])))]
  const words = matched.map((w) => (typeof w.message === 'string' ? w.message.trim() : ''))
  // Every reason that applies is said, in its own words. If ANY of them is missing or unsafe, the cause-neutral
  // fallback stands alone: a partial list would say one cause as if it were the only one.
  const allSafe = words.every((raw) => raw.startsWith('Not shown.') && raw.length <= 400 && !NOT_DISPLAY_SAFE.test(raw))
  return { nodeIds, message: allSafe ? [...new Set(words)].join(' ') : GOAL_IDENTITY_WITHHELD_FALLBACK }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
