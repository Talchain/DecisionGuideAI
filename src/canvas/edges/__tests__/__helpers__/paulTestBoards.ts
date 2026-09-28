/**
 * Paul's two real test boards (28 Sep 2026, `fixtures/paulTestBoards.2026-09-28.json`),
 * laid out by the repo's own `layoutGraph` (ELK + the semantic tier pipeline)
 * at the fixture's per-kind card heights, and turned into the card boxes the
 * edge route resolvers read — exactly as `StyledEdge` builds them.
 *
 * ⚠ NOT A `.spec.` FILE — the vitest include glob would collect it as a suite.
 */
import type { Edge, Node } from '@xyflow/react'
import boards from '../fixtures/paulTestBoards.2026-09-28.json'
import { layoutGraph } from '../../../utils/layout'
import { TIER_BY_KIND } from '../../../utils/nodeLayoutConstants'
import type { RouteBox } from '../../sameRowRoute'

export type BoardName = 'pa_vs_ai' | 'tech_lead'

interface RawNode { id: string; kind: string; label: string }
interface RawEdge { id: string; s: string; t: string; dir: 'positive' | 'negative'; m: number }

const FIXTURE = boards as unknown as {
  heightsByKind: Record<string, number>
  landingHandleOffsets: { sourceDy: number; targetDy: number }
  boards: Record<BoardName, { nodes: RawNode[]; edges: RawEdge[] }>
}

/** The handle offsets measured at the 1280-wide landing (label scale 1.64). */
export const LANDING_ENDS = FIXTURE.landingHandleOffsets

export interface LaidBoard {
  /** The laid-out nodes, `measured` set to the card size `BaseNode` draws. */
  nodes: Node[]
  /** Edges as xyflow holds them (`data.direction`, `data.weight`). */
  edges: Edge[]
  kindOf: (id: string) => string
  /** Every card, as the same-row resolver reads them. */
  routeBoxes: RouteBox[]
  /** Every card with its tier, as the layered-lead resolver reads them. */
  tieredBoxes: Array<RouteBox & { tier: number }>
  box: (id: string) => RouteBox
  centre: (id: string) => { x: number; y: number }
  raw: { nodes: RawNode[]; edges: RawEdge[] }
}

/** Structural links: decision → option and option → factor (`StyledEdge`'s own inference). */
export function isStructuralPair(srcKind: string, tgtKind: string): boolean {
  return (srcKind === 'decision' && tgtKind === 'option') || (srcKind === 'option' && tgtKind === 'factor')
}

export async function layOutBoard(name: BoardName): Promise<LaidBoard> {
  const raw = FIXTURE.boards[name]
  const heightOf = (kind: string) => FIXTURE.heightsByKind[kind]
  const nodes = raw.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: 248, height: heightOf(n.kind) },
  })) as unknown as Node[]
  const edges = raw.edges.map((e) => ({
    id: e.id,
    source: e.s,
    target: e.t,
    data: { direction: e.dir, weight: e.m },
  })) as Edge[]
  const out = await layoutGraph(nodes, edges, {})
  const laid = out.nodes.map((n) => {
    const kind = n.type as string
    return { ...n, measured: { width: out.layoutCardWidths[kind]!, height: heightOf(kind) } }
  }) as Node[]
  const byId = new Map(laid.map((n) => [n.id, n]))
  const kindOf = (id: string) => byId.get(id)!.type as string
  const routeBoxes: RouteBox[] = laid.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.measured!.width!,
    height: n.measured!.height!,
  }))
  const tieredBoxes = routeBoxes.map((b) => ({ ...b, tier: TIER_BY_KIND[kindOf(b.id)]! }))
  const box = (id: string) => routeBoxes.find((b) => b.id === id)!
  const centre = (id: string) => {
    const b = box(id)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  return { nodes: laid, edges, kindOf, routeBoxes, tieredBoxes, box, centre, raw }
}

/** Distance from `p` to the nearest point of a flattened polyline. */
export function distanceToPolyline(p: { x: number; y: number }, points: ReadonlyArray<{ x: number; y: number }>): number {
  let best = Infinity
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]
    const b = points[k]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const len2 = vx * vx + vy * vy
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0
    best = Math.min(best, Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)))
  }
  return best
}
