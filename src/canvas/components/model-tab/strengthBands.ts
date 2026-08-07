/**
 * Strength, confidence, and existence band classification for validation UI.
 *
 * Band thresholds are defined in validation_ui_data_contract_v1.md.
 * Do not alter thresholds without updating the contract document.
 */

import type { EstimateBasis, ContestedReason } from '../../domain/validation'
import type { EdgeDirectionDisplay } from '../../domain/edgeValueProvenance'

// ── Strength bands ────────────────────────────────────────────────────────────

export type StrengthBand = 'strong' | 'moderate' | 'weak' | 'negligible'

/**
 * Classify |mean| into a strength band.
 * Thresholds: Strong ≥ 0.6, Moderate ≥ 0.25, Weak ≥ 0.05, else Negligible.
 */
export function getStrengthBand(mean: number): StrengthBand {
  const abs = Math.abs(mean)
  if (abs >= 0.6) return 'strong'
  if (abs >= 0.25) return 'moderate'
  if (abs >= 0.05) return 'weak'
  return 'negligible'
}

/**
 * Band midpoints used by the contested-edge quick-set pills.
 * Each value sits in the middle of its band's |mean| range.
 */
export const STRENGTH_BAND_MIDPOINTS: Record<Exclude<StrengthBand, 'negligible'>, number> = {
  weak: 0.15,
  moderate: 0.40,
  strong: 0.70,
}

/**
 * Signed band midpoint, sign taken from the canvas edge's direction field.
 * Used by the contested-edge quick-set pills to produce a resolved `strength_mean`
 * that preserves the existing direction.
 */
export function getSignedMidpoint(
  band: Exclude<StrengthBand, 'negligible'>,
  direction: 'positive' | 'negative',
): number {
  const m = STRENGTH_BAND_MIDPOINTS[band]
  return direction === 'negative' ? -m : m
}

/**
 * Full user-facing strength label, e.g. "Strong positive effect".
 * Negligible always returns "Negligible effect" (no direction qualifier).
 *
 * ⚠ NAMED `getDirectionalStrengthLabel`, NOT `getStrengthLabel`, DELIBERATELY.
 * `ui/inspector-v2/inspectorStrings.ts:98` already exports a `getStrengthLabel`
 * — a MAGNITUDE-ONLY band namer (`'Very strong' | 'Strong' | 'Moderate' |
 * 'Slight'`, different thresholds, no direction). This function briefly shared
 * that name, which is the `generateGraphHash` twin-name trap forming in real
 * time: two same-named functions with different domains, one of which quietly
 * answers a question the other refuses to. The name now states the difference.
 *
 * ⚠ THE DIRECTION IS AN ARGUMENT, NOT AN INFERENCE (ROADMAP 2.263).
 *
 * This function used to compute `const direction = mean >= 0 ? 'positive' :
 * 'negative'` — it read a scientific claim off the sign of a number the UI had
 * itself signed from a DEFAULTED direction field. Every edge whose producer
 * omitted `effect_direction`, or sent the declared contract value `'unknown'`,
 * was rendered to the user as **"Strong positive effect"**.
 *
 * The parameter is REQUIRED so that every call site has to say where its
 * direction came from; there is no overload that lets a caller fall back to the
 * old inference. `resolveEdgeDirectionDisplay` is the owner of that answer for
 * canvas edge data, and `directionFromProducerSignedMean` for a producer's
 * pre-signed validator mean.
 *
 * `mean` is used ONLY for its magnitude here.
 */
export function getDirectionalStrengthLabel(mean: number, direction: EdgeDirectionDisplay): string {
  const band = getStrengthBand(mean)
  if (band === 'negligible') return 'Negligible effect'
  const magnitude = band.charAt(0).toUpperCase() + band.slice(1)
  // Absence stays absence: name the magnitude, and say plainly that the
  // direction was never stated rather than picking one.
  if (!direction.show) return `${magnitude} effect, direction not stated`
  return `${magnitude} ${direction.direction} effect`
}

// ── Confidence bands ──────────────────────────────────────────────────────────

export type ConfidenceBand = 'high' | 'moderate' | 'low'

/**
 * Classify epistemic uncertainty (std) into a confidence band.
 * Thresholds: High std < 0.10, Moderate 0.10 ≤ std < 0.20, Low std ≥ 0.20.
 */
export function getConfidenceBand(std: number): ConfidenceBand {
  if (std < 0.10) return 'high'
  if (std < 0.20) return 'moderate'
  return 'low'
}

/** User-facing confidence label. */
export function getConfidenceLabel(std: number): string {
  const band = getConfidenceBand(std)
  if (band === 'high') return 'High confidence'
  if (band === 'moderate') return 'Moderate confidence'
  return 'Low confidence'
}

// ── Existence bands ───────────────────────────────────────────────────────────

export type ExistenceBand = 'near-certain' | 'likely' | 'uncertain' | 'speculative'

/**
 * Classify existence probability (ep) into an existence band.
 * Thresholds: Near-certain ≥ 0.9, Likely ≥ 0.7, Uncertain ≥ 0.5, else Speculative.
 */
export function getExistenceBand(ep: number): ExistenceBand {
  if (ep >= 0.9) return 'near-certain'
  if (ep >= 0.7) return 'likely'
  if (ep >= 0.5) return 'uncertain'
  return 'speculative'
}

/** User-facing existence label. */
export function getExistenceLabel(ep: number): string {
  const band = getExistenceBand(ep)
  if (band === 'near-certain') return 'Very likely to exist'
  if (band === 'likely') return 'Likely to exist'
  if (band === 'uncertain') return 'May or may not exist'
  return 'Speculative'
}

// ── Basis labels ──────────────────────────────────────────────────────────────

const BASIS_LABELS: Record<EstimateBasis, string> = {
  brief_explicit: 'Based on your brief',
  structural_inference: 'Inferred from model structure',
  domain_prior: 'Based on general domain knowledge',
  weak_guess: 'Uncertain — your input would help',
}

/** User-facing label for an EstimateBasis value. */
export function getBasisLabel(basis: EstimateBasis): string {
  return BASIS_LABELS[basis]
}

// ── Contested reason labels ───────────────────────────────────────────────────

const CONTESTED_REASON_LABELS: Record<ContestedReason, string> = {
  sign_flip: 'Our reviews disagree on whether this effect is positive or negative',
  strength_band_change: 'Our reviews disagree on how strong this effect is',
  confidence_band_change: 'Our reviews disagree on how confident we should be',
  existence_boundary_crossing: 'Our reviews disagree on whether this relationship is reliable',
  raw_magnitude: 'Our reviews give meaningfully different estimates',
}

/** User-facing explanation for a ContestedReason value. */
export function getContestedReasonLabel(reason: ContestedReason): string {
  return CONTESTED_REASON_LABELS[reason]
}
