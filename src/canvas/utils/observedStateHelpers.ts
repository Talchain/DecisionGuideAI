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
  raw_value?: number | string | null
  baseline?: number
  std?: number
  unit?: string
  source?: string
  cap?: number
  factor_type?: string
  uncertainty_drivers?: string[]
  extractionType?: string
  /** CEE-provided display text. When present the UI renders verbatim. */
  display_value?: string | null
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
 * Check whether a factor node has actual observed data — i.e., the observed_state
 * object is present AND its `value` field is a number (not null or undefined).
 *
 * Evidence gap badge semantics:
 * - `observedState === null`      → no data (badge shows)
 * - `observedState === undefined` → no data (badge shows)
 * - `observedState.value === 0`   → valid data (badge hidden — 0 is "None" for binary factors)
 * - `observedState.value === 1`   → valid data (badge hidden)
 * - `observedState.value === 0.5` → valid data (badge hidden)
 * - `observedState.value == null` → no value yet (badge shows)
 *
 * Note: the pipeline does not produce `observedState.value === ''` (string). The
 * `value` field is always typed as `number | undefined`. Treating empty-string as
 * "no data" is therefore moot; `typeof '' !== 'number'` would catch it anyway.
 */
export function hasObservedData(nodeData: unknown): boolean {
  const obs = getObservedState(nodeData)
  // Empty object returned when key is absent — no keys means no data
  if (Object.keys(obs).length === 0) return false
  return typeof obs.value === 'number'
}

/**
 * Single source of truth for the "factor needs input" predicate used by the
 * amber StatusPill (BaseNode) AND the in-body coaching chip (FactorNode).
 *
 * Wireframe v4 trigger (FactorNeedsPre): factor needs input when ALL of
 * `value`, `raw_value` and `display_value` are nullish AND the factor is not
 * external AND it has no prior range. External / prior-range factors are
 * exempt — dashed border = "outside your control" must not be confused with
 * amber = "needs your judgement".
 *
 * Both call sites must agree on this predicate, otherwise a node can show the
 * "Help me estimate this" chip without the amber border (or vice-versa).
 */
export function isFactorNeedsInput(nodeData: unknown): boolean {
  const data = nodeData as {
    category?: string
    prior?: { range_min?: number; range_max?: number }
  } | undefined
  if (data?.category === 'external') return false
  // A prior range counts as user-supplied evidence — same exemption the legacy
  // BaseNode incomplete check applied.
  if (data?.prior?.range_min != null && data?.prior?.range_max != null) return false
  const obs = getObservedState(nodeData)
  const valueMissing = obs.value == null
  const rawMissing = obs.raw_value == null
  const displayMissing = obs.display_value == null
  return valueMissing && rawMissing && displayMissing
}

/**
 * Convert a raw, real-world factor figure into the normalised model-space
 * `value` the engine consumes.
 *
 * This is the rule every value-edit path in the UI already applies —
 * PreAnalysisPanel.handleInlineEditValue and CalibrateDrillIn.commitValue both
 * inline `cap != null && cap > 0 ? rawValue / cap : rawValue`. It is factored
 * out here (the canonical home for observed-state logic) so new callers derive
 * the rule instead of re-typing it. The two existing inline copies are
 * unchanged by this commit and are tracked for convergence.
 *
 * A missing, non-finite or non-positive cap means "no honest scale exists", in
 * which case the typed number IS the model-space value — the same fallback the
 * existing call sites take. Never throws; a non-finite raw value is returned
 * unchanged so the caller's own finite-number guard is the single rejection
 * point rather than a silent coercion here.
 */
export function normaliseRawFactorValue(rawValue: number, cap: number | undefined | null): number {
  if (!Number.isFinite(rawValue)) return rawValue
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) return rawValue
  return rawValue / cap
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
