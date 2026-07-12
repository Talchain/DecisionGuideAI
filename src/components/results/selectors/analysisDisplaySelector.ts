/**
 * Shared analysis display selector — Wave F-A (Analysis-tab rebuild,
 * DEV-PLAN-2026-07-12 §3; brief §6.4 stable numbering + §12.4 one selector).
 *
 * STRICTLY ADDITIVE: emits display-ordered rows with two DISTINCT numbers —
 * `displayIndex` (rank in the shared sortOptionsForDisplay order; re-ranks
 * every run, exactly what the hero/OptionCards render today) and
 * `stableNumber` (identity-anchored ordinal: assigned once per option id in
 * first-appearance order, stable across rerun rank flips, never reused).
 * Nothing consumes stableNumber yet — Wave 2 switches panel surfaces and
 * Wave 4 renders it on canvas OptionNodes from the published snapshot.
 *
 * Selection/ordering of existing values only — no new semantics (the
 * ordering rule lives in utils/optionDisplayOrder, unchanged).
 */
import { useCanvasStore } from '../../../canvas/store'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
import type { OptionResult } from '../types'

export { assignStableOptionNumbers } from './stableOptionNumbers'

export interface DisplayOptionRow {
  option: OptionResult
  /** Rank in the shared display order (1-based; re-ranks each run). */
  displayIndex: number
  /** Identity-anchored ordinal (assigned once, stable across reruns). */
  stableNumber: number
}

/**
 * Rows in the ONE approved display order, numbered. When an id is missing
 * from the numbering map the row falls open to its displayIndex — display
 * never blocks on registration timing.
 */
export function selectDisplayOptions(
  options: readonly OptionResult[],
  numbering: Readonly<Record<string, number>>,
): DisplayOptionRow[] {
  return sortOptionsForDisplay(options).map((option, i) => ({
    option,
    displayIndex: i + 1,
    stableNumber: numbering[option.id] ?? i + 1,
  }))
}

export interface AnalysisDisplaySnapshot {
  numbering: Readonly<Record<string, number>>
  stableNumberFor: (optionId: string) => number | null
}

/**
 * Outside-React read of the numbering (canvas nodes, AI-context builders):
 * the same map every panel surface uses, via the store.
 */
export function getAnalysisDisplaySnapshot(): AnalysisDisplaySnapshot {
  const numbering = useCanvasStore.getState().optionNumbering
  return {
    numbering,
    stableNumberFor: (optionId: string) => numbering[optionId] ?? null,
  }
}
