/**
 * Stable ID Generation Utility
 *
 * Creates deterministic, collision-resistant IDs from string content.
 * Uses djb2 hash algorithm for fast, stable hashing.
 */

/**
 * djb2 hash algorithm - simple, fast, deterministic
 * Produces a 32-bit unsigned integer from a string
 */
function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return hash >>> 0 // Convert to unsigned 32-bit integer
}

/**
 * Generate a stable, deterministic ID from content parts
 *
 * @param prefix - ID prefix (e.g., 'readiness', 'validation')
 * @param parts - Content parts to hash (e.g., category, action, nodeIds)
 * @returns A stable ID like 'readiness-abc12def'
 *
 * @example
 * // Simple usage
 * stableId('readiness', 'factors', 'Add supporting evidence')
 * // Returns: 'readiness-7f3a2b1c'
 *
 * @example
 * // With node IDs for uniqueness
 * stableId('readiness', imp.category, imp.action, imp.affected_nodes?.join(','))
 * // Returns: 'readiness-8c4d3e2f'
 */
export function stableId(prefix: string, ...parts: (string | undefined | null)[]): string {
  // Filter out undefined/null and join with separator
  const content = parts.filter(Boolean).join('|')
  const hash = djb2Hash(content)
  // Convert to hex, take first 8 chars for readability
  const shortHash = hash.toString(16).padStart(8, '0')
  return `${prefix}-${shortHash}`
}

/**
 * Generate a stable improvement ID
 *
 * Creates collision-resistant IDs for readiness improvements
 * by hashing the full action text plus category.
 *
 * @param category - Improvement category (e.g., 'factors', 'evidence')
 * @param action - Full action description text
 * @param affectedNodes - Optional array of affected node IDs
 * @returns A stable ID like 'readiness-factors-7f3a2b1c'
 */
export function stableImprovementId(
  category: string,
  action: string,
  affectedNodes?: string[]
): string {
  const nodesPart = affectedNodes?.sort().join(',')
  return stableId('readiness', category, action, nodesPart)
}
