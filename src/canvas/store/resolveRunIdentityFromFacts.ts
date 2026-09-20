/**
 * Resolve a RESTORED run's durable identity from the saved run facts.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The accelerated plan's Panel line says "consume existing saved run facts
 * now". Measured at the bytes, a `v5_handler_facts` `run_analysis` row carries
 * `result.enrichment`, `result.computed_at` and `result.graph_hash_at_run` —
 * and NO renderable report (`persistedRunSnapshotFactory.parseRunFact`). So a
 * saved fact CANNOT restore what the Reasoning panel renders; Compare can use
 * these rows because it renders from an `AnalysisSnapshot` built out of
 * enrichment, and the panel renders from `report`.
 *
 * ⭐ WHAT THE FACT CAN SUPPLY IS EXACTLY WHAT THE REOPEN PATH LACKS. The row's
 * `id` is, in the service's own words, "the durable identity of this run".
 * Measured on deployed `ed9635cc`, the restored result carried
 * `runId: "restored:v5:1b52318633d62bf4"` beside `hash: "v5:4d59b14212ca8cdc"`
 * — a placeholder naming a different run from the hash next to it, because
 * `resultsConnecting` (the only writer of a real id) has zero product callers.
 *
 * ⚠ JOINED ON `computed_at`, AND THAT CHOICE IS DERIVED, NOT CONVENIENT. The
 * autosave record and the fact share exactly one field that identifies the same
 * RUN: the instant the analysis was computed. `hash` is the UI's
 * `response_hash` and is not on the fact; `graph_hash_at_run` is CEE's
 * analysis-affecting hash (`aag_v1`), a different regime from the UI's
 * `generateGraphHash` — `persistedRunSnapshotFactory` says so where it sets
 * `graphHash`, and joining on it would compare two hash families.
 *
 * ⛔ IT RESOLVES AN IDENTITY AND NOTHING ELSE. No report, no enrichment, no
 * freshness. A second path that could write the answer would be the
 * two-restorers defect `applyScenarioAnalysisRead` already names; this returns
 * a string.
 */

/* ⚠⚠ THESE LIVE HERE, NOT BESIDE THE RESTORE THAT MINTS THEM, AND THE REASON IS
   MEASURED. They began in `restoreAnalysisFromAutosave.ts`, which is the module
   that creates the placeholder — the obvious home. But `store.ts` needs the
   predicate, and importing that module into `store.ts` perturbed the type graph
   enough to surface six diagnostics in `src/canvas/nodes/` — files this change
   does not touch — and the typecheck gate's SELF-TEST caught it (`17 passed,
   1 failed`, "no added-diagnostics notice on a clean tree"). A control on
   pristine staging read 18/0, so the alarm was real and the cause was mine.

   This module imports NOTHING, so every consumer can take the predicate without
   dragging the autosave graph behind it. One owner for the string is preserved:
   the restore now imports its own mint from here. */

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

/** The fields this resolver reads. Structural, so the service type is free to grow. */
export interface RunFactIdentityRow {
  readonly id: string
  readonly payload: unknown
}

function computedAtOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const root = payload as Record<string, unknown>
  // Same envelope discipline as `parseRunFact`: a row that is not a
  // `run_analysis` fact is not this run under any join.
  if (root.fact_type !== 'run_analysis') return null
  const result = root.result
  if (typeof result !== 'object' || result === null) return null
  const at = (result as Record<string, unknown>).computed_at
  return typeof at === 'string' && at.length > 0 ? at : null
}

/**
 * The durable id of the fact that recorded THIS restored run, or null.
 *
 * @param rows        saved `run_analysis` facts for the scenario
 * @param computedAt  the restored result's `computedAt` (ISO), from the autosave
 *
 * ⚠ EXACT INSTANT, NOT NEAREST. A tolerance would let a neighbouring run's
 * identity be stamped onto this one, which is a WORSE failure than the
 * placeholder it replaces: a placeholder is visibly not a run id, and a
 * neighbour's id is indistinguishable from the truth. Parsed rather than
 * string-compared so two encodings of one instant still join.
 *
 * ⚠ AMBIGUITY DECLINES. Two facts at the same instant cannot be told apart by
 * this join, and picking either would be a guess wearing a fact's clothes.
 */
export function resolveRunIdentityFromFacts(
  rows: readonly RunFactIdentityRow[],
  computedAt: string | null | undefined,
): string | null {
  if (typeof computedAt !== 'string') return null
  const target = Date.parse(computedAt)
  if (!Number.isFinite(target)) return null

  let found: string | null = null
  for (const row of rows) {
    if (typeof row?.id !== 'string' || row.id.length === 0) continue
    const at = computedAtOf(row.payload)
    if (at === null) continue
    const parsed = Date.parse(at)
    if (!Number.isFinite(parsed) || parsed !== target) continue
    // A second match at the same instant makes the join non-discriminating.
    if (found !== null) return null
    found = row.id
  }
  return found
}

/**
 * What a restored run's `runId` should become once the facts have been read.
 *
 * ⛔ IT CAN ONLY EVER REPLACE A PLACEHOLDER. A real id already on the result is
 * the truth and outranks anything this join produces; a null resolution
 * changes nothing. So the only transition is placeholder → durable id, which
 * is the one direction that cannot lose information.
 *
 * ⚠ PURE, AND SEPARATE FROM THE STORE ACTION THAT APPLIES IT, so the rule is
 * pinned without mounting anything — the lesson `restoreAnalysisFromAutosave`
 * records about its own logic living inside a 4,000-line component.
 */
export function stampedRunIdentity(
  current: string | undefined,
  resolved: string | null,
  isPlaceholder: (id: string | undefined) => boolean,
): string | undefined {
  if (resolved === null) return current
  if (current !== undefined && !isPlaceholder(current)) return current
  return resolved
}
