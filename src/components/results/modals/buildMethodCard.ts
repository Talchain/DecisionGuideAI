/**
 * buildMethodCard — derives the Model-Card-Lite's LIVE run facts from the raw
 * PLoT V2 response (roadmap M4 / P1-9, "where did that number come from?").
 *
 * ⛔ HONESTY CONTRACT — the entire point of this module.
 *
 * Every field is a `Provenanced<T>`: either `{ known: true, value }` because
 * THIS run reported it, or `{ known: false }` because it did not. There is no
 * third state and there are NO DEFAULTS. A missing `n_samples` must never
 * become "1,000"; a missing `evpi_method` must never become "Monte Carlo".
 * The renderer is required to print an explicit "Not reported by this run"
 * line for every `{ known: false }` — absence is disclosed, never hidden and
 * never filled in. This estate has repeatedly shipped confident-looking wrong
 * values (fabricated 80% edge confidence, `?? 0` fabrications,
 * absent-as-zero laundering); a provenance surface that did the same would be
 * the worst possible instance of that class.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DERIVE — influence basis.
 * `DriversSection` already owns the influence-basis policy
 * (`influence_score` vs per-set normalised `|elasticity|`) via
 * `selectDriverDisplayModel` + `influenceScaleCopy`, and already discloses it
 * inline. Re-deriving it here would create a SECOND source of truth for the
 * same policy — the hand-maintained-mirror defect that drifts silently. The
 * card therefore describes what influence means, and leaves the live basis
 * disclosure to the section that computes it.
 *
 * Read directly off `rawV2Response` (canvas store) because every field below
 * is a straight wire passthrough with no display policy attached.
 */

/** Either this run reported the fact, or it did not. No defaults, no third state. */
export type Provenanced<T> = { known: true; value: T } | { known: false }

const UNKNOWN: { known: false } = { known: false }

function known<T>(value: T): Provenanced<T> {
  return { known: true, value }
}

export interface ConfidenceCalibration {
  /** True when the producer stamped the confidence figure provisional. */
  isProvisional: boolean
  /** Producer's calibration status string, when it sent one. */
  status: string | null
}

export interface StabilityThresholds {
  /** True when the producer stamped its stability bands provisional. */
  isProvisional: boolean
  /** Producer's threshold-set version, when it sent one. */
  version: string | null
}

export interface MethodCardModel {
  /** Monte-Carlo sample count for this run (`meta.n_samples`). */
  nSamples: Provenanced<number>
  /** Seed used, so the run is reproducible (`meta.seed_used`). */
  seed: Provenanced<string>
  /**
   * How value-of-information was computed (`factor_sensitivity[].evpi_method`).
   * Known ONLY when every reporting factor agrees; a disagreement is reported
   * as unknown rather than silently resolved to the first or most common value.
   */
  evpiMethod: Provenanced<string>
  /**
   * Whether the confidence figures are calibrated
   * (`factor_sensitivity[].confidence_provenance`). Provisional if ANY factor
   * is provisional — the same conservative direction DriversSection already
   * ships (`drivers.some(d => d.confidenceProvenance?.isProvisional)`).
   */
  confidenceCalibration: Provenanced<ConfidenceCalibration>
  /** Whether the robustness bands are provisional (`stability_thresholds`). */
  stabilityThresholds: Provenanced<StabilityThresholds>
  /** Whether an operational-uncertainty adjustment was applied (`auto_noise_provenance`). */
  autoNoiseApplied: Provenanced<boolean>
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** A finite number, or unknown. Rejects NaN/Infinity — never coerces. */
function finiteNumber(v: unknown): Provenanced<number> {
  return typeof v === 'number' && Number.isFinite(v) ? known(v) : UNKNOWN
}

/**
 * A non-empty string, or unknown. `seed_used` arrives as a string in real
 * captures ("485977") but is number-typed in some contract revisions, so both
 * are accepted — and anything else is unknown rather than String()-coerced.
 */
function idString(v: unknown): Provenanced<string> {
  if (typeof v === 'string' && v.trim() !== '') return known(v)
  if (typeof v === 'number' && Number.isFinite(v)) return known(String(v))
  return UNKNOWN
}

/**
 * Collapse a per-factor string field to one run-level value.
 * Known only when at least one factor reports it AND all reporters agree.
 */
function unanimousString(factors: Record<string, unknown>[], key: string): Provenanced<string> {
  const reported = factors
    .map((f) => f[key])
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  if (reported.length === 0) return UNKNOWN
  const first = reported[0]
  return reported.every((v) => v === first) ? known(first) : UNKNOWN
}

export function buildMethodCard(rawV2Response: unknown): MethodCardModel {
  const root = asRecord(rawV2Response)
  const meta = asRecord(root?.meta)

  const factors: Record<string, unknown>[] = Array.isArray(root?.factor_sensitivity)
    ? (root!.factor_sensitivity as unknown[]).map(asRecord).filter((f): f is Record<string, unknown> => f !== null)
    : []

  // ── Confidence calibration ────────────────────────────────────────────
  // Only factors that actually carry a confidence_provenance object count.
  // Zero carriers = unknown (the 2026-04-05 capture is exactly this case);
  // it must NOT read as "calibrated".
  const provenances = factors
    .map((f) => asRecord(f.confidence_provenance))
    .filter((p): p is Record<string, unknown> => p !== null)

  const confidenceCalibration: Provenanced<ConfidenceCalibration> =
    provenances.length === 0
      ? UNKNOWN
      : known({
          isProvisional: provenances.some((p) => p.is_provisional === true),
          status:
            typeof provenances[0].calibration_status === 'string'
              ? (provenances[0].calibration_status as string)
              : null,
        })

  // ── Stability thresholds ──────────────────────────────────────────────
  const rawThresholds = asRecord(root?.stability_thresholds)
  const stabilityThresholds: Provenanced<StabilityThresholds> =
    rawThresholds === null || typeof rawThresholds.provisional !== 'boolean'
      ? UNKNOWN
      : known({
          isProvisional: rawThresholds.provisional,
          version: typeof rawThresholds.version === 'string' ? rawThresholds.version : null,
        })

  // ── Auto-noise ────────────────────────────────────────────────────────
  // Presence of the provenance object IS the signal that the adjustment ran.
  // Absence is unknown, never "no adjustment was applied".
  const autoNoiseApplied: Provenanced<boolean> =
    asRecord(root?.auto_noise_provenance) !== null ? known(true) : UNKNOWN

  return {
    nSamples: finiteNumber(meta?.n_samples),
    seed: idString(meta?.seed_used),
    evpiMethod: unanimousString(factors, 'evpi_method'),
    confidenceCalibration,
    stabilityThresholds,
    autoNoiseApplied,
  }
}
