/**
 * The ONE store → AutosaveData projection.
 *
 * WHY THIS MODULE EXISTS
 * `saveAutosave` (scenarios.ts) is a whole-object `JSON.stringify` →
 * `localStorage.setItem` REPLACE, not a merge. Seven call sites were each
 * hand-assembling the payload literal independently, and they had already
 * drifted apart:
 *
 *   - useAutosave (the 30s timer) wrote the FULL set, including
 *     `ceeAnalysisReady` and `selectedGoalNode`;
 *   - the crash flush (#399) omitted `selectedGoalNode`;
 *   - the other five omitted BOTH `ceeAnalysisReady` and `selectedGoalNode`.
 *
 * Because the write REPLACES, every one of those partial writes silently
 * DEGRADED the good autosave the timer had just written. The one that BIT in
 * production is `ceeAnalysisReady` (RecoveryBanner.tsx:69 restores it): a draft
 * apply, a patch apply, a merge or a draft-undo each stripped the readiness
 * payload from the last good autosave, so a recovery after any of them came
 * back with no options.
 *
 * `selectedGoalNode` is the weaker half of the original report and is NOT
 * overstated here — see the field note on AutosaveStoreSlice below: it is not
 * declared on CanvasState, so it is usually absent from both payloads. The
 * crash flush still has to stay at parity with the timer regardless.
 *
 * THE INVARIANT
 * `projectAutosaveData` is the only thing permitted to construct an
 * `AutosaveData`. A ci-guard (tests/ci-guards/autosave-projection-single-source
 * .spec.ts) derives the call-site list from the filesystem and fails if any
 * `saveAutosave(...)` is passed anything else.
 *
 * FAIL LOUD ON DRIFT
 * Every field of `AutosaveProjectionSource` is REQUIRED — deliberately, even
 * where the underlying `AutosaveData` field is optional. Adding a field to
 * `AutosaveData` and to this source type therefore produces a COMPILE ERROR at
 * all seven call sites until each one states what it wants to persist. A field
 * can never again be added in one place and silently missed in six.
 *
 * WHY NOT MAKE `saveAutosave` MERGE INSTEAD
 * A merge-onto-the-loaded-slot would stop partial writes dropping siblings,
 * but it would also make CLEARING impossible — and one caller genuinely needs
 * to clear. `undoDraftChatGraph` (store.ts) reverts to the pre-draft graph;
 * with merge semantics the drafted `ceeAnalysisReady` would survive onto a
 * graph whose option nodes no longer exist, i.e. it would resurrect stale
 * analysis rather than drop it. Merge trades a silent-drop bug for a silent-
 * resurrect bug. An explicit projection makes each caller's intent visible in
 * the diff instead.
 */

import type { AutosaveData, PersistedAnalysis } from './scenarios'

/**
 * What a caller must state in order to write an autosave.
 *
 * All fields required — see "FAIL LOUD ON DRIFT" above. Use `null`/`undefined`
 * to mean "persist nothing for this field"; that is then a deliberate,
 * reviewable choice at the call site rather than an omission nobody notices.
 */
export interface AutosaveProjectionSource {
  nodes: AutosaveData['nodes']
  edges: AutosaveData['edges']
  scenarioId: string | null | undefined
  ceeAnalysisReady: AutosaveData['ceeAnalysisReady'] | undefined
  selectedGoalNode: string | null | undefined
  /**
   * The completed analysis for this graph, or null for "persist no answer".
   *
   * Required like every other field here, for the reason in "FAIL LOUD ON
   * DRIFT" above — and this field needs it most. `saveAutosave` REPLACES, so a
   * caller that omitted the analysis would silently strip the user's answer
   * from the last good autosave, which is exactly the bug class that made this
   * module necessary (`ceeAnalysisReady`, #386). One caller genuinely wants to
   * clear it: `undoDraftChatGraph` reverts to the pre-draft graph, and an
   * analysis of a graph whose option nodes no longer exist must not survive.
   */
  analysis: AutosaveData['analysis'] | undefined
  /**
   * The scenario's hard constraints (ROADMAP 2.932). Required like every other
   * field here — `saveAutosave` REPLACES, so a caller that omitted constraints
   * would strip them from the last good autosave, which is the exact silent-loss
   * this field exists to close. `null` means "persist no constraint".
   */
  goalConstraints: AutosaveData['goalConstraints'] | undefined
}

/**
 * The canvas-store fields the projection reads. Structural, so any object with
 * these members satisfies it — the store's own state does, without this module
 * needing to import the store (which would drag the canvas dependency tree into
 * the entry chunk via crashFlush; see crashFlush.ts's dependency-shape note).
 */
