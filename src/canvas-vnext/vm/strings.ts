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

// --- Stage-3 node-card copy (all solo-safe, amendment A6) -------------------

/** Factor flag pill labels (UI-SEM-077 ladder). */
export const FACTOR_FLAG_LABELS = {
  top_driver: 'Top driver',
  could_flip: 'Could flip result',
  weak_evidence: 'Weak evidence',
  worth_checking: 'Worth checking',
  worth_discussing: 'Worth discussing', // fixture-only — live builds never emit
} as const

/** Decision lead sentence — leader identity must be resolved (UI-SEM-072). */
export function decisionLeadSentence(leaderLabel: string, winDisplay: string): string {
  return `${leaderLabel} leads in ${winDisplay} of scenarios`
}

export function sensitiveToLine(factorLabel: string): string {
  return `Sensitive to ${factorLabel}`
}

/** Outcome goal-effect polarity words (plan §S3: Helps/Drags). */
export const OUTCOME_EFFECT_LABELS = {
  helps: 'Helps the goal',
  hurts: 'Drags the goal',
} as const

export const GOAL_NEEDS_TARGET_HINT = 'Set a target to compare goal fit'

export function goalTargetLine(targetDisplay: string): string {
  return `Success target: ${targetDisplay}`
}

export function riskLikelihoodLine(probability: number): string {
  return `${Math.round(probability * 100)}% likely`
}

export function riskImpactLine(impact: string): string {
  return `${impact} impact`
}

export function fragileLinkLine(count: number): string {
  return count === 1 ? 'Part of a fragile link' : `Part of ${count} fragile links`
}
