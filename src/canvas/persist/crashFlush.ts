/**
 * Crash-moment autosave flush.
 *
 * The periodic autosave (useAutosave, 30s interval) leaves a window where the
 * newest work exists only in the in-memory store. The canvas error boundary's
 * "Reload editor" promises "Your work is auto-saved. Reloading will restore
 * the last snapshot" — for that promise to hold AT THE MOMENT IT IS MADE, the
 * boundary must be able to flush the current store state into the SAME
 * mechanism the production boot path actually reads (`olumi-canvas-autosave`
 * via scenarios.loadAutosave → ReactFlowGraph's init effect). The 2026-07-20
 * dress rehearsal showed the old boundary restoring from `canvas-snapshot-*`
 * into `canvas-state-v1` — two keys with no writer and no reader respectively —
 * so the "restore" was theatre and a reload wiped the session.
 *
 * Dependency shape: the error boundary lives in the app entry chunk and must
 * NOT import the canvas store (it would drag the whole canvas dependency tree
 * into the entry bundle). Instead the store registers a snapshot provider at
 * module init (see store.ts, next to the window.useCanvasStore exposure), and
 * the boundary calls flushWorkToAutosave() through this tiny module.
 *
 * ⚠ AND IT DOES NOT PERSIST AN UNSETTLED STREAMED DRAFT. `applyDraftResult`
 * skips its payload-scoped write during a streamed GRAPH_READY preview
 * (`opts.skipAutosave`) and #835 closed the two store-scoped writers in
 * `useAutosave`. This module was the remaining door: a React crash inside the
 * ~25 s settling window wrote the preview to `olumi-canvas-autosave`, and
 * because `draftStreamPhase` is in-memory it came back after the reload
 * UNMARKED, with the run gate OPEN — the exact fabrication the skip exists to
 * prevent, reached through a third path.
 *
 * DECLINING DOES NOT EVEN COST THE WORK — it PROTECTS it. This looks like a
 * fabrication-vs-data-loss trade and is not one, because of what is actually in
 * the store during `settling`: the streamed preview, which has already REPLACED
 * whatever was on the canvas. And `saveAutosave` is a whole-object REPLACE, not
 * a merge. So the unguarded flush was not merely writing something unsettled —
 * it was OVERWRITING the last good pre-draft autosave with it. Declining keeps
 * that last good snapshot intact. Hand-authored work made BEFORE the draft is
 * unaffected either way: `drafting` is classified settled, so edits still flush
 * right up until GRAPH_READY lands.
 *
 * The server copy then covers the draft itself: CEE lets the turn finish when
 * the client hangs up and commits the drafted graph (verified at CEE
 * `4a064e60`, `routes/streamed-turn-sse.ts` — the turn is dispatched via
 * `app.inject`, no socket reference crosses into it, and an integration test
 * destroys a real TCP socket and asserts the commit still lands). The scenario
 * id survives in its own ungated key (`olumi-canvas-current-scenario-id`), and
 * boot hydration is wired unconditionally at `CanvasMVP.tsx:89`, so the reload
 * the boundary offers reads that committed graph back. ⚠ Scope: that holds for
 * the V5 turn routes, not for `POST /assist/v1/draft-graph`, which does abort
 * on socket close; and the fence can still refuse a `superseded` write. So
 * treat server recovery as the common case, not a guarantee — which is why the
 * argument above is built on the local REPLACE, which needs no server at all.
 *
 * And the decline is honest by construction: this
 * function returns false, `ErrorBoundary` stores that as `workFlushed`, and
 * the "your work is auto-saved" promise is gated on it. Writing anyway would
 * be a lie the user cannot detect. Marking the row instead was designed and
 * DECLINED: the autosave payload is unversioned and the tree's only versioning
 * mechanism is dead code that fails open.
 *
 * THE GATE LIVES HERE, NOT AT THE CALL SITES. `shouldPersistGraphForScenario`
 * is the single derived authority, and its own header refuses to become "a
 * list of call sites to keep in step" — guarding each importer would leave the
 * next one to inherit the defect in silence. Inside the primitive it also
 * tests the id the write is genuinely scoped to (see the resolution below),
 * which a caller-side guard cannot do without re-deriving the same fallback.
 * `useAutosave` keeps its own consult: two consults of ONE authority is defence
 * in depth, unlike two spellings of one rule (trap 12).
 *
 * Importing `stores/draftStore` does not violate the dependency shape above:
 * it is a 373-line leaf whose only import is `zustand` — not the canvas store.
 */

import { saveAutosave, getCurrentScenarioId } from '../store/scenarios'
import type { AutosaveData } from '../store/scenarios'
import { projectAutosaveData } from '../store/autosaveProjection'
import type { AutosaveProjectionSource } from '../store/autosaveProjection'
import { shouldPersistGraphForScenario } from '../stores/draftStore'

/**
 * What the store's registered provider must hand back.
 *
 * Every field is REQUIRED (see autosaveProjection's "FAIL LOUD ON DRIFT"). The
 * first version of this interface made them optional and the provider simply
 * did not supply `selectedGoalNode` — which, because `saveAutosave` REPLACES
 * rather than merges, meant the crash flush overwrote a complete autosave with
 * one missing a field RecoveryBanner reads back. Required fields turn that
 * class of omission into a compile error.
 *
 * `nodes`/`edges` stay `unknown[]` because the plausibility gates below run
 * before anything is persisted.
 */
