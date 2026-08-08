/**
 * Edge Label Utilities
 *
 * v1.2: Converts technical weight/belief pairs into meaningful human-readable labels.
 * Uses British English and plain language to make edges accessible to non-technical users.
 */

import type { EdgeDirectionDisplay, EdgeValueDisplay } from './edgeValueProvenance'

export type EdgeLabelMode = 'human' | 'numeric'

const STORAGE_KEY = 'canvas.edge-labels-mode'

/**
 * Get the current edge label mode from localStorage
 * Defaults to 'human' for better UX
 */
export function getEdgeLabelMode(): EdgeLabelMode {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'human'
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'numeric') return 'numeric'
    return 'human'
  } catch {
    return 'human'
  }
}

/**
 * Set the edge label mode in localStorage
 */
export function setEdgeLabelMode(mode: EdgeLabelMode): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Fail silently if storage is unavailable
  }
}

export interface EdgeDescription {
  label: string
  tooltip: string
}

/**
 * Describe an edge in human-readable terms based on strength and belief
 *
 * Weight scale (applied to the RESOLVED strength's magnitude):
 * - Strong: |w| >= 0.7
 * - Moderate: 0.3 <= |w| < 0.7
 * - Weak: |w| < 0.3
 *
 * Belief scale (confidence):
 * - High: b >= 80%
 * - Medium: 60% <= b < 80%
 * - Low: b < 60%
 * - Undefined: treat as uncertain
 *
 * ⚠⚠ THE STRENGTH IS A RESOLVED DISPLAY, NOT A RAW NUMBER (ROADMAP 2.950).
 * ------------------------------------------------------------------------
 * The direction gate below (2.935) closed one clause of this string and left
 * the other open: `StyledEdge` passed `edgeData?.weight ?? 0.5`, and the edge
 * defaults (`DEFAULT_EDGE_DATA.weight = 0.5`, `USER_EDGE_DEFAULTS.weight =
 * 0.3`) define `weight` on every edge whether anyone set it or not. So an edge
 * whose strength NOBODY characterised read "Moderate effect, direction not
 * stated" — the direction half refusing to claim while the strength half
 * asserted a band derived from a UI constant.
 *
 * The parameter is now a required `EdgeValueDisplay`, resolved by
 * `resolveEdgeSignedStrengthDisplay` — the SAME resolver that already gates
 * this component's stroke width — for the same reason the direction parameter
 * is an `EdgeDirectionDisplay`: there is no argument that means "0.5, source
 * unknown", so a defaulted number cannot produce a band adjective by accident
 * and cannot be forgotten.
 *
 * When the strength resolves `show: false`, the value inside is used for
 * NOTHING — not the band, not the tooltip number. When it resolves `show:
 * true`, only its MAGNITUDE is read, exactly as `weight` before it: the sign
 * of `resolveEdgeSignedStrengthDisplay`'s value is NOT a direction claim (its
 * header forbids reading it as one, in capitals) — the direction argument
 * remains the one owner of that word.
 *
 * COPY (ratified, ROADMAP 2.950): when NEITHER strength nor direction is set,
 * the label reuses the hover popover's existing vocabulary — "Strength and
 * likelihood not set" (`edge-hover-popover-unset` in `StyledEdge`) — one
 * phrase for one concept, no new copy. When exactly one half has provenance,
 * that half speaks and the other says only that it was not set.
 * NOTE the two surfaces gate the same sentence on slightly different pairs:
 * the popover fires it on (strength unset AND likelihood unset) because it has
 * no direction line; this label fires it on (strength unset AND direction
 * unset) because `belief` — its only likelihood channel — is a raw legacy
 * field with no provenance marker to consult. Both remain silent about the
 * legacy `belief` value, which the tooltip still reports honestly.
 *
 * ⚠⚠ THE DIRECTION IS AN ARGUMENT, NOT AN INFERENCE (ROADMAP 2.935, Codex MF5).
 * ----------------------------------------------------------------------------
 * This function used to compute `const isPositive = weight >= 0` and pick
 * "boost" or "drag" from it. Its only product caller — `StyledEdge` via
 * `getEdgeLabel` — passes `edgeData.weight`, and BOTH ingestion paths store that
 * as an UNSIGNED MAGNITUDE beside a separate direction field:
 *
 *     const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))   // UI-SEM-023
 *
 * So `weight >= 0` was true for every edge in the product, and every causal edge
 * on the canvas read "boost" — including the ones CEE sent a NEGATIVE
 * `strength.mean` for. A factor the model says REDUCES the goal was labelled
 * "Moderate boost (uncertain)" while the glyph beside it announced "Effect
 * direction: negative".
 *
 * `weight` is now used ONLY for its magnitude — the sign of the argument is
 * ignored deliberately, so no caller can smuggle a direction claim back in
 * through a number.
 *
 * The parameter is REQUIRED, and typed as `EdgeDirectionDisplay` rather than a
 * bare `'positive' | 'negative'`, for the same reason `computeDirectionStroke`
 * (ROADMAP 2.928) and `getDirectionalStrengthLabel` (2.263) take one: there is
 * no argument that means "positive, source unknown", so an unstated direction
 * cannot produce a signed word by accident and cannot be forgotten.
 * `resolveEdgeDirectionDisplay` is the ONE OWNER of that answer for canvas edge
 * data — do not add a second predicate here (CLAUDE.md trap 21).
 *
 * ⚠ Do NOT "fix" a caller by re-signing the weight from
 * `resolveEdgeSignedStrengthDisplay` instead. That module's header forbids it in
 * capitals — an unstated direction lands there as `+1`, so a word read off that
 * sign would fabricate "boost" on exactly the edges this gate exists to protect.
 *
 * Direction:
 * - Direction STATED positive → boost/increase/push
 * - Direction STATED negative → drag/decrease/hinder
 * - Direction NOT STATED      → name the magnitude, say the direction was never
 *   stated. Same vocabulary as `getDirectionalStrengthLabel`, deliberately: one
 *   phrase for one concept across the canvas and the Model tab.
 *
 * British English spelling throughout
 */
