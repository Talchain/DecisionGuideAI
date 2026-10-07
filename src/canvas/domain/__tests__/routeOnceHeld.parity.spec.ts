import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { routeOnceHeldEdges } from '../routeOnceHeld'
import { isHeldUserLink, linkEndsOf } from '../heldUserLink'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

// CEE #2755 (7a70be303053168cf3e785e64397440605573543) pins the same bytes. `held` is CEE's `heldLinkOf(e) !== null`:
// the base holds (user range, validated definition) AND route-once, so each row checks the whole held set the Run uses.
const FIXTURE_SHA256 = '7c050df497ef7ead9d145d8d38b14c92eb216d67a7b186fb57322b73d2d1ec51'
const bytes = readFileSync(resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/route-once-parity.json'))
type WireEdge = { from: string; to: string }
const rows = JSON.parse(String(bytes)) as Array<{
  name: string; graph: { nodes: unknown[]; edges: WireEdge[] }; held: string[]
}>

describe('route-once parity (shared with CEE)', () => {
  it('route-once parity fixture digest', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(FIXTURE_SHA256)
  })
  for (const row of rows) {
    it(`WIRE: ${row.name}`, () => {
      const held = routeOnceHeldEdges(row.graph.nodes, row.graph.edges)
      const endsOf = linkEndsOf(row.graph.nodes)
      expect(row.graph.edges.filter(e => held.has(e) || isHeldUserLink(e, endsOf(e))).map(e => `${e.from}->${e.to}`).sort()).toEqual(row.held)
    })
    it(`CANVAS ingestion: ${row.name}`, () => {
      const nodes = row.graph.nodes.map(mapDraftNodeToCanvas)
      const endsOf = linkEndsOf(row.graph.nodes)
      const edges = row.graph.edges.map((e, i) => mapDraftEdgeToCanvas(e, i, endsOf(e)))
      const held = routeOnceHeldEdges(nodes, edges)
      expect(edges.filter(e => held.has(e) || e.data.existenceHeld === true).map(e => `${e.source}->${e.target}`).sort()).toEqual(row.held)
      // Route-once is never stamped at ingestion.
      expect(edges.every(e => e.data.routeOnceHeld === undefined)).toBe(true)
    })
  }
})