export interface CrashSnapshot {
  nodes: unknown[]
  edges: unknown[]
  scenarioId: string | null | undefined
  /**
   * Passed through opaquely: the store's CEEAnalysisReady is a wider union
   * than AutosaveData's inline shape, and the restore path
   * (restoreCeeAnalysisReady → validateCeeAnalysisReady) validates before use
   * — a boundary cast at the write is safe by construction.
   */
  ceeAnalysisReady: unknown
  selectedGoalNode: string | null | undefined
  /**
   * The completed analysis, or null. Required for the same reason as the rest:
   * `saveAutosave` REPLACES, so a crash flush that omitted it would strip the
   * user's answer out of the last good autosave — losing the very thing the
   * boundary's "your work is auto-saved" promise now covers.
   */
  analysis: AutosaveData['analysis'] | undefined
  /**
   * The scenario's hard constraints (ROADMAP 2.932). Required for the same
   * REPLACE reason: a crash flush that omitted it would strip the user's
   * constraints out of the last good autosave. Flows straight through the
   * `...snapshot` spread in flushWorkToAutosave.
   */
  goalConstraints: AutosaveData['goalConstraints'] | undefined
}

export type CrashSnapshotProvider = () => CrashSnapshot | null

// Module singleton. Deliberately NOT cleared on canvas unmount: the error
// boundary replaces the canvas subtree BEFORE it runs its own recovery UI, and
// the store singleton keeps the graph after unmount — a provider that reads
// getState() stays correct for the whole page lifetime. Re-registration
// overwrites (idempotent).
let provider: CrashSnapshotProvider | null = null

export function registerCrashSnapshotProvider(p: CrashSnapshotProvider): void {
  provider = p
}

/** Test hook only — restores the unregistered state between specs. */
export function __resetCrashSnapshotProviderForTests(): void {
  provider = null
}

/**
 * Structural plausibility gates. The flush runs DURING a crash — if the crash
 * was caused by a malformed node/edge in the store, persisting it verbatim
 * would rehydrate the poison on reload and crash-loop deterministically.
 * Dropping only the structurally broken entries keeps the user's valid work
 * (the rehearsal-shaped outcome) without preserving the crash trigger.
 * Deliberately minimal — shape checks only, no semantic validation.
 */
function isPlausibleNode(n: unknown): boolean {
  if (!n || typeof n !== 'object') return false
  const node = n as Record<string, unknown>
  if (typeof node.id !== 'string' || node.id.length === 0) return false
  const pos = node.position as Record<string, unknown> | undefined
  if (!pos || typeof pos !== 'object') return false
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false
  if (node.data != null && typeof node.data !== 'object') return false
  return true
}

function isPlausibleEdge(e: unknown, keptNodeIds: Set<string>): boolean {
  if (!e || typeof e !== 'object') return false
  const edge = e as Record<string, unknown>
  if (typeof edge.id !== 'string' || edge.id.length === 0) return false
  if (typeof edge.source !== 'string' || typeof edge.target !== 'string') return false
  // An edge whose endpoint was dropped as implausible would dangle on reload.
  return keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)
}

/**
 * Flush the current in-memory graph into the autosave slot the boot path
 * reads. Returns true when a flush was written.
 *
 * Fail-soft by design (this runs while the app is already crashing):
 * - no provider registered (crash before the canvas store ever loaded) → false;
 * - provider throws or returns malformed data → false;
 * - structurally broken nodes/edges are DROPPED, not persisted (see gates);
 * - EMPTY graph (after filtering) → false WITHOUT writing: an empty store must
 *   never clobber the last good autosave (the crash may have emptied the
 *   store — the stale autosave is then strictly better than the "fresh"
 *   nothing);
 * - UNSETTLED streamed draft on this scenario → false WITHOUT writing, for the
 *   same "a stale truth beats a fresh fabrication" reason (see the header).
 *
 * The returned boolean is load-bearing, not diagnostic: `ErrorBoundary` gates
 * its "your work is auto-saved" promise on it, so every `false` above is a
 * promise correctly NOT made.
 */
export function flushWorkToAutosave(): boolean {
  try {
    if (!provider) return false
    const snapshot = provider()
    if (!snapshot) return false
    if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return false

    const nodes = snapshot.nodes.filter(isPlausibleNode)
    const keptNodeIds = new Set(nodes.map((n) => (n as { id: string }).id))
    const edges = snapshot.edges.filter((e) => isPlausibleEdge(e, keptNodeIds))
    if (nodes.length === 0 && edges.length === 0) return false

    // THE SCENARIO THIS WRITE LANDS ON. Resolved ONCE, and BEFORE the gate, so
    // the phase is tested against exactly the row `saveAutosave` is about to
    // occupy — including the case where the store has no id and the
    // localStorage fallback supplies it.
    const scenarioId = snapshot.scenarioId ?? getCurrentScenarioId()

    // ⚠ NEVER PERSIST AN UNSETTLED STREAMED DRAFT — see the header for why a
    // decline beats both writing and marking. Read at FLUSH time, never at
    // registration: the phase that matters is the one at the instant of the
    // crash.
    if (!shouldPersistGraphForScenario(scenarioId)) return false

    // Spread FIRST so any field added to CrashSnapshot flows through without a
    // second edit here; the explicit members below are the ones this path
    // deliberately overrides (filtered graph, scenario-id fallback).
    const source: AutosaveProjectionSource = {
      ...snapshot,
      nodes: nodes as AutosaveData['nodes'],
      edges: edges as AutosaveData['edges'],
      scenarioId,
      // Boundary cast — see CrashSnapshot doc: restore validates before use.
      ceeAnalysisReady: (snapshot.ceeAnalysisReady ?? undefined) as AutosaveData['ceeAnalysisReady'],
    }
    saveAutosave(projectAutosaveData(source))
    return true
  } catch {
    return false
  }
}
