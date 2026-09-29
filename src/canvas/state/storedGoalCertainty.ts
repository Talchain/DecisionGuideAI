/**
 * IS EACH 0% / 100% GOAL FIGURE EARNED? — the UI's one reader of CEE's stored fact (schemas 0.63.0
 * `GoalCertaintyDecisionSchema`; producer MG CEE #2270, stored writer + cold read Canonical CEE #2280; DL #72 5887061638:
 * "Canvas's panel consumer follows the stored fact; no UI claim from #2270 alone").
 *
 * An option whose P(goal) is exactly 0 or 1 claims a certainty. It is EARNED only if no link nobody has sized could
 * reverse it. An UNEARNED certainty is never shown as a percentage: the chooser (`selectGoalProbability`) withholds it
 * and the producer's own sentence (`say`, composed from typed members, never free text) is shown instead.
 *
 * Two legs, one reader (the `limit_verdicts` precedent, `storedLimitVerdicts.ts`): the cold read's
 * `analysis_goal_certainty` and a top-level turn key (asked of Canonical, #72 5887080467), read top level first, then the
 * additive sidecar. The UI vendors schemas 0.61.0, so this is a NARROW read of the four fields it uses, never a repair:
 *   - not an array → `null` (not recorded: no claim either way, today's behaviour stands);
 *   - `[]` → recorded, no option at 0 or 1;
 *   - an entry whose `option_id` is readable but whose `earned` is not exactly `true` → UNEARNED with no sentence
 *     (fail-closed).
 * It never reads the entry's `probability_of_goal`: the figure's owner is `selectGoalProbability`
 * (`claim-ownership.drift.spec.ts`), and `earned` is the whole question this reader answers. CEE writes an entry only for
 * an option at exactly 0 or 1.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const GOAL_CERTAINTY_TURN_KEY = 'goal_certainty'
export const GOAL_CERTAINTY_READ_KEY = 'analysis_goal_certainty'

export interface GoalCertaintyEntry {
  readonly optionId: string
  readonly earned: boolean
  /** The producer's sentence for an unearned certainty; null when it sent none we can show. */
  readonly say: string | null
}

/** The array from a parsed turn: top level first, then the additive sidecar. */
export function goalCertaintyFromResponse(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const top = (response as Record<string, unknown>)[GOAL_CERTAINTY_TURN_KEY]
  if (top !== undefined) return top
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return additive?.[GOAL_CERTAINTY_TURN_KEY]
}

/** `null` = not recorded. `[]` = recorded, no option at 0 or 1. */
export function readGoalCertainty(raw: unknown): readonly GoalCertaintyEntry[] | null {
  if (!Array.isArray(raw)) return null
  const out: GoalCertaintyEntry[] = []
  for (const row of raw) {
    if (row === null || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.option_id !== 'string' || r.option_id.length === 0) continue
    const earned = r.earned === true
    const say =
      !earned && typeof r.say === 'string' && r.say.trim().length > 0 && r.say.length <= 400 ? r.say.trim() : null
    out.push({ optionId: r.option_id, earned, say })
  }
  return out
}

/** Option id → the unearned entry, for the mapper's stamp. */
export function unearnedCertaintyById(entries: readonly GoalCertaintyEntry[] | null | undefined): ReadonlyMap<string, GoalCertaintyEntry> {
  const out = new Map<string, GoalCertaintyEntry>()
  for (const e of entries ?? []) if (!e.earned) out.set(e.optionId, e)
  return out
}

/**
 * Shown in place of an unearned figure when the producer's sentence is missing or unsafe. It names NO cause: an unearned
 * certainty has three (`unsized_path`, `identity_mismatch`, `unchecked`), and the producer's `say` carries the real one
 * (AIQ #72 5888121329). Asks nothing of the user.
 */
export const GOAL_CERTAINTY_UNEARNED_FALLBACK = "Not shown as certain: Olumi can't yet confirm this result."
