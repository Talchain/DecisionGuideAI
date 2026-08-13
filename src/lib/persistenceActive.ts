/**
 * Canonical "does this session persist to the server graph?" predicate.
 *
 * SINGLE SOURCE OF TRUTH. This exact boolean was previously hand-copied at
 * `useScenario.ts` (`isPersistenceActive`) and inverted at
 * `loginDraftImport.ts` (`shouldOfferDraftImport`); both now derive from here
 * so the definition cannot drift (CLAUDE.md trap #12 — derive, don't mirror).
 *
 * WHY it matters: guest / unauthenticated sessions do NOT persist. Their
 * canvas graph lives only in the browser (localStorage) — the client-RPC
 * write path is scenario-id / RLS-gated and silently swallows a guest's
 * writes, so a graph edited only in the panel never reaches the server. CEE's
 * `run_analysis` reads goal_constraints off its OWN server-side scenario graph,
 * so a constraint a guest enters in the GoalPanel is never seen by analysis.
 * ⚠ CORRECTED 2026-08-13 (P0). This used to read *"An authenticated user's panel
 * edits DO persist via the gated write-through."* **That is now false, and it is
 * the canonical single-source-of-truth doc for this exact predicate, so leaving
 * it would be a hand-maintained mirror pointed the wrong way (trap 12).** The
 * client-side gated write is SUPPRESSED at its choke point
 * (`lib/clientGraphWritePolicy.ts`): the client holds raw React Flow bytes,
 * `scenarios.graph` is CEE's GraphV3 contract, and writing the former made every
 * analyse turn return HTTP 500 `scenario_read_failed`. So a signed-in user's
 * PANEL edits no longer reach the column either — what persists for them is what
 * CEE writes (drafting, `edit_graph`, and the one `mutating` system event,
 * `factor_value_edit`). A guest's CHAT-entered constraints still reach analysis
 * via CEE's `add_constraint` handler, which persists server-side regardless of
 * auth — that half is unchanged.
 *
 * This predicate itself is UNCHANGED and still correct: it answers "does this
 * session have a server identity?", which is a different question from "does the
 * client write the graph?". Do not merge the two (trap 21).
 */
export function isPersistenceActive(
  authenticated: boolean,
  user: { id?: string | null } | null | undefined,
): boolean {
  return authenticated && !!user && user.id !== 'guest'
}
