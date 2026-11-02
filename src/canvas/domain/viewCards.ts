/**
 * On the olumi-core lane a `viewCard` is drawn from core's View on every open: core holds the model, and a local copy of a card is
 * never the truth. So it is never kept: the autosave neither writes nor restores one, and a snapshot leaves it out instead of
 * failing the strict parse (`viewCard` is deliberately not a NodeType). Every edge that touches one goes with it. Off the lane the
 * graph comes back as it went in, the same arrays.
 *
 * Its own module, importing only the lane, so the autosave (store/scenarios) does not load the snapshot schemas to use it.
 */
import { isOlumiCoreLane } from '../../olumiCore/lane'

export function withoutViewCards<N, E>(nodes: N[], edges: E[]): { nodes: N[]; edges: E[] } {
  if (!isOlumiCoreLane()) return { nodes, edges }
  const cards = new Set((nodes as any[]).filter((n) => n?.type === 'viewCard').map((n) => n.id))
  if (cards.size === 0) return { nodes, edges }
  const touches = (e: any) => cards.has(e?.source ?? e?.from) || cards.has(e?.target ?? e?.to)
  return { nodes: nodes.filter((n: any) => !cards.has(n?.id)), edges: edges.filter((e) => !touches(e)) }
}
