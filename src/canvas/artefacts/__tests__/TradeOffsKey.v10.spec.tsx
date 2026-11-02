/**
 * v10 (#/canvas2) Trade-offs: the options as one segmented control, a mark on each route that matches its colour on
 * the canvas, and the canvas drawing the picked option's routes by which way they push the goal with every other link
 * resting in grey. The current design (#/canvas) keeps its stepper and its strokes: each row below has its contrast.
 */
import { describe, it, afterEach, beforeEach } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'
import { TradeOffsKey } from '../TradeOffsKey'
import { useLensFilter } from '../../hooks/useLensFilter'
import { PresentationProvider } from '../../../presentation/v10'
import { v10TradeOffsStroke, type V10RouteDrawing } from '../../edges/v10TradeOffsStroke'
import { tradeOffRouteDrawing, type OptionTradeOffs } from '../tradeOffsModel'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const link = (from: string, to: string): Edge => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  return { id: `${from}>${to}`, source: from, target: to, data: mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Record<string, unknown> }
}
const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [
      node('keep', 'option', { is_baseline: true }),
      node('p59', 'option', { label: 'Increase price to £59', interventions: { pro_plan_price: { value: 0.295 } } }),
      node('p54', 'option', { label: 'Increase price to £54', interventions: { pro_plan_price: { value: 0.27 } } }),
      node('pro_plan_price', 'factor', { label: 'Pro plan price', observedState: { value: 0.245 } }),
      node('monthly_new_pro_subscribers', 'factor', { observedState: { value: 0.075 } }),
      node('pro_paying_subscribers', 'factor', { observedState: { value: 0.15 } }),
      node('mrr', 'goal', { label: 'MRR', goal_threshold_raw: 100000, goal_threshold_frame: 'level', observedState: { raw_value: 75000 } }),
    ],
    edges: [
      link('pro_plan_price', 'mrr'),
      link('pro_plan_price', 'monthly_new_pro_subscribers'),
      link('monthly_new_pro_subscribers', 'pro_paying_subscribers'),
      link('pro_paying_subscribers', 'mrr'),
    ],
    ceeAnalysisReady: null,
    currentScenarioId: 'trade-offs-v10-test',
    lastServerGraphHash: null,
    goalConstraints: null,
    servedBaselineOptions: [],
  } as never)
  useCanvasStore.getState().setLens('tradeoffs')
})
afterEach(() => cleanup())

const inV10 = (ui: React.ReactElement) => render(<MemoryRouter><PresentationProvider value="v10">{ui}</PresentationProvider></MemoryRouter>)
const inCurrent = (ui: React.ReactElement) => render(<MemoryRouter><PresentationProvider value="current">{ui}</PresentationProvider></MemoryRouter>)

