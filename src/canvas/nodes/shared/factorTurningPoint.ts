/**
 * ⭐⭐ THE FACTOR CARD'S TURNING POINT — ONE PRODUCER ROW, BOUND BY IDENTITY.
 *
 * UI-SEM-097 (display gate). A factor card may draw a turning-point track only
 * from a PLoT `flip_thresholds[]` row that:
 *
 *   1. names THIS node — `node_id`, else `factor_id` (the key PLoT's
 *      `flip-threshold-denormaliser.ts` actually emits), via the estate's one
 *      owner of that fallback, `normaliseFactorFields`. Never by label;
 *   2. says `flip_reason === 'found'` — the producer's own word for "I
 *      determined a flip". NOT `flip_value !== null`: `insufficient_precision`
 *      and `non_monotonic_grid` rows ship a non-null value too, and reading the
 *      value alone would promote them (`analysisNew/tippingPoints.ts` records
 *      the same rule for the same reason);
 *   3. carries BOTH endpoints as finite numbers, and they differ. A partial row
 *      is dropped, never completed — the same admission `buildTippingPoints`
 *      applies, so the card and the Analysis tab agree on what is sayable.
 *
 * ⛔ NEVER THE ISL `flip_threshold` (`adapters/islRobustnessAdapter.ts`), which
 * UI-SEM-037 defaults to 0.5 when ISL omits it — a fabricated value. This
 * module reads PLoT's array and nothing else.
 *
 * ⚠ WHERE THE ARRAY LIVES — ROOT FIRST. PLoT v2 emits `flip_thresholds` at the
 * response ROOT (`plot-lite-service routes/v2/run.ts`, "Always emitted"), and
 * the live V5 mapper carries it to `report.flip_thresholds`
 * (`v5/mapV5AnalysisToReport.ts`). `report.robustness.flip_thresholds` is only
 * populated when a producer nested it (legacy). A reader of the nested slot
 * alone is dark on the live wire, so this is the estate's root-wins dual read
 * (`analysisSnapshotFactory.ts collectNoFlipFactorIds`, `responseMapper.ts`).
 *
 * Nothing is computed: every number is the producer's.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { normaliseFactorFields } from '../../../lib/mappers/mapFactorSensitivity'

export interface FactorTurningPoint {
  /** Where the factor sits now, in the producer's units. */
  currentValue: number
  /** Where it would have to reach, in the producer's units. */
  flipValue: number
  /** The producer's unit string, verbatim — formatted by the shared formatter. */
  unit: string | undefined
  /** The option the producer names at the turning point, or `null`. */
  alternativeLabel: string | null
}

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const nonEmpty = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

/** The producer's rows: root `flip_thresholds` wins, nested legacy slot second. */
export function flipThresholdRowsOf(report: unknown): readonly unknown[] {
  const r = report as { flip_thresholds?: unknown; robustness?: { flip_thresholds?: unknown } } | null | undefined
  if (Array.isArray(r?.flip_thresholds)) return r.flip_thresholds
  const nested = r?.robustness?.flip_thresholds
  return Array.isArray(nested) ? nested : []
}

/** The first admissible `found` row for `nodeId`, or `null`. See the header for every gate. */
export function selectFactorTurningPoint(report: unknown, nodeId: string): FactorTurningPoint | null {
  for (const raw of flipThresholdRowsOf(report)) {
    if (raw === null || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    if (normaliseFactorFields(row).node_id !== nodeId) continue
    if (row.flip_reason !== 'found') continue
    const currentValue = finite(row.current_value)
    const flipValue = finite(row.flip_value)
    if (currentValue === null || flipValue === null) continue
    // A threshold at the value the factor already sits at states no change.
    if (currentValue === flipValue) continue
    return {
      currentValue,
      flipValue,
      unit: typeof row.unit === 'string' ? row.unit : undefined,
      alternativeLabel: nonEmpty(row.alternative_winner_label),
    }
  }
  return null
}

/** The card's reader: the current report, selected by reference (no fresh object per render). */
export function useFactorTurningPoint(nodeId: string): FactorTurningPoint | null {
  const report = useCanvasStore(s => s.results.report)
  return useMemo(() => selectFactorTurningPoint(report, nodeId), [report, nodeId])
}
