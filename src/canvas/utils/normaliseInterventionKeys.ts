/**
 * This list indexes an intervention map; order is not part of the model.
 * JSON persistence can reorder the map and its derived list independently.
 * Preserve membership, duplicates and every other field. Unknown shapes stay
 * untouched so this comparison never repairs malformed input into authority.
 */
export function normaliseInterventionKeys<T extends Record<string, unknown>>(node: T): T {
  const keys = node.interventionKeys
  if (!Array.isArray(keys) || !keys.every((key): key is string => typeof key === 'string')) {
    return node
  }
  return { ...node, interventionKeys: [...keys].sort() }
}
