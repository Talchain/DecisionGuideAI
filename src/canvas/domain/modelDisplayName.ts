/**
 * modelDisplayName — what a model is CALLED when nobody has named it.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * `useScenario`'s auto-title derives a name from the framing goal, and it is
 * gated `if (!isPersistenceActiveRef.current || !sid) return` — persistence is
 * active for real Supabase users only, by design. So a GUEST's model is called
 * "Untitled model" forever, with the goal it is plainly about
 * ("Cut Customer Support Response Times") sitting in the same store, unread.
 * A signed-in user sees the generic name too, for the window before the title
 * write lands.
 *
 * The name is the first thing anyone reads and the thing a shared model is
 * identified by, so "Untitled model" is the worst available answer at exactly
 * the moment someone else is looking.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 * ⛔ It is a DISPLAY derivation and writes nothing. The auto-title's Supabase
 * write remains the only thing that NAMES a model; this only decides what to
 * show while no name exists. Making the guest path write a title would put a
 * second writer on a field with one owner.
 *
 * ⛔ It does NOT touch the empty-rename refusal. `ScenarioSwitcher`'s
 * `commitRename` rules that an empty user-supplied name is refused because
 * *"a model with no name is worse than one called 'Untitled model': the
 * fallback at least tells the truth about being unnamed"*. That answers a
 * DIFFERENT question — whether to accept a blank rename — and is untouched. A
 * stored title always wins here.
 *
 * ── ONE RULE, TWO CALLERS ───────────────────────────────────────────────────
 * The 60/57 truncation is the auto-title's own, lifted here rather than copied,
 * so the name a guest sees and the name that is eventually persisted cannot
 * drift apart. A second copy would be this estate's hand-maintained mirror.
 */

/** Shown when a model has neither a name nor a goal to be named after. */
export const UNNAMED_MODEL_FALLBACK = 'Untitled model'

/** Longest derived name before it is elided. */
export const DERIVED_NAME_MAX = 60

/**
 * Derive a display name from a framing goal.
 *
 * Returns `null` when the goal cannot name anything — absent, not a string, or
 * whitespace. `null` means "no derivation available", never an empty name, so a
 * caller cannot render a blank title by forgetting to check.
 */
export function deriveModelNameFromGoal(goal: unknown): string | null {
  if (typeof goal !== 'string') return null
  const trimmed = goal.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > DERIVED_NAME_MAX
    ? `${trimmed.substring(0, DERIVED_NAME_MAX - 3)}...`
    : trimmed
}

/**
 * The name to display for a model, in precedence order:
 *   1. the stored title — a name someone chose always wins;
 *   2. the goal, derived — truthful about what the model is about;
 *   3. the generic fallback — truthful about being unnamed.
 */
export function resolveModelDisplayName(
  storedTitle: unknown,
  goal: unknown,
): string {
  if (typeof storedTitle === 'string' && storedTitle.trim().length > 0) {
    return storedTitle.trim()
  }
  return deriveModelNameFromGoal(goal) ?? UNNAMED_MODEL_FALLBACK
}
