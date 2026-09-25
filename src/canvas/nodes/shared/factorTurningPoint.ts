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
import { isAttestedNoFlipReason } from '../../../components/results/utils/flipReasonVocabulary'
import { classifyUnit } from '../../../utils/unitClassifier'
import type { FactorTurningPoint } from './nodeAttention'

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const nonEmpty = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

/**
 * A turning point plus its OPTION SCOPE (Paul 23 Sep contract feedback point 3:
 * "show option scope where relevant"). `alternativeLabel` is the producer's own
 * `alternative_winner_label` — the option the comparison shifts towards — or
 * null when PLoT named none. Never inferred from a sign or a rank.
 */
export interface FactorTurningPointDetail extends FactorTurningPoint {
  alternativeLabel: string | null
}

/**
 * Paul 23 Sep contract feedback point 3: "no turning point available" is the
 * NORMAL fallback, so the reader answers it as a first-class state rather than
 * a bare null. `attested` is true ONLY for the two producer tokens that mean the
 * search RAN and found nothing (`isAttestedNoFlipReason`) — a timeout, a missing
 * row or an unknown token established nothing, and must never read as "none in
 * this run" (ROADMAP 2.280).
 */
export type FactorTurningPointState =
  | { kind: 'found'; turningPoint: FactorTurningPointDetail }
  | { kind: 'none'; attested: boolean }

/** Both producer placements: the response root and `robustness`. */
export function flipThresholdRowsOf(report: unknown): readonly unknown[] {
  const r = report as { flip_thresholds?: unknown; robustness?: { flip_thresholds?: unknown } } | null | undefined
  if (Array.isArray(r?.flip_thresholds)) return r.flip_thresholds
  const nested = r?.robustness?.flip_thresholds
  return Array.isArray(nested) ? nested : []
}

export function selectFactorTurningPoint(report: unknown, nodeId: string): FactorTurningPointDetail | null {
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
      alternativeLabel: nonEmpty(row.alternative_winner_label),
    }
  }
  return null
}

/** The factor's turning point, or the fallback it gets instead. */
export function selectFactorTurningPointState(report: unknown, nodeId: string): FactorTurningPointState {
  const turningPoint = selectFactorTurningPoint(report, nodeId)
  if (turningPoint) return { kind: 'found', turningPoint }
  const attested = flipThresholdRowsOf(report).some((raw) => {
    if (raw === null || typeof raw !== 'object') return false
    const row = raw as Record<string, unknown>
    return normaliseFactorFields(row).node_id === nodeId && isAttestedNoFlipReason(row.flip_reason as string | undefined)
  })
  return { kind: 'none', attested }
}

/**
 * ⛔ UNITS MUST BE COMPATIBLE OR THE TRACK WITHHOLDS (visual contract v3: "a
 * turning point requires a real found threshold with compatible units"). The
 * row's unit and the factor's unit must classify to the same kind and the same
 * canonical form ('%' and 'percent' agree; '%' and 'seats' do not). Both absent
 * agree; one absent does not — a bare number beside a unit-bearing value would
 * put two footings on one card.
 */
export function turningPointUnitsCompatible(
  rowUnit: string | null | undefined,
  factorUnit: string | null | undefined,
): boolean {
  const a = classifyUnit(rowUnit)
  const b = classifyUnit(factorUnit)
  if (a.kind !== b.kind) return false
  return a.canonical.toLowerCase() === b.canonical.toLowerCase()
}

/**
 * ⭐ ONE OWNER FOR "MAY THIS TURNING POINT PRINT ITS NUMBER?" — the display
 * scale (ROADMAP 2.1371) AND compatible units. `factorUnit` `undefined` means
 * the caller has no unit to check against (the factor carries no numeric
 * value), so the display-scale gate alone applies. The track reads it to
 * decide number-and-track; `FactorNode` reads it to decide whether the TOP
 * driver's turning point may sit on the resting card, where the prototype's
 * caption is never shown without its number.
 */
export function turningPointNumberPrints(
  turningPoint: Pick<FactorTurningPoint, 'displayScale' | 'unit'>,
  factorUnit: string | null | undefined,
): boolean {
  return turningPoint.displayScale && (factorUnit === undefined || turningPointUnitsCompatible(turningPoint.unit, factorUnit))
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
