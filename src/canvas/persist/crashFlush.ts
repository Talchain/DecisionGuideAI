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
 */

import { saveAutosave, getCurrentScenarioId } from '../store/scenarios'
import type { AutosaveData } from '../store/scenarios'
import { projectAutosaveData } from '../store/autosaveProjection'
import type { AutosaveProjectionSource } from '../store/autosaveProjection'

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
 *   nothing).
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

    // Spread FIRST so any field added to CrashSnapshot flows through without a
    // second edit here; the explicit members below are the ones this path
    // deliberately overrides (filtered graph, scenario-id fallback).
    const source: AutosaveProjectionSource = {
      ...snapshot,
      nodes: nodes as AutosaveData['nodes'],
      edges: edges as AutosaveData['edges'],
      scenarioId: snapshot.scenarioId ?? getCurrentScenarioId(),
      // Boundary cast — see CrashSnapshot doc: restore validates before use.
      ceeAnalysisReady: (snapshot.ceeAnalysisReady ?? undefined) as AutosaveData['ceeAnalysisReady'],
    }
    saveAutosave(projectAutosaveData(source))
    return true
  } catch {
    return false
  }
}
