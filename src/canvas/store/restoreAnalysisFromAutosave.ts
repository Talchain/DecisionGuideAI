/**
 * Restore a completed analysis from the autosave record — the canonical half
 * of the fix described in `PersistedAnalysis` (store/scenarios.ts).
 *
 * WHY A MODULE RATHER THAN INLINE IN ReactFlowGraph
 * The boot restore lives inside a `useEffect` in a 4,000-line component, which
 * makes it untestable and made the two PRE-EXISTING restore attempts there
 * (scenario `last_result_hash` lookup, then a graphHash scan over run history)
 * impossible to pin. Both of those are dead on the deployed guest path —
 * live-probed 26 Jul, `olumi-canvas-scenarios` and `olumi-canvas-run-history`
 * are both absent after a real analysis. This one is a pure function of the
 * autosave record, so a spec can drive the exact bytes the live write produced.
 *
 * ⚠ WHAT THIS FILE'S SPECS CAN AND CANNOT PROVE. They prove the record → store
 * transition. They do NOT prove ReactFlowGraph calls this on mount — jsdom
 * cannot prove the deployed path, and a store-level pass while the deployed
 * path stays broken is exactly the trap this defect was already caught by once
 * (see store.conversationRunSurvivesReload.spec.ts's own header). The wiring is
 * evidenced only by the live leave-and-return acceptance recorded in the PR.
 */

/**
 * ⭐⭐ THE PLACEHOLDER THIS MODULE MINTS, AND THE PREDICATE THAT RECOGNISES IT.
 *
 * ⛔ THE DEFECT, MEASURED ON DEPLOYED `ed9635cc` (guest, saved starter, live
 * `localStorage`). `olumi-canvas-autosave` held:
 *
 *     runId:      "restored:v5:1b52318633d62bf4"
 *     hash:       "v5:4d59b14212ca8cdc"
 *     computedAt: "2026-09-18T12:58:15.960Z"
 *
 * The record's TWO identity fields name DIFFERENT RUNS, and the wrong one is
 * this module's own placeholder. `hash` is the identity that exists on the
 * wire (`PersistedAnalysis.hash`: "the run identity that IS on the wire"); the
 * `runId` beside it embeds a hash from an earlier run entirely.
 *
 * ⚠ IT IS A LOOP, NOT A ONE-OFF, and that is why a placeholder had to stop
 * being persisted rather than merely stop being wrong once:
 *
 *   1. `results.runId` is absent — `resultsConnecting` is the only writer that
 *      would stamp a real one and it has ZERO product callers (derived
 *      repo-wide; every reference outside tests is a declaration or a comment).
 *   2. So the autosave persists `runId: undefined`.
 *   3. On reopen this module mints `restored:<hash>` for the STORE, which is
 *      correct — something in-session must identify the restored run.
 *   4. `analysisSnapshotFromStore` then persists `r.runId` straight back, so
 *      the placeholder is written into the record AS IF IT WERE THE RUN'S id,
 *      and every later reopen re-stamps it while `hash` moves on.
 *
 * ⭐ ONE OWNER FOR THE STRING. The predicate lives beside the mint rather than
 * at the projection, so the two cannot drift: a prefix spelled at both sites is
 * the hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12).
 * The projection asks THIS module "did you make this id?" and never matches a
 * literal of its own.
 *
 * ⚠ THE STORE KEEPS THE PLACEHOLDER — only the RECORD stops carrying it. The
 * in-session id is real work: it keys the restored run like any other. What is
 * wrong is persisting it as the run's identity, and the honest persisted state
 * is the one the record was already in before the restore: no `runId` at all.
 */
const RESTORED_ID_PREFIX = 'restored:'

export function syntheticRestoreId(hash: string | undefined): string {
  return `${RESTORED_ID_PREFIX}${hash ?? 'unknown'}`
}

/**
 * Whether an id is one `syntheticRestoreId` minted — i.e. a placeholder that
 * names no run and must never be persisted as an identity.
 */
export function isSyntheticRestoreId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.startsWith(RESTORED_ID_PREFIX)
}

import type { AutosaveData } from './scenarios'
import type { RestorableRun } from './runHistory'

/**
 * Rehydrate `results` from `autosave.analysis`, if there is one.
 *
 * ⭐ IT ALSO STAMPS THE SCENARIO THIS ANSWER BELONGS TO, and this is the single
 * point at which that identity is known. The autosave record already carries
 * `scenarioId` — written together with the graph and the answer, read together
 * here — so no new persisted field is needed. The stamp exists because the
 * SUPABASE leg (`useScenario.loadScenario`) clears `results` unconditionally on
 * every load, which wiped this restore on every reload of `/scenario/:id`; it
 * now clears only when the stamp does not match the scenario being loaded, so a
 * genuine SWITCH still clears and a RELOAD does not. See
 * `ResultsState.restoredForScenarioId`.
 *
 * @param autosave  the record just read by `loadAutosave()`
 * @param restoreFn the store's `resultsLoadHistorical`
 * @returns true when an answer was restored — the caller uses this to skip the
 *          legacy fallbacks, so a canonical hit can never be overwritten by a
 *          graphHash guess.
 */
export function restoreAnalysisFromAutosave(
  autosave: Pick<AutosaveData, 'analysis' | 'scenarioId'> | null | undefined,
  restoreFn: (run: RestorableRun, restoredForScenarioId?: string | null) => void,
): boolean {
  const analysis = autosave?.analysis
  // Persisted JSON is not a type. Guard the one field the results surfaces
  // cannot render without, so a truncated or hand-edited record degrades to
  // "no answer" rather than a store in a state no run produces.
  if (!analysis || typeof analysis !== 'object') return false
  const report = analysis.report
  if (!report || typeof report !== 'object') return false

  const ts = Date.parse(analysis.computedAt ?? '')
  restoreFn(
    {
      id: analysis.runId ?? syntheticRestoreId(analysis.hash),
      ts: Number.isFinite(ts) ? ts : Date.now(),
      // Absent on the V5 path and never invented — see PersistedAnalysis.
      seed: analysis.seed,
      hash: analysis.hash,
      report,
      drivers: analysis.drivers,
      ceeReview: null,
      ceeTrace: null,
      ceeError: null,
    },
    // ⚠ `?? null` and NOT a fabricated id. A pre-`scenarioId` autosave, or a
    // guest record that never had one, restores WITHOUT a stamp — the answer
    // still comes back, and the Supabase leg (which only runs for a signed-in
    // scenario route) keeps its previous clear-on-load behaviour for it.
    autosave?.scenarioId ?? null,
  )
  return true
}
