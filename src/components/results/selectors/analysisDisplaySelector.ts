/**
 * Shared analysis display selector — Wave F-A (Analysis-tab rebuild).
 *
 * STUB (RED phase): inert until the lane's GREEN commit.
 */
import type { OptionResult } from '../types'

export interface DisplayOptionRow {
  option: OptionResult
  /** Rank in the shared display order (1-based; re-ranks each run). */
  displayIndex: number
  /** Identity-anchored ordinal (assigned once, stable across reruns). */
  stableNumber: number
}

export function assignStableOptionNumbers(
  previous: Readonly<Record<string, number>>,
  _optionIds: readonly string[],
): Record<string, number> {
  return { ...previous }
}

export function selectDisplayOptions(
  _options: readonly OptionResult[],
  _numbering: Readonly<Record<string, number>>,
): DisplayOptionRow[] {
  return []
}

export interface AnalysisDisplaySnapshot {
  numbering: Readonly<Record<string, number>>
  stableNumberFor: (optionId: string) => number | null
}

export function getAnalysisDisplaySnapshot(): AnalysisDisplaySnapshot {
  return { numbering: {}, stableNumberFor: () => null }
}
