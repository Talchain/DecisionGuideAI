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
 * (An authenticated user's panel edits DO persist via the gated write-through,
 * and a guest's CHAT-entered constraints DO reach analysis via CEE's
 * `add_constraint` handler, which persists server-side regardless of auth.)
 */
export function isPersistenceActive(
  authenticated: boolean,
  user: { id?: string | null } | null | undefined,
): boolean {
  return authenticated && !!user && user.id !== 'guest'
}