describe('v10 Trade-offs key card', () => {
  it('shows the options as one segmented control; pressing one moves the lens pick and the card follows', () => {
    const view = inV10(<TradeOffsKey />)
    const picks = view.getAllByTestId('trade-offs-key-pick')
    assert.deepEqual(picks.map((b) => b.textContent), ['Increase price to £59', 'Increase price to £54'])
    assert.deepEqual(picks.map((b) => b.getAttribute('aria-pressed')), ['true', 'false'])
    assert.equal(view.queryByTestId('trade-offs-key-next'), null)
    fireEvent.click(picks[1])
    assert.equal(useCanvasStore.getState().lens.selectedOptionId, 'p54')
    assert.equal(view.getByTestId('trade-offs-key-option').textContent, 'Increase price to £54')
    assert.deepEqual(view.getAllByTestId('trade-offs-key-pick').map((b) => b.getAttribute('aria-pressed')), ['false', 'true'])
  })

  it('CONTRAST: the current design keeps its stepper and has no segmented control or route marks', () => {
    const view = inCurrent(<TradeOffsKey />)
    assert.ok(view.getByTestId('trade-offs-key-next'))
    assert.equal(view.queryByTestId('trade-offs-key-options'), null)
    assert.equal(view.queryAllByTestId('trade-offs-key-sign').length, 0)
    assert.equal(view.queryByTestId('trade-offs-key-swatches'), null)
  })

  it('marks each route with the sign its canvas colour carries, by the route’s own effect', () => {
    const view = inV10(<TradeOffsKey />)
    const gains = within(view.getByTestId('trade-offs-key-group-gains')).getAllByTestId('trade-offs-key-sign')
    const givesUp = within(view.getByTestId('trade-offs-key-group-gives_up')).getAllByTestId('trade-offs-key-sign')
    assert.ok(gains.length > 0 && givesUp.length > 0)
    assert.ok(gains.every((m) => m.dataset.effect === 'gains' && m.textContent?.startsWith('+')))
    assert.ok(givesUp.every((m) => m.dataset.effect === 'gives_up' && m.textContent?.startsWith('−')))
  })

  it('the legend names only what is drawn: both colours, and grey only when a link is left to rest', () => {
    const view = inV10(<TradeOffsKey folded />)
    // All four links sit on this option's routes, so no link rests in grey and "other links" is not named.
    assert.equal(view.getByTestId('trade-offs-key-swatches').textContent, 'helps reach the goalworks against it')
    cleanup()
    // CONTRAST: a link on none of the option's routes rests in grey, and the legend then names it.
    useCanvasStore.setState({
      nodes: [...useCanvasStore.getState().nodes, node('unrelated', 'factor')],
      edges: [...useCanvasStore.getState().edges, { id: 'unrelated>mrr', source: 'unrelated', target: 'mrr', data: { direction: 'positive' } }],
    } as never)
    const view2 = inV10(<TradeOffsKey folded />)
    assert.equal(view2.getByTestId('trade-offs-key-swatches').textContent, 'helps reach the goalworks against itother links')
  })

  it('never names "direction not set" or a colour no link wears: where the options disagree on every link, only the grey is named', () => {
    // p54 now LOWERS the price while p59 raises it: every link on p59's routes moves the goal the other way under p54.
    useCanvasStore.setState({
      nodes: [...useCanvasStore.getState().nodes.map((n) => n.id === 'p54' ? { ...n, data: { ...n.data, interventions: { pro_plan_price: { value: 0.2 } } } } : n), node('unrelated', 'factor')],
      edges: [...useCanvasStore.getState().edges, { id: 'unrelated>mrr', source: 'unrelated', target: 'mrr', data: { direction: 'positive' } }],
    } as never)
    const view = inV10(<TradeOffsKey folded />)
    assert.equal(view.getByTestId('trade-offs-key-swatches').textContent, 'other links')
  })

  it('an option that changes nothing gets no colour legend: its sentence says why, the card is not blank', () => {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => n.id === 'p59' ? { ...n, data: { ...n.data, interventions: {} } } : n) } as never)
    const view = inV10(<TradeOffsKey />)
    assert.equal(view.getByTestId('trade-offs-key-empty').textContent, 'This option does not change anything in the model yet.')
    assert.equal(view.queryByTestId('trade-offs-key-swatches'), null)
  })
})

const routeStep = (edgeId: string | null) => ({ nodeId: edgeId ?? 'f', label: edgeId ?? 'f', move: null, edgeId, link: null })
const optionWith = (optionId: string, routes: Array<{ effect: 'gains' | 'gives_up' | 'not_set'; edges: string[] }>): OptionTradeOffs => ({
  optionId, label: optionId, againstLabel: null, changes: 1,
  routes: routes.map((r, i) => ({ key: `${optionId}:${i}`, effect: r.effect, steps: [routeStep(null), ...r.edges.map(routeStep)] })),
})

