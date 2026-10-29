/**
 * TWO LINKS BETWEEN THE SAME TWO CARDS IN THE COMPLETE STORED MODEL (DET-HARM D225, D227; SPEC C13: the graph's links
 * match the saved model). CEE's program projection names a second link between one pair `from__to__2`
 * (model-program/project.ts edgeId). The qualitative journey's saved read, staging 29 Oct 2026, has 17 links and two of
 * them join `ads_before_fix` to `marketing_disruption`: one positive, in words; one whose direction is not known yet.
 * The canvas drew 16, because links were matched by their pair and the first won.
 *
 * On the complete stored model (`restoreReplace`) each wire link now stands for AT MOST ONE canvas link: exact ids are
 * reserved first, then the wire links left over are taken by pair, and removals, updates and additions read that one
 * mapping. The mixed-id case below is the review's blocking sequence for a pair fallback that could hand one wire link
 * to two canvas links. A legacy receipt reads the same mapping for its updates and removals, so it never stamps one
 * link's data onto two canvas links; its additions keep the pair rule (the contrasts). The reload path's twin is
 * mergeServerGraph.parallelLinks.spec.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { canvasEdgePairKey, wireEdgePairKey } from '../graphIdentity'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'
import SERVED from './fixtures/served-qualitative-parallel-links.a3c24d98.read.json'

type WireEdge = { id: string; from: string; to: string; effect_direction?: string }
const SERVED_EDGES = SERVED.graph.edges as WireEdge[]
const FIRST = 'ads_before_fix__marketing_disruption'
const SECOND = 'ads_before_fix__marketing_disruption__2'

const cardsOf = (nodes: ReadonlyArray<{ id: string; kind: string; label: string }>) =>
  nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: 200 * i, y: 0 }, data: { kind: n.kind, label: n.label } }))
const edges = () => useCanvasStore.getState().edges as Array<{ id: string; source: string; target: string; data: Record<string, unknown> }>
const between = (from: string, to: string) => edges().filter((e) => e.source === from && e.target === to)
const edgeById = (id: string) => edges().find((e) => e.id === id)

describe('the real qualitative read: both links between one pair are drawn, each as its own link', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    seedCanvas(cardsOf(SERVED.graph.nodes), [])
  })

  it('draws all 17 saved links, the two parallel ones under their own ids and with their own directions', () => {
    const result = reconcileAppliedGraph({ graph: SERVED.graph } as never, { restoreReplace: true })
    expect(result).toEqual(counts({ addedEdgeCount: 17 }))
    expect(edges().map((e) => e.id).sort()).toEqual(SERVED_EDGES.map((e) => e.id).sort())
    expect(between('ads_before_fix', 'marketing_disruption').map((e) => e.id)).toEqual([FIRST, SECOND])
    // The first is stated positive; the second states no direction (its words say "not known yet").
    expect(edgeById(FIRST)?.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
    expect(edgeById(SECOND)?.data.directionSource).toBeUndefined()
  })

  it('adds the lost link to the 16 the canvas drew, and moves nothing else', () => {
    // Tonight's staging state: the canvas holds the 16 the pair rule drew, and CEE has acknowledged their pairs.
    const drawn = SERVED_EDGES.filter((e) => e.id !== SECOND)
    seedCanvas(cardsOf(SERVED.graph.nodes), drawn.map((e, i) => mapDraftEdgeToCanvas(e, i)))
    useCanvasStore.setState({
      lastAuthoritativeGraph: {
        nodeIds: SERVED.graph.nodes.map((n) => n.id),
        edgePairs: drawn.map((e) => wireEdgePairKey(e) as string),
      },
    } as never)
    const result = reconcileAppliedGraph({ graph: SERVED.graph } as never, { restoreReplace: true })
    expect(result).toEqual(counts({ addedEdgeCount: 1 }))
    expect(edges()).toHaveLength(17)
    expect(between('ads_before_fix', 'marketing_disruption').map((e) => e.id)).toEqual([FIRST, SECOND])
  })

  it('contrast: the same read as a legacy receipt keeps the pair rule (one link per pair, 16 drawn)', () => {
    reconcileAppliedGraph({ graph: SERVED.graph } as never)
    expect(edges()).toHaveLength(16)
    expect(between('ads_before_fix', 'marketing_disruption').map((e) => e.id)).toEqual([FIRST])
  })
})

describe('each wire link stands for at most one canvas link (the mixed-id review case)', () => {
  const NODES = [
    { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Sales' } },
    { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Added capacity' } },
  ]
  const WIRE_NODES = [
    { id: 'goal-1', kind: 'goal', label: 'Sales' },
    { id: 'factor-1', kind: 'factor', label: 'Added capacity' },
  ]
  const a = { id: 'factor-1__goal-1', from: 'factor-1', to: 'goal-1', effect_direction: 'positive' }
  const b = { id: 'factor-1__goal-1__2', from: 'factor-1', to: 'goal-1' }
  const restore = (wireEdges: unknown[]) =>
    reconcileAppliedGraph({ graph: { nodes: WIRE_NODES, edges: wireEdges } } as never, { restoreReplace: true })
  const pairIds = () => between('factor-1', 'goal-1').map((e) => e.id)

  beforeEach(() => {
    useCanvasStore.getState().reset()
    seedCanvas(NODES, [])
  })

  it('a local link takes the first wire link; restoring only that link then removes the sibling', () => {
    seedCanvas(NODES, [{ id: 'e-0', source: 'factor-1', target: 'goal-1', type: 'styled', data: { weight: 0.5 } }])
    // Restore a and b: the local link stands for a (never doubled), and b is drawn as its own link.
    expect(restore([a, b])).toEqual(counts({ addedEdgeCount: 1, updatedEdgeCount: 1 }))
    expect(pairIds()).toEqual(['e-0', b.id])
    // Restore only a: exactly one canvas link stands for a, and the sibling is removed.
    expect(restore([a])).toEqual(counts({ removedEdgeCount: 1 }))
    expect(pairIds()).toEqual(['e-0'])
    expect(edgeById('e-0')?.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
  })

  it('removes the one parallel link the complete graph no longer carries, and keeps its sibling', () => {
    restore([a, b])
    expect(pairIds()).toEqual([a.id, b.id])
    expect(restore([a])).toEqual(counts({ removedEdgeCount: 1 }))
    expect(pairIds()).toEqual([a.id])
  })

  it('a later complete graph updates each parallel link by its own id, whatever the wire order', () => {
    restore([a, b])
    const before = edgeById(a.id)
    // The second link's direction is now stated, and the wire lists it first. Only that link moves.
    expect(restore([{ ...b, effect_direction: 'negative' }, a])).toEqual(counts({ updatedEdgeCount: 1 }))
    expect(pairIds()).toEqual([a.id, b.id])
    expect(edgeById(a.id)).toBe(before)
    expect(edgeById(b.id)?.data).toMatchObject({ direction: 'negative', directionSource: 'cee' })
  })

  it('a legacy receipt after a complete graph updates each parallel link by its own id: b keeps its negative direction', () => {
    const bNegative = { ...b, effect_direction: 'negative' }
    restore([a, bNegative])
    expect(reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [a, bNegative] } as never)).toEqual(counts())
    expect(pairIds()).toEqual([a.id, b.id])
    expect(edgeById(a.id)?.data).toMatchObject({ direction: 'positive' })
    expect(edgeById(b.id)?.data).toMatchObject({ direction: 'negative', directionSource: 'cee' })
  })

  it('a legacy receipt that no longer carries one parallel link removes it, and never stamps its sibling onto it', () => {
    restore([a, { ...b, effect_direction: 'negative' }])
    expect(reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [a] } as never)).toEqual(counts({ removedEdgeCount: 1 }))
    expect(pairIds()).toEqual([a.id])
  })

  it('contrast: a legacy receipt still keeps one link per pair, and that link is not removed by its sibling', () => {
    useCanvasStore.setState({ lastAuthoritativeGraph: { nodeIds: ['goal-1', 'factor-1'], edgePairs: [] } } as never)
    expect(reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [a, b] } as never)).toEqual(counts({ addedEdgeCount: 1 }))
    expect(pairIds()).toEqual([a.id])
    expect(reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [b] } as never)).toEqual(counts({ updatedEdgeCount: 0 }))
    expect(pairIds()).toEqual([a.id])
    expect(canvasEdgePairKey(edgeById(a.id) as never)).toBe(wireEdgePairKey(b))
  })
})
