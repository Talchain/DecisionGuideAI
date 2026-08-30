/**
 * The ids of models this browser has worked on — kept so that losing the live
 * pointer is not the same as losing the model.
 *
 * ── THE MECHANISM, AND WHY IT IS ONE MECHANISM AND NOT TWO ─────────────────
 * `olumi-canvas-current-scenario-id` is a single slot holding the UUID of the
 * model on screen. It is the ONLY route back to that model, and it is
 * overwritten or cleared by ordinary use:
 *
 *   · "Start new model" clears it            (`canvas/store.ts:3571`)
 *   · opening another model overwrites it    (`canvas/store.ts:4654`)
 *   · signing in and then doing either       (the same two, moments later)
 *
 * Those look like two problems — one on the guest path, one on the sign-in
 * path — but they are one: a single-slot pointer with no history. Recording the
 * OUTGOING id at the two functions that own the slot serves both, which is why
 * this is not solved twice in two places.
 *
 * ── WHY RECORDING IS WORTH ANYTHING ────────────────────────────────────────
 * The row is never destroyed. A guest model is stored server-side with
 * `user_id = NULL`, and RLS gives a NULL-owner row no user-reachable delete
 * path (`Users can delete own scenarios` requires `auth.uid() = user_id`), so
 * it stays retrievable — and claimable — indefinitely. Measured from both
 * sides: a pointer-only transplant restored a whole model 5/5 while the same
 * profile without it got 0 nodes 4/4, and after a client reset the graph came
 * back by UUID at 85,883 bytes with 13/13 node ids matching, against a
 * fabricated UUID returning 404.
 *
 * So the data is fine and only the key is thrown away. This module keeps the
 * key.
 *
 * ── WHAT THIS DELIBERATELY IS NOT ──────────────────────────────────────────
 * It is a RECORD, not a recovery feature. Nothing here renders, prompts,
 * navigates or gates; how a user gets back to an earlier model is a separate
 * product decision. A guest who never signs in is unaffected in every
 * observable way — the only change on their path is a bounded localStorage
 * write they never see.
 *
 * It also does not make the "cannot be undone" dialog copy false on its own.
 * That copy is true of what the product OFFERS today, and it is for the surface
 * that owns it to change when something offers otherwise.
 */

/** Bounded so a long session cannot grow localStorage without limit. */
export const SCENARIO_TRAIL_KEY = 'olumi.scenarioTrail.v1'

/** Generous: a browser that worked on more than this has much older entries. */
export const SCENARIO_TRAIL_LIMIT = 20

/**
 * Server rows are UUIDs. Legacy `scenario-{ts}-{rand}` ids were never migrated
 * and have no server row, so recording one would promise a recovery that cannot
 * happen. Shape-check only: this module cannot reach the server.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function read(): string[] {
  try {
    const raw = localStorage.getItem(SCENARIO_TRAIL_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
  } catch {
    // Unavailable or corrupt. An unreadable trail is an empty trail — never an
    // exception on a path the user did not ask for.
    return []
  }
}

/**
 * The ids this browser has worked on, MOST RECENT FIRST.
 */
export function readScenarioTrail(): string[] {
  return read()
}

/**
 * Record an id that is about to stop being the current one.
 *
 * Most-recent-first with de-duplication, so revisiting a model promotes it
 * rather than filling the trail with copies. Silently ignores anything that is
 * not a server-row-shaped id.
 */
export function recordScenarioTrail(id: string | null | undefined): void {
  if (typeof id !== 'string' || !UUID_RE.test(id)) return
  try {
    const next = [id, ...read().filter(v => v !== id)].slice(0, SCENARIO_TRAIL_LIMIT)
    localStorage.setItem(SCENARIO_TRAIL_KEY, JSON.stringify(next))
  } catch {
    // Storage full or unavailable: the trail is a safety net, never a
    // precondition. Losing it must never break the action the user asked for.
  }
}

/** The most recently recorded id, or `null`. */
export function latestScenarioTrail(): string | null {
  return read()[0] ?? null
}