describe('v10 Trade-offs on the canvas', () => {
  function Filter() { useLensFilter(); return null }
  const effectsFor = (picked: string) => {
    useCanvasStore.getState().setLens('full')
    render(<Filter />)
    act(() => useCanvasStore.getState().setLens('tradeoffs', picked))
    return useCanvasStore.getState().lens._routeEffects
  }

  it('hands the canvas a colour only for links whose sign every option agrees on; none for a link off the routes', () => {
    const effects = effectsFor('p59')
    assert.equal(effects.get('pro_plan_price>mrr'), 'gains')
    assert.equal(effects.get('pro_plan_price>monthly_new_pro_subscribers'), 'gives_up')
    assert.equal(effects.has('unrelated>mrr'), false)
    // CONTRAST: another lens clears them.
    act(() => useCanvasStore.getState().setLens('rests_on'))
    assert.equal(useCanvasStore.getState().lens._routeEffects.size, 0)
  })

  it('a link the options disagree on gets no colour (helps under one option, works against the goal under another)', () => {
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map((n) => n.id === 'p54' ? { ...n, data: { ...n.data, interventions: { pro_plan_price: { value: 0.2 } } } } : n),
    } as never)
    const effects = effectsFor('p59')
    assert.ok(effects.size > 0, 'precondition: the routes are still there, so the lens still rests the other links')
    assert.ok([...effects.values()].every((d) => d === 'none'), `every shared link is left uncoloured: ${JSON.stringify([...effects])}`)
  })

  it('a link shared by a helpful route and a harmful route is uncoloured, and so is one on a route with an undirected link', () => {
    const drawing = tradeOffRouteDrawing([optionWith('o', [
      { effect: 'gains', edges: ['shared', 'a'] },
      { effect: 'gives_up', edges: ['shared', 'b'] },
      { effect: 'not_set', edges: ['c'] },
      { effect: 'gains', edges: ['d'] },
    ])], optionWith('o', [
      { effect: 'gains', edges: ['shared', 'a'] },
      { effect: 'gives_up', edges: ['shared', 'b'] },
      { effect: 'not_set', edges: ['c'] },
      { effect: 'gains', edges: ['d'] },
    ]))
    assert.deepEqual(Object.fromEntries(drawing), { shared: 'none', a: 'gains', b: 'gives_up', c: 'none', d: 'gains' })
    // A sign held under one option only is not held under every option.
    const pickedOnly = optionWith('p', [{ effect: 'gains', edges: ['x'] }])
    const other = optionWith('q', [{ effect: 'gives_up', edges: ['x'] }])
    assert.equal(tradeOffRouteDrawing([pickedOnly, other], pickedOnly).get('x'), 'none')
    assert.equal(tradeOffRouteDrawing([pickedOnly], pickedOnly).get('x'), 'gains')
  })

  it('the stroke helper changes colour only: green, rose or grey; nothing for a mixed link, no routes, or a structural link', () => {
    const at = (drawing: V10RouteDrawing, structural = false) => v10TradeOffsStroke({ presentation: 'v10', lens: 'tradeoffs', drawing, structural })
    assert.deepEqual(at('gains'), { stroke: 'var(--edge-positive)' })
    assert.deepEqual(at('gives_up'), { stroke: 'var(--edge-negative)' })
    assert.deepEqual(at(null), { stroke: 'var(--edge-neutral)' })
    assert.equal(at('none'), null)
    assert.equal(at(undefined), null)
    assert.equal(at('gains', true), null)
    assert.equal(at(null, true), null)
    // No width, no dash and no opacity are in its vocabulary: widths show strength, dashes show doubt, nothing dims.
    assert.deepEqual(Object.keys(at(null) ?? {}), ['stroke'])
  })

  it('CONTRAST: the current design and every other lens draw as they always did', () => {
    for (const drawing of ['gains', 'gives_up', 'none', null, undefined] as const) {
      assert.equal(v10TradeOffsStroke({ presentation: 'current', lens: 'tradeoffs', drawing, structural: false }), null)
      assert.equal(v10TradeOffsStroke({ presentation: 'v10', lens: 'rests_on', drawing, structural: false }), null)
    }
  })
})
