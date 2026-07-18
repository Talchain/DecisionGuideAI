/**
 * graphIdentity — the single definition of "which element is this".
 *
 * B2 (Codex deep review, 2026-07-18). The reconciler and the store both need
 * to record and compare element identities across an authoritative CEE graph
 * and the local canvas. Node identity is the id. EDGE identity is the
 * endpoint PAIR, not the id: CEE mints composite ids
 * (`factor-1::goal-1::0`) while the draft mapper falls back to positional ids
 * (`e-0`), so the same edge routinely carries different ids on the two sides.
 * The existing dedupe in the reconciler already relied on the pair; this
 * module makes that the one definition rather than a format repeated at each
 * site (a repeated key format is a mirror, and mirrors drift).
 *
 * Parallel edges between the same ordered pair are not a supported canvas
 * shape, so the pair is a safe identity.
 */

/** NUL separator — cannot occur in an id, so the key is unambiguous. */
const PAIR_SEPARATOR = '\u0000'

/** Identity key for an edge, from its two endpoints. */
export function edgePairKey(source: string, target: string): string {
  return `${source}${PAIR_SEPARATOR}${target}`
}

/** Endpoint pair of a canvas edge (`source`/`target`). */
export function canvasEdgePairKey(e: {
  source?: unknown
  target?: unknown
}): string | null {
  const { source, target } = e
  if (typeof source !== 'string' || typeof target !== 'string') return null
  return edgePairKey(source, target)
}

/**
 * Endpoint pair of a WIRE edge. CEE emits `from`/`to`; some adapter shapes
 * carry `source`/`target`. Accept both — the reconciler is fed by more than
 * one producer.
 */
export function wireEdgePairKey(e: {
  from?: unknown
  to?: unknown
  source?: unknown
  target?: unknown
}): string | null {
  const from = e.from ?? e.source
  const to = e.to ?? e.target
  if (typeof from !== 'string' || typeof to !== 'string') return null
  return edgePairKey(from, to)
}

/** The identity snapshot stored as `lastAuthoritativeGraph`. */
export interface AuthoritativeGraphIdentity {
  nodeIds: string[]
  edgePairs: string[]
}

/**
 * Build an identity snapshot from a canvas-shaped graph (`source`/`target`
 * edges) — used when hydrating from the DB, whose contents are CEE's own view.
 */
export function identityFromCanvasGraph(
  nodes: ReadonlyArray<{ id?: unknown }> | undefined,
  edges: ReadonlyArray<{ source?: unknown; target?: unknown }> | undefined,
): AuthoritativeGraphIdentity {
  return {
    nodeIds: (nodes ?? [])
      .map((n) => n?.id)
      .filter((id): id is string => typeof id === 'string'),
    edgePairs: (edges ?? [])
      .map((e) => (e ? canvasEdgePairKey(e) : null))
      .filter((k): k is string => k !== null),
  }
}