export function describeEdge(
  strength: EdgeValueDisplay,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
): EdgeDescription {
  // The magnitude this label is entitled to speak about — null when nothing
  // proves anyone set a strength. See the header: the display's value is used
  // for NOTHING in that case.
  const absWeight = strength.show ? Math.abs(strength.value) : null

  let claim: string
  if (absWeight !== null) {
    // Categorize strength
    const strengthLabel = absWeight >= 0.7 ? 'Strong' : absWeight >= 0.3 ? 'Moderate' : 'Weak'
    // Absence stays absence: name the magnitude, and say plainly that the
    // direction was never stated rather than picking one.
    claim = direction.show
      ? `${strengthLabel} ${direction.direction === 'positive' ? 'boost' : 'drag'}`
      : `${strengthLabel} effect, direction not stated`
  } else if (!direction.show) {
    // Neither half has provenance: the ratified popover copy, unqualified —
    // there is no claim for the belief channel to qualify.
    return {
      label: 'Strength and likelihood not set',
      tooltip: buildWeightTooltip(null, belief, direction),
    }
  } else {
    // Direction stated, strength not set: the stated half speaks, the unset
    // half says so — same clause shape as the direction arm above, same
    // "not set" vocabulary as the popover and the tooltip below.
    claim = `${direction.direction === 'positive' ? 'Boost' : 'Drag'}, strength not set`
  }

  // Categorize confidence (if belief is provided)
  let confidence: 'high' | 'medium' | 'low' | 'uncertain'
  if (belief !== undefined) {
    if (belief >= 0.8) {
      confidence = 'high'
    } else if (belief >= 0.6) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }
  } else {
    confidence = 'uncertain'
  }

  // Add confidence qualifier if belief is low or missing
  let label: string
  if (confidence === 'low' || confidence === 'uncertain') {
    label = `${claim} (uncertain)`
  } else {
    label = claim
  }

  return { label, tooltip: buildWeightTooltip(absWeight, belief, direction) }
}

/**
 * The numeric half of the tooltip, shared by both label modes so the sign rule
 * lives once. The minus sign is a DIRECTION CLAIM and is printed only when the
 * direction was stated; an unstated direction prints the bare magnitude, which
 * is all we are entitled to say about it.
 *
 * `absWeight: null` means NO SET STRENGTH (ROADMAP 2.950): the tooltip prints
 * "not set" — the same vocabulary its own belief clause has always used — and
 * no sign, because the minus decorates a number and there is no number.
 */
function buildWeightTooltip(
  absWeight: number | null,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
): string {
  const beliefText = belief !== undefined ? `${Math.round(belief * 100)}%` : 'not set'
  const weightText =
    absWeight !== null ? `${signPrefix(direction)}${absWeight.toFixed(2)}` : 'not set'
  return `Weight: ${weightText}, Belief: ${beliefText}`
}

/** '−' (U+2212 MINUS SIGN) only for a STATED negative direction; '' otherwise. */
function signPrefix(direction: EdgeDirectionDisplay): string {
  return direction.show && direction.direction === 'negative' ? '−' : ''
}

/**
 * Format edge label in numeric format (legacy)
 * Example: "w −0.60 • b 85%"
 *
 * Same gates as `describeEdge`, for the same reasons:
 * - the leading minus is a direction claim, and the magnitude reaches here
 *   unsigned. Before ROADMAP 2.935 this printed `w 0.35` for an edge whose CEE
 *   mean was −0.35 — the numeric channel did not invert the claim, it silently
 *   DELETED it.
 * - the number itself is a strength claim (ROADMAP 2.950). Before the gate
 *   this printed `w 0.50` — the `DEFAULT_EDGE_DATA` constant, verbatim — for an
 *   edge whose strength nobody set. An unset strength now prints `w not set`;
 *   the sign gate is moot in that state because there is no number to sign.
 */
export function formatNumericLabel(
  strength: EdgeValueDisplay,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
): string {
  const weightText = strength.show
    ? `${signPrefix(direction)}${Math.abs(strength.value).toFixed(2)}`
    : 'not set'

  if (belief !== undefined) {
    return `w ${weightText} • b ${Math.round(belief * 100)}%`
  }

  return `w ${weightText}`
}

/**
 * Get the appropriate edge label based on current mode.
 *
 * `strength` and `direction` sit BEFORE the optional `mode` so neither can be
 * omitted — the whole point of the ROADMAP 2.935 + 2.950 gates. See
 * `describeEdge`'s header.
 */
export function getEdgeLabel(
  strength: EdgeValueDisplay,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
  mode?: EdgeLabelMode,
): EdgeDescription {
  const actualMode = mode ?? getEdgeLabelMode()

  if (actualMode === 'numeric') {
    const numericLabel = formatNumericLabel(strength, belief, direction)
    return {
      label: numericLabel,
      tooltip: numericLabel
    }
  }

  return describeEdge(strength, belief, direction)
}
