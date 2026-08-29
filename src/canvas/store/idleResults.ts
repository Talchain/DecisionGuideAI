import type { ResultsState } from '../store'

/**
 * The "no analysis on screen" results state.
 *
 * ── WHY ITS OWN LEAF MODULE ─────────────────────────────────────────────────
 * Both scenario-SWITCH boundaries need it — `store.loadScenario` (localStorage)
 * and `useScenario.loadScenario` (Supabase) — and they live in different module
 * graphs. Exporting it from `canvas/store` would force `useScenario` to import
 * the store module for one pure function, and specs that deliberately FAKE the
 * store (`hooks/__tests__/useScenario.spec.ts` replaces it wholesale) would
 * then have to hand-list this export in their `vi.mock` factory — a
 * hand-maintained mirror of the store's export list that drifts silently and
 * fails at runtime inside the code under test (CLAUDE.md trap 12; measured
 * exactly that way while building this fix).
 *
 * The `ResultsState` import is TYPE-ONLY and therefore erased at build time, so
 * this module pulls in nothing at runtime and cannot form an import cycle with
 * `canvas/store`.
 *
 * ── A FACTORY, NOT A CONSTANT ───────────────────────────────────────────────
 * `results` is replaced wholesale by every producer, but a shared object
 * reference would let one accidental in-place write corrupt every later reset.
 *
 * ── ⚠ WHERE THIS MUST *NOT* BE USED ─────────────────────────────────────────
 * A scenario SWITCH must clear the previous scenario's report, or the newly
 * opened decision displays the previous one's numbers under its own name (the
 * defect this was minted for). But the clear belongs at the two genuine switch
 * boundaries and NOWHERE ELSE — in particular it must never join
 * `DECISION_CONTEXT_CLEAR`, which `hydrateGraphSlice` spreads on every
 * hydration carrying nodes or edges, INCLUDING the non-switch boot restores
 * (`ReactFlowGraph`'s autosave recovery and `loadState` fallback). Clearing
 * there would blank a freshly computed analysis on an ordinary page reload —
 * the same silent wrongness in the opposite direction. Both directions are
 * pinned by `store/__tests__/loadScenarioClearsPreviousAnalysis.spec.ts`.
 */
export function createIdleResults(): ResultsState {
  return { status: 'idle', progress: 0 }
}
