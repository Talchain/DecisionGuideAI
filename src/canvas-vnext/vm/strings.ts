// vNext vocabulary — single source for card copy.
//
// Strength words come ONLY from the unified ladder
// (inspector-v2 getStrengthLabel: Slight/Moderate/Strong/Very strong at
// 0.20/0.40/0.70). The competing ladders (describeEdgeInfluence,
// model-tab strengthBands, edgeLabels boost/drag) are locked out of
// src/canvas-vnext by importIsolation.spec.ts (amendment A4).
//
// All cues are solo-safe (amendment A6): no team/comments/votes/collaboration
// language anywhere in this module.

import { getStrengthLabel } from '../../canvas/ui/inspector-v2/inspectorStrings'

export { getStrengthLabel }

export type ConfidenceWord = 'high' | 'medium' | 'low'

/**
 * Confidence words from beliefExists (0–1). Thresholds follow the repo's
 * established confidence bands (UI-SEM-010 constraint confidence and
 * UI-SEM-017 confidence level: ≥0.70 high, ≥0.40 medium, else low).
 */
export function getConfidenceWord(beliefExists: number): ConfidenceWord {
  if (beliefExists >= 0.7) return 'high'
  if (beliefExists >= 0.4) return 'medium'
  return 'low'
}

/** Relationship sentence: sign of the signed mean picks the verb. */
export function relationshipSentence(sourceLabel: string, targetLabel: string, signedMean: number): string {
  const verb = signedMean < 0 ? 'weakens' : 'strengthens'
  return `${sourceLabel} ${verb} ${targetLabel}`
}

// --- Fixed copy (kept here so specs can pin exact strings) -----------------

/** Local marker required on every stale result-derived claim (amendment A7). */
export const STALE_CLAIM_MARKER = 'From a previous run'

/** Top-strip pill shown whenever results are stale (amendment A7). */
export const STALE_PILL_LABEL = 'Results out of date'

/** Persistent pill whenever fixture-provenance content renders. */
export const FIXTURE_PILL_LABEL = 'Example data — not analysis output'

export const PREVIEW_PILL_LABEL = 'Decision map · Preview'

export const EXIT_LABEL = 'Exit preview'

/** Why-it-matters, fragile edge (real signal: robustness.fragile_edges). */
export const WHY_FRAGILE = 'If this link is wrong, the best choice could flip.'

/** Why-it-matters, resolved-leader endpoint (real signal: recommended_option_id). */
export const WHY_FEEDS_LEADER = 'This relationship feeds the leading option.'

export const ACTION_LABELS = {
  focus: 'Focus',
  evidence: 'Show evidence',
  challenge: 'What if this is wrong?',
  edit: 'Edit relationship',
} as const

export const EDIT_DISABLED_HINT = 'Available in the standard canvas'
export const CHALLENGE_DISABLED_HINT = 'Open the Olumi panel to discuss'
