/**
 * pickStartHere — unified priority ranking across ALL Review next signals
 * (triage factors/edges, option quality, bias triggers). Returns the single
 * highest-priority signal, or null when Must fix is populated.
 *
 * P1-4: the picker re-evaluates on every render so a newly important item
 * promotes automatically when state changes. No caching across renders.
 */

import type { TriageCardItem } from './mapImprovementToTriageCard'

// ---------------------------------------------------------------------------
// Signal types
// ---------------------------------------------------------------------------

export interface TriageSignal {
  kind: 'triage'
  /** Stable identifier — used by section dedup + useResolvedSignals */
  id: string
  /** 0..1 normalised priority score. -1 means "no score available" */
  score: number
  /** Whether the score came from a UI-SEM default rather than real data */
  defaultedScore: boolean
  card: TriageCardItem
  /** Underlying focus target id for dominantFactorId matching */
  focusId?: string
}

export interface OptionQualitySignal {
  kind: 'option_quality'
  id: string
  score: number
  defaultedScore: boolean
  /** For display — the list of option labels this card covers */
  optionLabels: string[]
  /** Whether interventions overlap (drives the coaching line variant) */
  hasInterventionOverlap: boolean
}

export interface BiasSignal {
  kind: 'bias'
  id: string
  score: number
  defaultedScore: boolean
  biasType: string
}

export type ReviewNextSignal = TriageSignal | OptionQualitySignal | BiasSignal

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Option-quality severity scores by check type. Stays conservative so option
 * quality only beats a triage item when the triage item has low influence.
 */
export const OPTION_QUALITY_SEVERITY = {
  intervention_overlap: 0.9, // same_levers firing
  few_options: 0.7,          // < 3 options
  default: 0.6,
} as const

/** Bias severity scores by CEE severity label. Bias cards rarely beat a
 *  high-VoI triage item but can outrank low-influence triage. */
export const BIAS_SEVERITY_SCORE: Record<string, number> = {
  high: 0.85,
  medium: 0.65,
  low: 0.45,
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

export interface PickStartHereOptions {
  /** CEE-provided dominant factor id — highest-priority override when present */
  dominantFactorId?: string | null
  /** When true, Start here is suppressed (Must fix owns the top slot) */
  hasMustFix: boolean
}

function signalLabel(s: ReviewNextSignal): string {
  switch (s.kind) {
    case 'triage':         return s.card.title
    case 'option_quality': return s.optionLabels[0] ?? 'options'
    case 'bias':           return s.biasType
  }
}

export function pickStartHere(
  signals: readonly ReviewNextSignal[],
  opts: PickStartHereOptions,
): ReviewNextSignal | null {
  if (opts.hasMustFix) return null
  if (signals.length === 0) return null

  // 1. CEE dominant_factor_low_confidence override — only wins if the matching
  //    triage signal is present in the input list.
  if (opts.dominantFactorId) {
    const hit = signals.find(
      (s): s is TriageSignal => s.kind === 'triage' && s.focusId === opts.dominantFactorId,
    )
    if (hit) return hit
  }

  // 2. Highest scored signal across all kinds.
  //    Tie-break: alphabetical by label so order is deterministic across renders.
  const sorted = [...signals].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return signalLabel(a).localeCompare(signalLabel(b))
  })
  return sorted[0] ?? null
}
