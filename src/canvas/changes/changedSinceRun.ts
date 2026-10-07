/**
 * P48 (audit #27) — WHAT CHANGED SINCE THE LAST RUN, as CEE says it (`changed_since_run`, CEE
 * `context/changed-since-run.ts`), held so the "Since the last run" cue can light it on the graph until the next Run.
 *
 * ⛔ IT COMPUTES NOTHING. The server owns the answer (durable receipts after the newest Run), so a reload, a second
 * tab and a fresh device all mark the same elements, and a newer Run clears them by construction. This module only
 * parses the wire block strictly and holds it per scenario.
 *
 * The other half of the same question is `graphChanges/` — what differed BETWEEN two Runs, while the Compare tab
 * shows a pair. That is a transient projection (`analysisHighlight`); this is a standing state the analysis-state cue reads,
 * so the two never compete for one slot.
 *
 * ⚠ `unattributedChanges > 0` means some changes name no element (CEE cannot attribute them yet). A surface must
 * not present the marks as the whole set of changes while it is above 0.
 */
import { create } from 'zustand'

export interface ChangedSinceRunLink {
  readonly from: string
  readonly to: string
}

export interface ChangedSinceRun {
  readonly sinceRunId: string | null
  readonly nodeIds: ReadonlySet<string>
  /** Keyed `${from}\u0000${to}`: CEE links carry no id, so a mark binds by its two ends. */
  readonly linkKeys: ReadonlySet<string>
  readonly unattributedChanges: number
  readonly complete: boolean
}

const MAX_IDS = 400
const linkKey = (from: string, to: string): string => `${from}\u0000${to}`
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200

/** Strict parse of the wire block. `null` = CEE did not answer (absent or malformed) — never "nothing changed". */
export function readChangedSinceRun(raw: unknown): ChangedSinceRun | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = raw as Record<string, unknown>
  if (b.version !== 1) return null
  if (b.since_run_id !== null && !isId(b.since_run_id)) return null
  if (!Array.isArray(b.node_ids) || b.node_ids.length > MAX_IDS || !b.node_ids.every(isId)) return null
  if (!Array.isArray(b.links) || b.links.length > MAX_IDS) return null
  const linkKeys = new Set<string>()
  for (const l of b.links) {
    if (l === null || typeof l !== 'object') return null
    const { from, to } = l as Record<string, unknown>
    if (!isId(from) || !isId(to)) return null
    linkKeys.add(linkKey(from, to))
  }
  const unattributed = b.unattributed_changes
  if (typeof unattributed !== 'number' || !Number.isSafeInteger(unattributed) || unattributed < 0) return null
  if (typeof b.complete !== 'boolean') return null
  return {
    sinceRunId: b.since_run_id as string | null,
    nodeIds: new Set(b.node_ids as string[]),
    linkKeys,
    unattributedChanges: unattributed,
    complete: b.complete,
  }
}

interface ChangedSinceRunState {
  /** The scenario the held answer belongs to; marks for any other scenario are never shown. */
  readonly scenarioId: string | null
  readonly value: ChangedSinceRun | null
}

export const useChangedSinceRunStore = create<ChangedSinceRunState>(() => ({ scenarioId: null, value: null }))

/**
 * Hold CEE's answer for `scenarioId`. An absent or malformed block (`raw` → `null`) clears what was held for that
 * scenario rather than keeping marks the server no longer stands behind.
 */
export function adoptChangedSinceRun(scenarioId: string, raw: unknown): void {
  useChangedSinceRunStore.setState({ scenarioId, value: readChangedSinceRun(raw) })
}

/** Selector for a card: is this node marked for the scenario on screen? */
export function isNodeChangedSinceRun(state: ChangedSinceRunState, scenarioId: string | null, nodeId: string): boolean {
  return scenarioId !== null && state.scenarioId === scenarioId && state.value?.nodeIds.has(nodeId) === true
}

/** Selector for a link, by its two ends (React Flow `source`/`target` are CEE's `from`/`to`). */
export function isLinkChangedSinceRun(
  state: ChangedSinceRunState,
  scenarioId: string | null,
  source: string,
  target: string,
): boolean {
  return scenarioId !== null && state.scenarioId === scenarioId && state.value?.linkKeys.has(linkKey(source, target)) === true
}

/**
 * Words. ⛔ No per-card mark (GAP-11, Paul v3.1 pt14: ONE analysis-state cue, never a mark on every touched card):
 * the existing "Since the last run" cue lights this set on demand (Canvas). This line is for changes CEE cannot
 * locate yet, shown only when the count is above 0.
 */
export const CHANGED_SINCE_RUN_WORDS = {
  unattributed: (n: number) => (n === 1 ? '1 other change since the last Run' : `${n} other changes since the last Run`),
} as const
