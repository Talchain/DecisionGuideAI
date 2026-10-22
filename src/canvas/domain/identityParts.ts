/**
 * A node's `nonlinear_identity` (CEE: the node is defined by its parts, e.g. takings = customers × spend), read once for
 * every surface that names its parts: the exact-link words and the goal card's worked-out "Today" line.
 */
const OPERATOR: Record<string, string> = { product: '×', sum: '+' }

/** Its operator symbol (null for an operation the UI cannot spell) and part ids; null when it is not an identity of 2+ parts. */
export function readIdentityParts(data: unknown): { readonly operator: string | null; readonly factorIds: readonly string[] } | null {
  const identity = (data as { nonlinear_identity?: unknown } | null | undefined)?.nonlinear_identity as
    { operation?: unknown; factor_ids?: unknown } | null | undefined
  const ids = identity?.factor_ids
  if (!Array.isArray(ids) || ids.length < 2 || !ids.every((id) => typeof id === 'string')) return null
  return { operator: typeof identity?.operation === 'string' ? OPERATOR[identity.operation] ?? null : null, factorIds: ids }
}
