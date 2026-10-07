/**
 * S-DEF (Science 393023, DL P0, 7 Oct; CEE #2739 ← #2665): a VALIDATED definition is held at 1.0 whoever drew it, and the
 * canvas shows the existence the Run uses. SERVED graph: Wave B9 T1b, staging guest, CEE df15c8c1 + UI 19e4dd53, read after
 * Run 1 (`fixtures/waveB9-t1b-df15c8c-graph.json`, graph verbatim). There "Starter-tier monthly recurring revenue" →
 * "monthly recurring revenue" is `definitional: true` (£1 per £1) drawn by Olumi, stored at existence 0.8, and the inspector
 * said "By definition, this connection always exists" beside a "Likely to exist" slider. Twins written by the author are
 * labelled.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { normalisePersistedGraph } from '../../utils/normalisePersistedGraph'
import { overlayEdge, replaceEdgeFromWire } from '../../utils/mergeAppliedGraph'
import { applyAutoApplyPatch } from '../../conversation/utils/applyPatch'
import { useCanvasStore } from '../../store'
import { resolveEdgeValueDisplay } from '../edgeValueProvenance'
import { definitionUnitsMatch, isHeldUserLink, linkEndsOf, NO_LINK_ENDS } from '../heldUserLink'

type Rec = Record<string, any>
const SERVED = JSON.parse(readFileSync(resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/waveB9-t1b-df15c8c-graph.json'), 'utf8')) as { graph: Rec }
const graph = (): Rec => structuredClone(SERVED.graph)
const edgeOf = (g: Rec, from: string, to: string): Rec => g.edges.find((e: Rec) => e.from === from && e.to === to)
const IDENTITY = ['starter_tier_monthly_recurring_revenue', 'monthly_recurring_revenue'] as const
const CAUSAL = ['starter_subscribers', 'starter_tier_monthly_recurring_revenue'] as const
const heldOf = (data: unknown): unknown => (data as Rec | undefined)?.existenceHeld

describe('S-DEF: the served identity is held at 1.0 on the canvas, as on the Run', () => {
  it('PRECONDITION (served): Olumi drew the identity, flagged definitional, stored at 0.8', () => {
    const e = edgeOf(graph(), ...IDENTITY)
    expect(e.provenance).toMatchObject({ source: 'cee_hypothesis', definitional: true, natural_effect: { amount: 1, amount_unit: '£/month', per_source_change: 1, per_source_change_unit: '£/month' } })
    expect(e.exists_probability).toBe(0.8)
    expect(linkEndsOf(graph().nodes)(e)).toMatchObject({ fromLabel: 'Starter-tier monthly recurring revenue', toLabel: 'monthly recurring revenue', toUnit: '£/month' })
  })

  it('RED at base: ingestion with the graph\'s ends stamps the hold; the display reads 1', () => {
    const g = graph()
    const e = edgeOf(g, ...IDENTITY)
    const data = mapDraftEdgeToCanvas(e, 0, linkEndsOf(g.nodes)(e)).data as Rec
    expect(data.existenceHeld).toBe(true)
    expect(data.existenceHeldByDefinition).toBe(true)
    expect(resolveEdgeValueDisplay(data, 'beliefExists')).toEqual({ show: true, value: 1, source: 'cee' })
    expect(data.exists_probability).toBe(0.8)
  })

  it('CONTROL (same graph): the causal link into the part keeps Olumi\'s 0.8', () => {
    const g = graph()
    const e = edgeOf(g, ...CAUSAL)
    const data = mapDraftEdgeToCanvas(e, 0, linkEndsOf(g.nodes)(e)).data as Rec
    expect(data).not.toHaveProperty('existenceHeld')
    expect(resolveEdgeValueDisplay(data, 'beliefExists')).toMatchObject({ show: true, value: 0.8 })
  })

  it('NO ENDS: without the graph nothing validates, so the hold is not stamped (why every hop passes them)', () => {
    expect(isHeldUserLink(edgeOf(graph(), ...IDENTITY), NO_LINK_ENDS)).toBe(false)
  })

  it('TWIN (author): the part relabelled "Pipeline value" fails validation → Olumi\'s doubt stays', () => {
    const g = graph()
    g.nodes.find((n: Rec) => n.id === IDENTITY[0]).label = 'Pipeline value'
    const e = edgeOf(g, ...IDENTITY)
    expect(isHeldUserLink(e, linkEndsOf(g.nodes)(e))).toBe(false)
  })

  it('TWIN (author): the total read per week fails validation → not held', () => {
    const g = graph()
    const total = g.nodes.find((n: Rec) => n.id === IDENTITY[1])
    total.observed_state = { ...total.observed_state, unit: '£/week' }
    total.goal_threshold_unit = '£/week'
    const e = edgeOf(g, ...IDENTITY)
    expect(isHeldUserLink(e, linkEndsOf(g.nodes)(e))).toBe(false)
  })
})

describe('S-DEF: every hop holds it the same way', () => {
  beforeEach(() => { useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: [], edges: [] } as never) })

  it('persisted graph (normalisePersistedGraph): the identity is held, the causal link is not', () => {
    const out = normalisePersistedGraph(graph())
    const find = (from: string, to: string) => out.edges.find((e) => e.source === from && e.target === to)
    expect(heldOf(find(...IDENTITY)?.data)).toBe(true)
    expect(heldOf(find(...CAUSAL)?.data)).toBeUndefined()
  })

  it('canvas nodes read the same ends as wire nodes (the patch hop reads the canvas)', () => {
    const g = graph()
    const e = edgeOf(g, ...IDENTITY)
    const canvasNodes = normalisePersistedGraph(g).nodes
    expect(linkEndsOf(canvasNodes)({ source: e.from, target: e.to })).toEqual(linkEndsOf(g.nodes)(e))
  })

  it('overlay (hydrate + receipt): with the ends the hold survives; WITHOUT them the server-absence rule would drop it', () => {
    const g = graph()
    const e = edgeOf(g, ...IDENTITY)
    const ends = linkEndsOf(g.nodes)(e)
    const canvasEdge = { id: 'x', source: e.from, target: e.to, type: 'styled', data: mapDraftEdgeToCanvas(e, 0, ends).data }
    expect(heldOf(overlayEdge(canvasEdge, e, { acquireServerStrengthOnNoop: true, ends }).data)).toBe(true)
    expect(heldOf(overlayEdge(canvasEdge, e, { acquireServerStrengthOnNoop: true }).data)).toBeUndefined()
    expect(heldOf(replaceEdgeFromWire(canvasEdge, e, ends).data)).toBe(true)
  })

  it('patch hop (applyAutoApplyPatch): the ends come from the patch\'s own new nodes over the canvas\'s', () => {
    const g = graph()
    const node = (id: string): Rec => g.nodes.find((n: Rec) => n.id === id)
    const e = edgeOf(g, ...IDENTITY)
    applyAutoApplyPatch({
      type: 'graph_patch', patch_id: 'p1', summary: 's',
      operations: [
        { op: 'add_node', target_id: IDENTITY[0], data: node(IDENTITY[0]) },
        { op: 'add_node', target_id: IDENTITY[1], data: node(IDENTITY[1]) },
        { op: 'add_edge', target_id: 'e-id', data: e },
      ],
    } as never)
    const added = useCanvasStore.getState().edges.find((x) => x.source === IDENTITY[0] && x.target === IDENTITY[1])
    expect(heldOf(added?.data)).toBe(true)
  })
})

describe('Codex r1 #2602: the ends are read as CEE reads them, and the hold says why', () => {
  beforeEach(() => { useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: [], edges: [] } as never) })
  const total = (g: Rec): Rec => g.nodes.find((n: Rec) => n.id === IDENTITY[1])

  it('P0 (wire node): a nested `data` never overrides the wire node\'s own unit; CONTROL: the own unit matching holds', () => {
    const g = graph()
    const t = total(g)
    t.observed_state = { ...t.observed_state, unit: '£/week' }
    t.goal_threshold_unit = '£/week'
    t.data = { label: 'monthly recurring revenue', unit: '£/month' }
    const e = edgeOf(g, ...IDENTITY)
    expect(isHeldUserLink(e, linkEndsOf(g.nodes)(e))).toBe(false)
    const c = graph()
    total(c).data = { label: 'MRR', unit: '£/week' }
    expect(isHeldUserLink(edgeOf(c, ...IDENTITY), linkEndsOf(c.nodes)(edgeOf(c, ...IDENTITY)))).toBe(true)
  })

  it('P0 (canvas node): the observed bundle is read camel-case first, as registration sends it; CONTROL: both month holds', () => {
    const g = graph()
    const nodes = normalisePersistedGraph(g).nodes.map((n: Rec) => n.id !== IDENTITY[1] ? n
      : { ...n, data: { ...n.data, goal_threshold_unit: undefined, observed_state: { unit: '£/month' }, observedState: { unit: '£/week' } } })
    const e = edgeOf(g, ...IDENTITY)
    const canvasEdge = { source: e.from, target: e.to }
    expect(isHeldUserLink(e, linkEndsOf(nodes)(canvasEdge))).toBe(false)
    const month = nodes.map((n: Rec) => n.id !== IDENTITY[1] ? n : { ...n, data: { ...n.data, observedState: { unit: '£/month' } } })
    expect(isHeldUserLink(e, linkEndsOf(month)(canvasEdge))).toBe(true)
  })

  it('P0 (patch hop): a same-patch relabel of the part is read; CONTROL: a relabel that keeps the words still holds', () => {
    const run = (label: string): unknown => {
      const g = graph()
      useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: normalisePersistedGraph({ nodes: g.nodes, edges: [] }).nodes, edges: [] } as never)
      applyAutoApplyPatch({
        type: 'graph_patch', patch_id: 'p2', summary: 's',
        operations: [
          { op: 'update_node', target_id: IDENTITY[0], data: { label } },
          { op: 'add_edge', target_id: 'e-id', data: edgeOf(g, ...IDENTITY) },
        ],
      } as never)
      return useCanvasStore.getState().edges.find((x) => x.source === IDENTITY[0] && x.target === IDENTITY[1])?.data
    }
    expect(heldOf(run('Pipeline value'))).toBeUndefined()
    expect(heldOf(run('Starter-tier MRR'))).toBe(true)
  })

  it('P1: a flagged link held only by the USER\'s range is held, but NOT by definition; CONTROL: the valid label is', () => {
    const g = graph()
    g.nodes.find((n: Rec) => n.id === IDENTITY[0]).label = 'Pipeline value'
    const e = edgeOf(g, ...IDENTITY)
    e.provenance = { ...e.provenance, source: 'brief_extraction', source_quote: 'between 0.5 and 1.5 per pound',
      natural_effect: { ...e.provenance.natural_effect, stated_range: { low: 0.5, high: 1.5, text: 'between 0.5 and 1.5', end: 'low' } } }
    const data = mapDraftEdgeToCanvas(e, 0, linkEndsOf(g.nodes)(e)).data as Rec
    expect(data.existenceHeld).toBe(true)
    expect(data).not.toHaveProperty('existenceHeldByDefinition')
    const c = graph()
    const ce = edgeOf(c, ...IDENTITY)
    ce.provenance = { ...e.provenance }
    expect((mapDraftEdgeToCanvas(ce, 0, linkEndsOf(c.nodes)(ce)).data as Rec).existenceHeldByDefinition).toBe(true)
  })
})

describe('S-DEF: the definition\'s unit test never says "same" where CEE says not', () => {
  it('£/GBP per month or year in "/", "per" or "a"; never "£per month", another period, a count or an empty unit', () => {
    expect(definitionUnitsMatch('£/month', 'GBP/month')).toBe(true)
    expect(definitionUnitsMatch('£ per month', 'GBP / month')).toBe(true)
    expect(definitionUnitsMatch('£/year', '£ a year')).toBe(true)
    expect(definitionUnitsMatch('£/month', '£per month')).toBe(false)
    expect(definitionUnitsMatch('£/month', '£/week')).toBe(false)
    expect(definitionUnitsMatch('£/month', 'subscribers')).toBe(false)
    expect(definitionUnitsMatch('£/month', '$/month')).toBe(false)
    expect(definitionUnitsMatch('', '')).toBe(false)
  })
})