export interface AutosaveStoreSlice {
  nodes: AutosaveData['nodes']
  edges: AutosaveData['edges']
  currentScenarioId: string | null
  /**
   * The store's `CEEAnalysisReady` is a WIDER union than AutosaveData's inline
   * shape. Kept opaque here and cast at the boundary: the restore path
   * (RecoveryBanner → validateCeeAnalysisReady) validates before use, so the
   * cast is safe by construction. Same justification as crashFlush's.
   */
  ceeAnalysisReady: unknown
  /**
   * OPTIONAL, deliberately — unlike every other field here.
   *
   * `selectedGoalNode` is NOT declared on `CanvasState`. It is a phantom: the
   * only writer is RecoveryBanner's bare `setState` on restore, and the only
   * reader was useAutosave's `s.selectedGoalNode`, which is a PRE-EXISTING
   * wide-tsc error (`useAutosave.ts(85,50) TS2551 … Did you mean
   * 'reselectGoalNode'?`) that the narrow CI gate never covered. So in a normal
   * session the value is `undefined` and the autosave simply omits the key.
   *
   * Typed optional so the projection tells the truth about the store rather
   * than asserting a field that is not there. The underlying duplication
   * (`selectedGoalNode` vs the store's real `outcomeNodeId`) is a separate call
   * — see the PR body; it is not resolved here.
   */
  selectedGoalNode?: string | null
  /**
   * The store's hard constraints (ROADMAP 2.932). Camel-case here (the store
   * spelling); the projection persists it under the same `goalConstraints`
   * autosave key. Typed off AutosaveData so the two cannot drift.
   */
  goalConstraints?: AutosaveData['goalConstraints']
  /**
   * The results slice. Structural and narrow: only what decides whether there
   * is an answer worth persisting, and what identifies it.
   */
  results: {
    status: string
    report?: unknown
    hash?: string
    runId?: string
    seed?: number
    finishedAt?: number
    drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
    resultsSource?: 'direct' | 'conversation'
  }
}

/**
 * The ONE store → PersistedAnalysis projection.
 *
 * Returns null unless the store actually holds a COMPLETE analysis with a
 * report. Deliberately not "whatever is on `results`": a run that is
 * `analysing`, `error` or `cancelled` has no answer to restore, and persisting
 * a half-state would put the returning user in a state no live run produces.
 *
 * `hash` is `results.hash` (the V5 `response_hash`) — the identity that exists
 * on the wire. `seed` is copied ONLY when the store has one (the direct Run
 * path); it is never defaulted, because a fabricated seed forks the graph hash
 * (CLAUDE.md trap #10).
 */
export function analysisSnapshotFromStore(
  state: Pick<AutosaveStoreSlice, 'results'>,
): PersistedAnalysis | null {
  const r = state.results
  if (!r || r.status !== 'complete' || !r.report) return null
  return {
    hash: r.hash,
    computedAt: new Date(r.finishedAt ?? Date.now()).toISOString(),
    resultsSource: r.resultsSource,
    runId: r.runId,
    seed: r.seed,
    drivers: r.drivers,
    report: r.report as PersistedAnalysis['report'],
  }
}

/**
 * Build a projection source from live canvas-store state.
 *
 * `overrides` exists for the callers that persist a graph OTHER than the one
 * currently in the store — draft-undo saves the pre-draft snapshot, the crash
 * flush saves a plausibility-filtered copy. Typed, so an override cannot
 * introduce a field the projection does not know about.
 */
export function autosaveSourceFromStore(
  state: AutosaveStoreSlice,
  overrides?: Partial<AutosaveProjectionSource>,
): AutosaveProjectionSource {
  return {
    nodes: state.nodes,
    edges: state.edges,
    scenarioId: state.currentScenarioId,
    ceeAnalysisReady: (state.ceeAnalysisReady ?? undefined) as AutosaveData['ceeAnalysisReady'],
    selectedGoalNode: state.selectedGoalNode ?? null,
    analysis: analysisSnapshotFromStore(state),
    goalConstraints: state.goalConstraints ?? null,
    ...overrides,
  }
}

/**
 * Project a source into the exact payload `saveAutosave` persists.
 *
 * `timestamp` is a parameter rather than an internal `Date.now()` so callers
 * that already took a `now` for a staleness comparison persist the SAME
 * instant they compared against (useAutosave's multi-tab guard).
 */
export function projectAutosaveData(
  source: AutosaveProjectionSource,
  timestamp: number = Date.now(),
): AutosaveData {
  return {
    timestamp,
    // `scenarioId` is `string | undefined` on AutosaveData — normalise null.
    scenarioId: source.scenarioId ?? undefined,
    nodes: source.nodes,
    edges: source.edges,
    ceeAnalysisReady: source.ceeAnalysisReady ?? undefined,
    selectedGoalNode: source.selectedGoalNode ?? undefined,
    // `null` is meaningful here (an explicit "no answer"), so it is preserved
    // rather than collapsed to `undefined` — `loadAutosave` treats an absent
    // key and an explicit null the same on read, but the diff at each call site
    // stays readable.
    analysis: source.analysis ?? null,
    // ROADMAP 2.932: emit only when non-empty, so a constraint-free autosave is
    // byte-identical to the historical payload (no new key on every record).
    // Absent/empty ⇒ omit the key ⇒ the restore resolves it to null (clears).
    goalConstraints:
      Array.isArray(source.goalConstraints) && source.goalConstraints.length > 0
        ? source.goalConstraints
        : undefined,
  }
}
