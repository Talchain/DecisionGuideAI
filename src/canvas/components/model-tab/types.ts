/**
 * Shared types for the model-tab component suite.
 *
 * `ModelTabProps` was REMOVED by the 16 Aug 2026 mount train (design §7.5,
 * F15): it had no importer anywhere in `src/` and had drifted from the live
 * inline `ModelTabBodyProps` (it declared a `critique` field the body does not
 * take, and lacked `expertMode` / `onSendMessage`). A stale type nobody uses
 * is the next session's false map. The live props live inline in
 * `ModelTabBody.tsx` — read them there.
 */

/** Factor observed state as the model-tab display readers accept it. */
export interface ObservedState {
  value?: number
  raw_value?: number
  baseline?: number
  unit?: string
  source?: string
  cap?: number
  uncertainty_drivers?: string[]
  range_derivation_source?: string
}

/** Factor influence data keyed by node ID — from PLoT enrichment factor_sensitivity */
export type FactorInfluenceMap = Map<string, number>

/** Context provided by "Show full detail" toggle */
export interface DetailContext {
  showDetail: boolean
}
