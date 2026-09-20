/**
 * After a reopen restores a result, replace its PLACEHOLDER id with the
 * durable identity recorded in the saved run fact.
 *
 * ⛔ WHY IT IS A MODULE AND NOT SIX LINES IN `ReactFlowGraph`. The restore it
 * follows lives in a `useEffect` inside a 4,000-line component, and
 * `restoreAnalysisFromAutosave`'s own header records what that cost: the two
 * pre-existing restore attempts there were "impossible to pin", and both were
 * dead on the deployed path for months with nothing able to see it. Every
 * dependency here is injected, so the whole decision is drivable in a spec.
 *
 * ⚠ GUESTS SKIP THE READ ENTIRELY, and that is a correctness rule rather than
 * an optimisation. `v5_handler_facts.user_id` is NULL for guest rows and
 * `auth.uid() = NULL` is NULL, so RLS returns a guest nothing —
 * `useCompareHistoryHydration` states the same and checks the session first for
 * the same reason. Firing a request guaranteed to come back empty would add a
 * boot-path round trip to the one journey we most need to stay fast.
 *
 * ⚠ IT IS AN UPGRADE, NEVER A REQUIREMENT. Every exit below leaves the restored
 * result exactly as it was: the report is already on screen by the time this
 * runs, and nothing here can remove it. A failed read, an empty set, an
 * ambiguous join and a guest all resolve to "keep the placeholder".
 */
import { resolveRunIdentityFromFacts, type RunFactIdentityRow } from './resolveRunIdentityFromFacts'

export interface UpgradeRestoredRunIdentityDeps {
  /** The scenario whose facts to read. */
  readonly scenarioId: string | null | undefined
  /** The restored result's computed instant, from the autosave record. */
  readonly computedAt: string | null | undefined
  /** Resolves to false for a guest, so the read is skipped rather than wasted. */
  readonly hasSession: () => Promise<boolean>
  readonly readFacts: (scenarioId: string) => Promise<readonly RunFactIdentityRow[]>
  readonly stamp: (runId: string) => void
}

export type UpgradeOutcome =
  | 'stamped'
  | 'no_scenario'
  | 'no_computed_at'
  | 'guest'
  | 'unresolved'
  | 'read_failed'

/**
 * Returns what happened, so a caller — and a spec — can tell a guest apart from
 * a failed read apart from a genuine non-match. Collapsing those into a boolean
 * is the two-questions-one-name defect this estate keeps paying for.
 */
export async function upgradeRestoredRunIdentity(
  deps: UpgradeRestoredRunIdentityDeps,
): Promise<UpgradeOutcome> {
  const { scenarioId, computedAt } = deps
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) return 'no_scenario'
  // Nothing to join on. Checked BEFORE the session so a record with no instant
  // never costs a round trip either.
  if (typeof computedAt !== 'string' || computedAt.length === 0) return 'no_computed_at'

  let rows: readonly RunFactIdentityRow[]
  try {
    if (!(await deps.hasSession())) return 'guest'
    rows = await deps.readFacts(scenarioId)
  } catch {
    // The restored result stands. There is no honest error to show for a
    // provenance upgrade the reader never asked for.
    return 'read_failed'
  }

  const resolved = resolveRunIdentityFromFacts(rows, computedAt)
  if (resolved === null) return 'unresolved'
  deps.stamp(resolved)
  return 'stamped'
}
