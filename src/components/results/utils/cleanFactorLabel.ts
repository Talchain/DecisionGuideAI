/**
 * Label Cleaning Utility
 *
 * Strips encoding notation from factor labels for cleaner display.
 * Task 7: Fix encoding leak in labels.
 *
 * Patterns stripped:
 * - (0/1), (0–1), (0-1) - bare encoding
 * - (0–1 qualitative scale), (0–1, share of £20k cap) - encoding with context
 * - (yes/no), (binary), (on/off), (true/false) - boolean text
 * - Generic numeric ranges like (0-100), (0-10)
 *
 * The regex matches opening paren, 0, any dash char (hyphen/en-dash/em-dash/slash),
 * 1, then anything up to closing paren.
 */

export interface CleanedLabel {
  /** Cleaned label without encoding notation */
  label: string
  /** Optional qualifier extracted from the pattern (e.g., "Yes/No" for binary) */
  qualifier?: string
}

/**
 * Master regex for ALL encoding patterns.
 * Matches: (0-1...), (0–1...), (0—1...), (0/1)
 * Uses Unicode code points:
 * - \u002D = hyphen-minus (-)
 * - \u2013 = en-dash (–)
 * - \u2014 = em-dash (—)
 * - \/ = forward slash (for 0/1 boolean)
 */
const ENCODING_PATTERN = /\s*\(0[\u002D\u2013\u2014/]1[^)]*\)\s*/g

/**
 * Discrete encoding pattern: (0=Label, 1=Label) or (0=Cat, 0.94=Dog)
 * Matches any parenthetical containing digit[.digit]=label assignments.
 * Covers integer keys (0=Cat, 1=Dog), decimal keys (0=Cat, 0.94=Dog),
 * and multi-entry lists (0=A, 1=B, 2=C).
 */
const DISCRETE_ENCODING_PATTERN = /\s*\([^)]*\d+\.?\d*\s*=\s*[^)]+\)\s*/g

/**
 * Strip parenthetical encoding notation from a label.
 *
 * @param rawLabel - The raw label that may contain encoding patterns
 * @returns Object with cleaned label and optional qualifier
 *
 * @example
 * cleanFactorLabel("Tech Lead Hired (0/1)") // { label: "Tech Lead Hired", qualifier: "Yes/No" }
 * cleanFactorLabel("Budget (0–1, share of £20k cap)") // { label: "Budget" }
 * cleanFactorLabel("Competitive Response Intensity (0–1 qualitative scale)") // { label: "Competitive Response Intensity" }
 * cleanFactorLabel("Market Size (0-100)") // { label: "Market Size" }
 */
export function cleanFactorLabel(rawLabel: string): CleanedLabel {
  if (!rawLabel || typeof rawLabel !== 'string') {
    return { label: rawLabel || '' }
  }

  // Determine qualifier based on pattern type
  let qualifier: string | undefined
  if (/\(0\/1\)/i.test(rawLabel)) {
    qualifier = 'Yes/No'
  } else if (/\(0 or 1\)/i.test(rawLabel)) {
    qualifier = 'Yes/No'
  } else if (/\(yes\/no\)/i.test(rawLabel)) {
    qualifier = 'Yes/No'
  } else if (/\(binary\)/i.test(rawLabel)) {
    qualifier = 'Yes/No'
  } else if (/\(on\/off\)/i.test(rawLabel)) {
    qualifier = 'On/Off'
  } else if (/\(true\/false\)/i.test(rawLabel)) {
    qualifier = 'True/False'
  }

  // First, handle the master encoding pattern (0-1, 0–1, 0/1 with anything after)
  let cleanedLabel = rawLabel.replace(ENCODING_PATTERN, ' ')

  // Discrete encoding: (0=Developers, 1=Tech Lead)
  cleanedLabel = cleanedLabel.replace(DISCRETE_ENCODING_PATTERN, ' ')

  // Also handle other boolean text patterns
  const otherPatterns = [
    /\s*\(0 or 1\)\s*/gi,
    /\s*\(yes\/no\)\s*/gi,
    /\s*\(binary\)\s*/gi,
    /\s*\(on\/off\)\s*/gi,
    /\s*\(true\/false\)\s*/gi,
    /\s*\(\d+[\u002D\u2013\u2014]\d+\)\s*/g, // Generic numeric ranges like (0-100)
  ]

  for (const pattern of otherPatterns) {
    cleanedLabel = cleanedLabel.replace(pattern, ' ')
  }

  return { label: cleanedLabel.trim(), qualifier }
}

/**
 * Strip encoding notation from a label, returning just the cleaned string.
 * Use this when you don't need the qualifier.
 *
 * @param rawLabel - The raw label that may contain encoding patterns
 * @returns Cleaned label string
 */
export function stripEncodingNotation(rawLabel: string): string {
  return cleanFactorLabel(rawLabel).label
}

/**
 * Matches a trailing parenthetical "(Status Quo)" (case-insensitive, any
 * amount of internal whitespace), optionally preceded by a space. Only
 * applied to option card titles when a Baseline pill already communicates
 * the same information — see formatOptionLabelForCard below.
 */
const STATUS_QUO_TRAILING_PATTERN = /\s*\(\s*status\s+quo\s*\)\s*$/i

/**
 * Display-only helper for option-card titles.
 *
 * When the baseline pill is rendering, the title no longer needs the
 * trailing "(Status Quo)" — it would duplicate the signal and force the
 * label to wrap to three lines on the runner-up card. Strips only the
 * trailing occurrence, only when `hasBaselinePill === true`, and leaves
 * the underlying option label unchanged elsewhere.
 *
 * Brief 5.1 Task 7. Always compose with stripEncodingNotation so the
 * encoding suffix (0/1, 0–1, discrete) is also removed for display.
 *
 * @example
 * formatOptionLabelForCard("Continue Without Dedicated Support (Status Quo)", true)
 * // → "Continue Without Dedicated Support"
 * formatOptionLabelForCard("Hire Tech Lead", false)
 * // → "Hire Tech Lead"
 */
export function formatOptionLabelForCard(
  rawLabel: string,
  hasBaselinePill: boolean,
): string {
  const base = stripEncodingNotation(rawLabel)
  if (!hasBaselinePill) return base
  return base.replace(STATUS_QUO_TRAILING_PATTERN, '').trimEnd()
}

/**
 * Sanitize coaching text: strip arrow characters and encoding notation.
 * Single function for ALL coaching-facing text cleanup.
 * Use for any M1/M2 text surfaced in the coaching UI (next_actions, narrative snippets,
 * factor labels, Validate/Investigate titles, VOI block, option card descriptions).
 *
 * @param text - Raw coaching text from PLoT
 * @returns Cleaned text suitable for display
 */
export function sanitizeCoachingText(text: string): string {
  if (!text) return ''
  return stripEncodingNotation(
    text
      .replace(/\s*[\u2192]\s*/g, ' to ')   // Unicode right arrow →
      .replace(/\s*->\s*/g, ' to ')          // ASCII arrow ->
      .replace(/\s*\u2014\s*/g, ', ')        // Em dash — to comma
  ).trim()
}

export default cleanFactorLabel
