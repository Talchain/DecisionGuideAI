/**
 * ⭐ THE CANVAS DRAWS THE PERSON'S MODEL (Paul's served test, 22 Oct 2026). Shaped like the defect, on a SYNTHETIC model:
 * the living model holds two outcomes the engine graph keeps as factors, risks the engine graph leaves out, and links
 * from those risks. Every assertion binds by id.
 */
import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { drawLivingModel, CHANCE_NEEDED_REASON, LIVING_ONLY_KEY, livingOnlyOf, notInCalculationWords } from '../livingModelCanvas'
import { livingOutcomeIdsOf, withLivingKinds } from '../livingKinds'
import { layoutGraph } from '../../utils/layout'

const at = (x: number, y: number) => ({ x, y })
/** The engine graph as the canvas holds it: kinds as CEE's mapper gave them, positions from a layout. */
const engineNodes = (): Node[] => [
  { id: 'dec', type: 'decision', position: at(400, 0), data: { label: 'Which supplier?', kind: 'decision' } },
  { id: 'opt_a', type: 'option', position: at(200, 200), data: { label: 'Local supplier', kind: 'option' } },
  { id: 'opt_b', type: 'option', position: at(600, 200), data: { label: 'Overseas supplier', kind: 'option' } },
  { id: 'unit_cost', type: 'factor', position: at(200, 400), data: { label: 'Unit cost', kind: 'factor' } },
  { id: 'orders', type: 'factor', position: at(500, 400), data: { label: 'Orders filled', kind: 'factor' } },
  { id: 'repeat', type: 'factor', position: at(800, 600), data: { label: 'Repeat customers', kind: 'factor' } },
  { id: 'flood', type: 'risk', position: at(500, 600), data: { label: 'Warehouse flood', kind: 'risk' } },
  { id: 'margin', type: 'goal', position: at(400, 800), data: { label: 'Margin', kind: 'goal' } },
]
const engineEdges = (): Edge[] => [
  { id: 'e1', source: 'unit_cost', target: 'orders' },
  { id: 'e2', source: 'orders', target: 'repeat' },
  { id: 'e3', source: 'repeat', target: 'margin' },
]
const graph = () => ({
  nodes: [], edges: [],
  living_model: {
    aims: [{ id: 'margin', text: 'Margin' }],
    options: [{ id: 'opt_a', label: 'Local supplier' }, { id: 'opt_b', label: 'Overseas supplier' }],
    factors: [
      { id: 'unit_cost', kind: 'factor', label: 'Unit cost' },
      { id: 'orders', kind: 'outcome', label: 'Orders filled' },
      { id: 'repeat', kind: 'outcome', label: 'Repeat customers' },
      { id: 'staff_hours', kind: 'factor', label: 'Staff hours' },
    ],
    risks: [
      { id: 'flood', label: 'Warehouse flood', occurrence: { low: 0.05, high: 0.05, estimate_by: null }, horizon_months: 6, horizon_by: null, source: 'olumi' },
      { id: 'port_strike', label: 'Port strike', occurrence: { low: 0.1, high: 0.4, estimate_by: null }, horizon_months: 1, horizon_by: null, source: 'olumi', mitigations: [] },
      { id: 'recall', label: 'Product recall', occurrence: { low: null, high: null, estimate_by: null }, horizon_months: null, horizon_by: null, source: 'user', mitigations: [] },
      { id: 'rival', label: 'A rival undercuts us', occurrence: { low: 0.2, high: 0.3, estimate_by: null }, horizon_months: 12, horizon_by: null, source: 'party', mitigations: [] },
    ],
    links: [
      { id: 'cost_orders', from: 'unit_cost', to: 'orders', effect: { sign: '-' } },
      { id: 'strike_orders', from: 'port_strike', to: 'orders', effect: { sign: '-' } },
      { id: 'recall_repeat', from: 'recall', to: 'repeat', effect: { sign: '-' } },
      { id: 'staff_orders', from: 'staff_hours', to: 'orders', effect: { sign: null } },
      { id: 'rival_to_other_aim', from: 'rival', to: 'market_share', effect: { sign: '-' } },
    ],
  },
})

const byId = (nodes: Node[]) => new Map(nodes.map((n) => [n.id, n]))

