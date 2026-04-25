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

// ─── Probability-availability guard ──────────────────────────────────

/**
 * True when the report carries at least one finite renderable probability.
 * Used to gate "Analysis complete" surfaces so they do not falsely imply
 * success when the engine returned all-nulls (the recent failing trace:
 * analysis_result block + null probabilities + ceeAnalysisReady still
 * from a prior ready turn).
 *
 * Rule (strict-render):
 *   - If `option_comparison` is a non-empty array, at least one option
 *     MUST have a finite `win_probability`. A non-empty-but-all-null
 *     array is an engine-returned "I tried to compute per-option but
 *     failed" state; downstream success copy ("Option A wins at X%")
 *     has nothing to render. The root `probability_of_goal` does NOT
 *     rescue this case — per-option nulls veto.
 *   - If `option_comparison` is absent or an empty array, fall back to
 *     the root `probability_of_goal` as a goal-level success signal.
 *   - Zero counts as finite (0% is a valid result).
 *   - Null, undefined, NaN, Infinity all count as missing.
 *
 * Pure function (no hook) so it can be called from both React render
 * paths and plain selectors (e.g. renderTimeline).
 */
export function hasAnyRealProbability(report: InspectorReport | undefined | null): boolean {
  if (!report) return false
  const isFiniteNumber = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x)
  const options = report.option_comparison
  if (Array.isArray(options) && options.length > 0) {
    // Present-but-non-empty: option-level nulls veto, root is not consulted.
    return options.some((opt) => isFiniteNumber(opt?.win_probability))
  }
  // Absent or empty array: fall back to root probability_of_goal.
  return isFiniteNumber(report.probability_of_goal)
}

/** Hook wrapper over hasAnyRealProbability for components. */
export function useHasAnyRealProbability(): boolean {
  return useCanvasStore((s) => hasAnyRealProbability(selectReport(s)))
}
