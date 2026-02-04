/**
 * Label Cleaning Utility
 *
 * Strips encoding notation from factor labels for cleaner display.
 * Task 7: Fix encoding leak in labels.
 *
 * Patterns stripped:
 * - (0/1), (0–1), (0-1)
 * - (0–1, relative scale), (0–1, share of £20k cap)
 * - (yes/no), (binary), (on/off), (true/false)
 * - Generic numeric ranges like (0-100), (0-10)
 */

export interface CleanedLabel {
  /** Cleaned label without encoding notation */
  label: string
  /** Optional qualifier extracted from the pattern (e.g., "Yes/No" for binary) */
  qualifier?: string
}

/**
 * Strip parenthetical encoding notation from a label.
 *
 * @param rawLabel - The raw label that may contain encoding patterns
 * @returns Object with cleaned label and optional qualifier
 *
 * @example
 * cleanFactorLabel("Tech Lead Hired (0/1)") // { label: "Tech Lead Hired", qualifier: "Yes/No" }
 * cleanFactorLabel("Budget (0–1, share of £20k cap)") // { label: "Budget", qualifier: undefined }
 * cleanFactorLabel("Market Size (0-100)") // { label: "Market Size", qualifier: undefined }
 */
export function cleanFactorLabel(rawLabel: string): CleanedLabel {
  if (!rawLabel || typeof rawLabel !== 'string') {
    return { label: rawLabel || '' }
  }

  // Patterns to strip from labels (in priority order)
  const patterns: Array<{
    pattern: RegExp
    qualifier?: string
    replace?: (match: string, ...groups: string[]) => string
  }> = [
    // Binary patterns - strip and add qualifier
    { pattern: /\s*\(0\/1\)\s*$/i, qualifier: 'Yes/No' },
    { pattern: /\s*\(0 or 1\)\s*$/i, qualifier: 'Yes/No' },
    { pattern: /\s*\(yes\/no\)\s*$/i, qualifier: 'Yes/No' },
    { pattern: /\s*\(binary\)\s*$/i, qualifier: 'Yes/No' },
    { pattern: /\s*\(on\/off\)\s*$/i, qualifier: 'On/Off' },
    { pattern: /\s*\(true\/false\)\s*$/i, qualifier: 'True/False' },
    // Range patterns with context - strip entirely
    { pattern: /\s*\(0[–-]1,?\s*relative scale\)\s*$/i },
    { pattern: /\s*\(0[–-]1,?\s*share of\s+[^)]+\)\s*$/i },
    // Simple range patterns - strip entirely
    { pattern: /\s*\(0[–-]1\)\s*$/i },
    { pattern: /\s*\(0[–-]100\)\s*$/i },
    { pattern: /\s*\(0[–-]10\)\s*$/i },
    { pattern: /\s*\(\d+[–-]\d+\)\s*$/i }, // Generic numeric range
  ]

  let cleanedLabel = rawLabel
  let qualifier: string | undefined

  for (const { pattern, qualifier: q, replace } of patterns) {
    if (pattern.test(cleanedLabel)) {
      if (replace) {
        cleanedLabel = cleanedLabel.replace(pattern, replace as never)
      } else {
        cleanedLabel = cleanedLabel.replace(pattern, '')
      }
      if (q) qualifier = q
      break // Only match first pattern
    }
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

export default cleanFactorLabel
