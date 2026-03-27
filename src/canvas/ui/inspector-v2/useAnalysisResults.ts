/**
 * useAnalysisResults — typed selectors for analysis results in inspector panels.
 *
 * Casts once from the loosely-typed results.report, exposing narrow typed
 * interfaces that inspector panels consume without `as any`.
 */

import { useCanvasStore } from '../../store'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'
import type { ConditionalProbability } from '../../../types/constraints'

// ─── Typed interfaces for inspector-consumed report fields ──────────

export interface InspectorRobustness {
  fragile_edges?: Array<Record<string, unknown>>
  edge_e_values?: Array<{ edge_id: string; e_value: number }>
  flip_thresholds?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface InspectorOptionComparison {
  option_id: string
  option_label?: string
  outcome?: { mean?: number }
  win_probability?: number
  p10?: number
  p90?: number
}

export interface InspectorReport {
  robustness?: InspectorRobustness
  goal_constraints?: Array<CEEGoalConstraint & { probability?: number }>
  conditional_probabilities?: ConditionalProbability[]
  option_comparison?: InspectorOptionComparison[]
  probability_of_goal?: number
  probability_of_joint_goal?: number
  [key: string]: unknown
}

// ─── Selectors (cast once here, type-safe everywhere else) ──────────

/** Extract the full report as InspectorReport. Cast happens here only. */
function selectReport(s: { results?: { report?: unknown } }): InspectorReport | undefined {
  return s.results?.report as InspectorReport | undefined
}

/** Robustness data (ISL enrichment) */
export function useRobustness(): InspectorRobustness | undefined {
  return useCanvasStore(s => selectReport(s)?.robustness)
}

/** Per-edge E-values from ISL */
export function useEdgeEValues(): Array<{ edge_id: string; e_value: number }> | undefined {
  return useCanvasStore(s => selectReport(s)?.robustness?.edge_e_values)
}

/** Post-analysis goal constraints with probability scores */
export function useGoalConstraints(): Array<CEEGoalConstraint & { probability?: number }> | undefined {
  return useCanvasStore(s => selectReport(s)?.goal_constraints ?? undefined)
}

/** Conditional probabilities (P(B|A) differences) */
export function useConditionalProbabilities(): ConditionalProbability[] | undefined {
  return useCanvasStore(s => selectReport(s)?.conditional_probabilities ?? undefined)
}

/** Option comparison data for advanced editors */
export function useOptionComparison(): InspectorOptionComparison[] | undefined {
  return useCanvasStore(s => selectReport(s)?.option_comparison)
}
