/**
 * ⭐ A FACTOR'S TURNING POINT — read, never computed (spec §3 "Primary
 * mini-visual precedence", item 1: "if a real flip threshold exists").
 *
 * A row counts only when PLoT says it FOUND the flip (`flip_reason: 'found'`,
 * the producer's own word — the gate `analysisNew/tippingPoints.ts` applies),
 * both values are finite and the flip is not at the current value. ISL's 0.5
 * default is never read (UI-SEM-037).
 *
 * ⛔ THE NUMBER IS PRINTED ONLY ON THE DISPLAY SCALE. PLoT stamps
 * `value_scale: 'normalised'` on rows it could not denormalise, whose values
 * are still in [0,1] (plot-lite-service `flip-threshold-denormaliser.ts`). A raw
 * `0.5` printed on a headcount is ROADMAP 2.1371's acceptance failure, so a row
 * that is not stamped `'display'` keeps its DIRECTION and loses its number.
 */
import { normaliseFactorFields } from '../../../lib/mappers/mapFactorSensitivity'
import type { FactorTurningPoint } from './nodeAttention'

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** Both producer placements: the response root and `robustness`. */
export function flipThresholdRowsOf(report: unknown): readonly unknown[] {
  const r = report as { flip_thresholds?: unknown; robustness?: { flip_thresholds?: unknown } } | null | undefined
  if (Array.isArray(r?.flip_thresholds)) return r.flip_thresholds
  const nested = r?.robustness?.flip_thresholds
  return Array.isArray(nested) ? nested : []
}

export function selectFactorTurningPoint(report: unknown, nodeId: string): FactorTurningPoint | null {
  for (const raw of flipThresholdRowsOf(report)) {
    if (raw === null || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    if (normaliseFactorFields(row).node_id !== nodeId) continue
    if (row.flip_reason !== 'found') continue
    const currentValue = finite(row.current_value)
    const flipValue = finite(row.flip_value)
    if (currentValue === null || flipValue === null) continue
    if (currentValue === flipValue) continue
    return {
      currentValue,
      flipValue,
      unit: typeof row.unit === 'string' ? row.unit : undefined,
      displayScale: row.value_scale === 'display',
    }
  }
  return null
}

/** Every factor with a found turning point, keyed by node id. */
export function selectTurningPoints(report: unknown): Map<string, FactorTurningPoint> {
  const out = new Map<string, FactorTurningPoint>()
  for (const raw of flipThresholdRowsOf(report)) {
    if (raw === null || typeof raw !== 'object') continue
    const id = normaliseFactorFields(raw as Record<string, unknown>).node_id
    if (!id || out.has(id)) continue
    const tp = selectFactorTurningPoint(report, id)
    if (tp) out.set(id, tp)
  }
  return out
}
