// ============================================================================
// OBSERVED STATE HELPERS — Canonical read/write for observed_state
// ============================================================================
//
// DraftChat stores observed_state as camelCase (observedState) in node.data.
// Some consumers read snake_case (observed_state). These helpers bridge the
// naming inconsistency so callers don't need to know which key is present.
//
// TODO: collapse to single canonical key once all consumers migrated
//
// USAGE:
//   import { getObservedState, withObservedStateUpdate } from '@/canvas/utils/observedStateHelpers'
//
//   const os = getObservedState(node.data)           // reads whichever key exists
//   const patch = withObservedStateUpdate(node.data, { source: 'user_confirmed' })
//   updateNode(id, { data: patch })                  // writes to both keys
// ============================================================================

/** Shape of observed_state on factor nodes */
export interface ObservedStateData {
  value?: number
  raw_value?: number
  baseline?: number
  std?: number
  unit?: string
  source?: string
  cap?: number
  factor_type?: string
  uncertainty_drivers?: string[]
  extractionType?: string
  [key: string]: unknown
}

/** Node data shape for observed_state access (supports both naming conventions) */
interface NodeDataWithObservedState {
  observedState?: ObservedStateData
  observed_state?: ObservedStateData
  [key: string]: unknown
}

/**
 * Read observed_state from node data, checking both camelCase and snake_case.
 * Returns the first non-undefined value, or an empty object if neither exists.
 *
 * Priority: camelCase (observedState) first — this is what DraftChat writes.
 */
export function getObservedState(nodeData: unknown): ObservedStateData {
  const data = nodeData as NodeDataWithObservedState | undefined
  return data?.observedState ?? data?.observed_state ?? {}
}

/**
 * Check whether node data has any observed_state (either key).
 */
export function hasObservedState(nodeData: unknown): boolean {
  const data = nodeData as NodeDataWithObservedState | undefined
  return data?.observedState !== undefined || data?.observed_state !== undefined
}

/**
 * Build a node data patch that writes observed_state updates to BOTH keys.
 * Spreads existing state, then overlays the updates.
 *
 * Returns a partial node data object suitable for updateNode:
 *   updateNode(id, { data: withObservedStateUpdate(node.data, { source: 'user_confirmed' }) })
 */
export function withObservedStateUpdate(
  nodeData: unknown,
  updates: Partial<ObservedStateData>,
): Record<string, unknown> {
  const existing = getObservedState(nodeData)
  const merged = { ...existing, ...updates }
  const data = nodeData as Record<string, unknown> | undefined

  return {
    ...(data ?? {}),
    observedState: merged,
    observed_state: merged,
  }
}