describe('drawLivingModel', () => {
  it('⭐ draws each living-model outcome as an outcome, keeping the engine node\'s id, data and position', () => {
    const engine = engineNodes()
    const drawn = byId(drawLivingModel(engine, engineEdges(), graph()).nodes)
    for (const id of ['orders', 'repeat']) {
      const before = engine.find((n) => n.id === id)!
      expect(drawn.get(id)!.type).toBe('outcome')
      expect(drawn.get(id)!.data).toBe(before.data)
      expect(drawn.get(id)!.position).toBe(before.position)
    }
    // Contrast: a plain factor stays a factor.
    expect(drawn.get('unit_cost')!.type).toBe('factor')
  })

  it('⭐ every engine id is drawn exactly once, and only an item the engine graph lacks is marked not in the calculation', () => {
    const drawn = drawLivingModel(engineNodes(), engineEdges(), graph()).nodes
    const ids = drawn.map((n) => n.id)
    for (const n of engineNodes()) expect(ids.filter((id) => id === n.id)).toHaveLength(1)
    const marked = drawn.filter((n) => livingOnlyOf(n.data) !== null).map((n) => n.id)
    expect(marked.sort()).toEqual(['port_strike', 'recall', 'rival', 'staff_hours'])
    // The engine's own risk keeps its card and carries no such line.
    expect(livingOnlyOf(byId(drawn).get('flood')!.data)).toBeNull()
  })

  it('⭐ a risk the engine graph leaves out is drawn as a risk with its status line, and its chance where whose it is is clear', () => {
    const drawn = byId(drawLivingModel(engineNodes(), engineEdges(), graph()).nodes)
    const strike = drawn.get('port_strike')!
    expect(strike.type).toBe('risk')
    expect(notInCalculationWords(livingOnlyOf(strike.data)!)).toBe('Not in the calculation yet')
    expect((strike.data as Record<string, unknown>).event_risk).toEqual({ version: 1, occurrence: { p_low: 0.1, p_high: 0.4, basis: 'olumi' }, horizon: { months: 1 } })
    const recall = drawn.get('recall')!
    expect(notInCalculationWords(livingOnlyOf(recall.data)!)).toBe(`Not in the calculation yet: ${CHANCE_NEEDED_REASON}`)
    expect((recall.data as Record<string, unknown>).event_risk).toBeUndefined()
    // Another party's chance is not shown under "you said".
    expect((drawn.get('rival')!.data as Record<string, unknown>).event_risk).toBeUndefined()
    expect(drawn.get('staff_hours')!.type).toBe('factor')
  })

  it('⛔ a drawn-only item takes no pointer input and cannot be selected, dragged, connected or deleted (it is not in the store)', () => {
    const drawn = byId(drawLivingModel(engineNodes(), engineEdges(), graph()).nodes)
    expect(drawn.get('port_strike')).toMatchObject({ selectable: false, draggable: false, connectable: false, deletable: false, style: { pointerEvents: 'none' } })
    expect(drawn.get('orders')!.selectable).toBeUndefined()
  })

  it('⭐ a risk is placed in the outcome row, right of its last card', () => {
    const drawn = byId(drawLivingModel(engineNodes(), engineEdges(), graph()).nodes)
    const strike = drawn.get('port_strike')!
    // The consequence row holds `flood` and `repeat` at y 600 (the engine graph's own risk and an outcome).
    expect(strike.position.y).toBe(600)
    expect(strike.position.x).toBeGreaterThan(800)
  })

  it('⭐ a signed link the engine graph lacks is drawn; an unsigned one, one into an undrawn aim, and an engine pair are not', () => {
    const edges = drawLivingModel(engineNodes(), engineEdges(), graph()).edges
    const added = edges.filter((e) => livingOnlyOf(e.data) !== null)
    expect(added.map((e) => [e.id, e.source, e.target, (e.data as Record<string, unknown>).direction])).toEqual([
      ['strike_orders', 'port_strike', 'orders', 'negative'],
      ['recall_repeat', 'recall', 'repeat', 'negative'],
    ])
    // `cost_orders` is the engine's e1 pair: drawn once, as the engine's edge.
    expect(edges.filter((e) => e.source === 'unit_cost' && e.target === 'orders').map((e) => e.id)).toEqual(['e1'])
  })

  it('⛔ no living model: the canvas draws exactly the engine graph, the same arrays', () => {
    const nodes = engineNodes(); const edges = engineEdges()
    const drawn = drawLivingModel(nodes, edges, { nodes: [], edges: [] })
    expect(drawn.nodes).toBe(nodes)
    expect(drawn.edges).toBe(edges)
    expect(nodes.some((n) => (n.data as Record<string, unknown>)[LIVING_ONLY_KEY] !== undefined)).toBe(false)
  })
})

describe('the layout lays the outcomes out as outcomes', () => {
  it('⭐ a factor the living model calls an outcome joins the outcome row, and the store gets the engine kind back', async () => {
    const ids = livingOutcomeIdsOf(graph())
    const laid = byId((await layoutGraph(engineNodes(), engineEdges(), { livingOutcomeIds: ids })).nodes)
    expect(laid.get('repeat')!.position.y).toBe(laid.get('flood')!.position.y)
    expect(laid.get('repeat')!.position.y).toBeGreaterThan(laid.get('unit_cost')!.position.y)
    expect(laid.get('repeat')!.type).toBe('factor')
    expect(laid.get('orders')!.type).toBe('factor')
    // Contrast: without the living model's kinds, it is laid out with the factors.
    const plain = byId((await layoutGraph(engineNodes(), engineEdges())).nodes)
    expect(plain.get('repeat')!.position.y).not.toBe(plain.get('flood')!.position.y)
  })

  it('withLivingKinds returns its input when no outcome is on the canvas', () => {
    const nodes = engineNodes()
    expect(withLivingKinds(nodes, new Set(['not_here']))).toBe(nodes)
  })
})
