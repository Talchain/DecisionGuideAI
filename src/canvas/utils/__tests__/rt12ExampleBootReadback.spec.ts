/**
 * RT-12, the reload class member (Canvas review of the Codex build, 5 Oct 2026). A canvas saved BEFORE the example was
 * pre-sized reloads onto the served example edge: the boot read acquires `strengthExampleFigure` the way it acquires
 * `naturalEffect` and the gate 5 labels, and that is NOT a changed model value — no undo entry, no pulse
 * (`mergeServerGraph` `comparableReadback`). The edge is Science's served example edge (`d1.patched.rt12.json`), bound by id.
 */
import { describe, expect, it } from 'vitest'
import example from '../../domain/__tests__/fixtures/d1.patched.rt12.json'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../applyDraftResult'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { useCanvasStore } from '../../store'
import { seedCanvas } from './__helpers__/mergeAppliedGraphHarness'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'

type WireEdge = Record<string, unknown> & { from: string; to: string; provenance: Record<string, unknown> }
const EDGE = (example.edges as unknown as WireEdge[]).find(
  (e) => e.from === 'enterprise_prospect_signing_likelihood' && e.to === 'quarterly_revenue',
)!
const { magnitude: _m, natural_effect: _ne, ...PRE_PATCH_PROVENANCE } = EDGE.provenance
const PRE_PATCH: WireEdge = { ...EDGE, provenance: PRE_PATCH_PROVENANCE }
const wireNode = (id: string) => (example.nodes as Array<Record<string, unknown>>).find((n) => n.id === id)!
const WIRE_NODES = [wireNode(EDGE.from), wireNode(EDGE.to)]
// The canvas copy as the real node hop writes it (the goal end is a GOAL, not a factor).
const NODES = WIRE_NODES.map((n, i) => ({ ...mapDraftNodeToCanvas(n as never, i) }))
const theEdge = (): any => useCanvasStore.getState().edges.find((e: any) => e.source === EDGE.from && e.target === EDGE.to)

describe('RT-12 reload: the boot read acquires the example label, and it is not an edit', () => {
  it('PRECONDITION: the served edge IS an example figure; the pre-patch copy is not', () => {
    expect(EDGE.provenance.magnitude).toBe('example_figure')
    expect(mapDraftEdgeToCanvas({ ...EDGE } as never, 0).data.strengthExampleFigure).toBeDefined()
    expect(mapDraftEdgeToCanvas({ ...PRE_PATCH } as never, 0).data.strengthExampleFigure).toBeUndefined()
  })

  it('a canvas saved before the patch, reloaded onto the example edge: label acquired, no undo entry', () => {
    seedCanvas(NODES, [mapDraftEdgeToCanvas({ ...PRE_PATCH } as never, 0)])
    const result = mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [{ ...EDGE }] })
    expect(result.accepted).toBe(true)
    expect(theEdge().data.strengthExampleFigure).toBeDefined()
    expect(edgeSizePhrase(theEdge().data)?.exampleFigure).toBe(true)
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
  })

  it('CONTROL: the same reload onto an unchanged edge is not an edit either (the harness itself pushes no history)', () => {
    seedCanvas(NODES, [mapDraftEdgeToCanvas({ ...EDGE } as never, 0)])
    mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [{ ...EDGE }] })
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
  })
})
