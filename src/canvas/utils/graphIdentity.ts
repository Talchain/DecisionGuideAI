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
 * Parallel edges between the same ordered pair were not a canvas shape, so the
 * pair was a safe identity. The saved program model now draws a second link
 * between one pair under its own id (DET-HARM D225/D227), so the two merges
 * match links with `matchEdgesOneToOne` below: id first, then pair.
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

type CanvasEdgeIdentity = { id?: unknown; source?: unknown; target?: unknown }
type WireEdgeIdentity = { id?: unknown; from?: unknown; to?: unknown; source?: unknown; target?: unknown }

/**
 * ONE-TO-ONE LINK MATCHING (DET-HARM D225/D227, SPEC C13: the graph's links match the saved model). CEE's program
 * projection names a second link between one pair `from__to__2` (model-program/project.ts edgeId), so a pair can hold
 * two links and is no longer a link's identity on its own. A wire link stands for AT MOST ONE canvas link and a canvas
 * link for at most one wire link:
 *   1. exact matches are reserved first, indexed by PAIR AND ID, so a repeated id on another pair never hides a
 *      link's own same-pair counterpart; a repeated id within one pair is taken in wire order, once;
 *   2. each canvas link still unmatched then takes the first wire link left on its pair, in wire order (a link the
 *      canvas holds under a local id, e.g. `e-0`).
 * Both merges (`reconcileAppliedGraph`, `mergeServerGraphOnHydrate`) read this ONE mapping for removals, updates and
 * additions, so one wire link's data can never be stamped onto two canvas links. With at most one link per pair on
 * each side it matches exactly what the pair rule matched. Keyed by the canvas edge object.
 */
export function matchEdgesOneToOne<C extends CanvasEdgeIdentity, W extends WireEdgeIdentity>(
  canvasEdges: ReadonlyArray<C>,
  wireEdges: ReadonlyArray<W | null | undefined>,
): Map<C, W> {
  const matched = new Map<C, W>()
  const reserved = new Set<W>()
  // Exact candidates by pair AND id (NUL cannot occur in an id, as in `edgePairKey`); the first in wire order wins.
  const exactKey = (pair: string, id: string) => `${pair}${PAIR_SEPARATOR}${id}`
  const wireByPairAndId = new Map<string, W>()
  for (const w of wireEdges) {
    if (w == null || typeof w.id !== 'string' || w.id.length === 0) continue
    const pair = wireEdgePairKey(w)
    if (pair === null) continue
    const key = exactKey(pair, w.id)
    if (!wireByPairAndId.has(key)) wireByPairAndId.set(key, w)
  }
  for (const c of canvasEdges) {
    const pair = canvasEdgePairKey(c)
    if (pair === null || typeof c.id !== 'string') continue
    const w = wireByPairAndId.get(exactKey(pair, c.id))
    if (w === undefined || reserved.has(w)) continue
    matched.set(c, w)
    reserved.add(w)
  }
  const leftByPair = new Map<string, W[]>()
  for (const w of wireEdges) {
    if (w == null || reserved.has(w)) continue
    const key = wireEdgePairKey(w)
    if (key === null) continue
    const left = leftByPair.get(key)
    if (left) left.push(w)
    else leftByPair.set(key, [w])
  }
  for (const c of canvasEdges) {
    if (matched.has(c)) continue
    const key = canvasEdgePairKey(c)
    const w = key === null ? undefined : leftByPair.get(key)?.shift()
    if (w !== undefined) matched.set(c, w)
  }
  return matched
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
