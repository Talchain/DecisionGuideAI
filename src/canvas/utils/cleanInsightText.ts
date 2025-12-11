/**
 * Shared utility for cleaning insight/headline text
 *
 * Removes meaningless metrics from engine output that have no user meaning:
 * - "(X.XX units)" patterns
 * - "by X.XX units" patterns
 * - Converts "+X pts" to "+X%" for probability context
 *
 * @example
 * cleanInsightText("'Option A' outperforms 'Option B' by 1% (0.01 units)")
 * // Returns: "'Option A' outperforms 'Option B' by 1%"
 *
 * @example
 * cleanInsightText("Outcome improved by +50 pts")
 * // Returns: "Outcome improved by +50%"
 */
export function cleanInsightText(text: string | null | undefined): string | null {
  if (!text) return null

  return text
    // Remove "(X.XX units)" patterns - matches "(0.01 units)", "(1 unit)", etc.
    .replace(/\s*\(\d+\.?\d*\s*units?\)/gi, '')
    // Remove "by X.XX units" patterns - matches "by 0.01 units", "by 1 unit", etc.
    .replace(/\s+by\s+\d+\.?\d*\s*units?\b/gi, '')
    // Change "+X pts" or "-X pts" to "+X%" or "-X%" for probability context
    .replace(/([+-]?\d+)\s*pts?\b/gi, '$1%')
    // Clean up double spaces that may result from removals
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Escape special regex characters in a string
 * Used when building dynamic regex patterns from user-provided text
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Wrap option names in quotes for clarity in insight text
 * Makes comparisons like "A outperforms B" easier to parse
 *
 * @example
 * quoteOptionNames("Implement software outperforms Do nothing", ["Implement software", "Do nothing"])
 * // Returns: "'Implement software' outperforms 'Do nothing'"
 */
export function quoteOptionNames(text: string, optionLabels: string[]): string {
  if (!text || optionLabels.length === 0) return text

  let result = text
  // Sort by length descending to match longer labels first (prevents partial matches)
  const sortedLabels = [...optionLabels]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  for (const label of sortedLabels) {
    if (!label || label.length < 2) continue // Skip very short labels
    // Only quote if not already quoted
    // Use lookahead/lookbehind for word boundaries that work with special chars
    // Match label when preceded by start of string or whitespace (not quote)
    // and followed by end of string or whitespace (not quote)
    const escaped = escapeRegex(label)
    const unquoted = new RegExp(`(?<!')(?<=^|\\s)${escaped}(?=\\s|$)(?!')`, 'g')
    result = result.replace(unquoted, `'${label}'`)
  }
  return result
}
