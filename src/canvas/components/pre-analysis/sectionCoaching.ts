/**
 * sectionCoaching — derive per-section coaching lines from the same ranking
 * source that drives the Start here pick (P1-3). One source of truth prevents
 * contradictory copy between sections.
 *
 * Suppression rules:
 *   1. Redundant with Start here: lowercased + trimmed equality OR ≥80%
 *      substring overlap with the Start here title/subtitle.
 *   2. Defaulted / non-informative confidence: never render a percentage that
 *      came from a UI-SEM default (the picker tags defaulted signals).
 *   3. Source data missing: no overlap data for the option variant, no
 *      influence for the triage variant, count is 0 for Improve confidence.
 *   4. No generic fallback — return null instead of filler text.
 */

import type { ReviewNextSignal, TriageSignal, OptionQualitySignal, BiasSignal } from './pickStartHere'

/**
 * Build the Review next coaching line from the picked Start here signal,
 * or null when suppressed. Called with the SAME ReviewNextSignal that the
 * Start here card displays.
 */
export function getReviewNextCoachingLine(startHere: ReviewNextSignal | null): string | null {
  if (!startHere) return null

  switch (startHere.kind) {
    case 'triage': {
      const tri = startHere as TriageSignal
      // P1-3: never render a percentage when the score was defaulted.
      if (tri.defaultedScore) return null
      const pct = Math.round(tri.score * 100)
      if (pct <= 0) return null
      return `${tri.card.title} drives ${pct}% of the result and hasn't been validated.`
    }
    case 'option_quality': {
      const opt = startHere as OptionQualitySignal
      return opt.hasInterventionOverlap
        ? 'Your options work through similar factors.'
        : null  // few_options variant: no specific coaching copy
    }
    case 'bias': {
      const b = startHere as BiasSignal
      return `Watch for ${b.biasType.toLowerCase()} when reviewing the items below.`
    }
  }
}

/**
 * Build the Improve confidence coaching line from a simple count.
 * Returns null when nothing worth coaching.
 */
export function getImproveConfidenceCoachingLine(itemCount: number): string | null {
  if (itemCount <= 0) return null
  return `${itemCount} ${itemCount === 1 ? 'item' : 'items'} could strengthen confidence.`
}

/**
 * Check whether the coaching line is redundant with the Start here card.
 * Returns true when the line should be suppressed.
 *
 * Rule: lowercased equality OR 80% substring overlap of the shorter string
 * inside the longer one. Prevents "Factor X drives 45%" from duplicating
 * a Start here title of "Factor X".
 */
export function isRedundantWithStartHere(
  line: string,
  startHere: ReviewNextSignal | null,
): boolean {
  if (!startHere) return false
  const startTitle = (() => {
    switch (startHere.kind) {
      case 'triage':         return startHere.card.title
      case 'option_quality': return 'Your options'
      case 'bias':           return startHere.biasType
    }
  })()
  const startSubtitle = startHere.kind === 'triage' ? startHere.card.subtitle ?? '' : ''

  const lineLower = line.trim().toLowerCase()
  const titleLower = startTitle.trim().toLowerCase()
  const subtitleLower = startSubtitle.trim().toLowerCase()

  if (lineLower === titleLower || lineLower === subtitleLower) return true

  // Substring containment: the Start here title (any non-trivial length)
  // appears inside the coaching line, OR vice versa. Covers the common case
  // where the triage coaching line begins with the factor title
  // ("Factor A drives 45%...") — suppress to avoid duplication.
  const MIN_TITLE_LEN = 3
  if (titleLower.length >= MIN_TITLE_LEN) {
    if (lineLower.includes(titleLower)) return true
    if (titleLower.includes(lineLower)) return true
  }
  if (subtitleLower.length >= MIN_TITLE_LEN) {
    if (lineLower.includes(subtitleLower)) return true
    if (subtitleLower.includes(lineLower)) return true
  }

  return false
}

/**
 * Resolve the Review next coaching line end-to-end: build it, then suppress
 * if redundant with Start here. Returns the final string or null.
 */
export function resolveReviewNextCoachingLine(
  startHere: ReviewNextSignal | null,
): string | null {
  const line = getReviewNextCoachingLine(startHere)
  if (!line) return null
  if (isRedundantWithStartHere(line, startHere)) return null
  return line
}
