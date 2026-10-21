/**
 * The "Trade-offs" key card: the list is edited by editing the model. Picking a route opens its links, each with the
 * link's OWN editor (`openEdgeStrengthEditor`, bound by the link's id); the option stepper moves the lens's own pick.
 */
import { describe, it, afterEach, beforeEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup, within, act } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'
import { TradeOffsKey } from '../TradeOffsKey'
import { useLensFilter } from '../../hooks/useLensFilter'
import { setViewerScenario, __resetViewerModeForTests } from '../../../lib/viewerMode'

const opened: string[] = []
vi.mock('../../utils/openEdgeStrengthEditor', () => ({ openEdgeStrengthEditor: (id: string) => { opened.push(id); return true } }))

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const link = (from: string, to: string): Edge => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  return { id: `${from}>${to}`, source: from, target: to, data: mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Record<string, unknown> }
}
const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })

beforeEach(() => {
  opened.length = 0
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
    currentScenarioId: 'trade-offs-test',
    lastServerGraphHash: null,
    goalConstraints: null,
    servedBaselineOptions: [],
  } as never)
  useCanvasStore.getState().setLens('tradeoffs')
})
afterEach(() => { cleanup(); __resetViewerModeForTests() })

describe('the Trade-offs key card', () => {
  it('groups one option’s routes by which way they move the goal, and a picked route’s link opens ITS editor', () => {
    useCanvasStore.setState({ edges: useCanvasStore.getState().edges.map((e) => e.id === 'pro_plan_price>monthly_new_pro_subscribers' ? { ...e, data: { ...e.data!, weightSource: 'user' } } : e) })
    const view = render(<TradeOffsKey />)
    assert.equal(view.getByTestId('trade-offs-key-option').textContent, 'Increase price to £59')
    const gains = view.getByTestId('trade-offs-key-group-gains')
    const givesUp = view.getByTestId('trade-offs-key-group-gives_up')
    assert.equal(within(gains).getByRole('heading').textContent, 'Moves MRR the way you want')
    assert.equal(within(givesUp).getAllByTestId('trade-offs-key-route').length, 1)
    // Pick the give-up route: its three links open, each bound to its own id.
    fireEvent.click(within(givesUp).getByTestId('trade-offs-key-route'))
    const links = view.getAllByTestId('trade-offs-key-link').map((li) => li.getAttribute('data-edge'))
    assert.deepEqual(links, ['pro_plan_price>monthly_new_pro_subscribers', 'monthly_new_pro_subscribers>pro_paying_subscribers', 'pro_paying_subscribers>mrr'])
    const firstLink = view.getAllByTestId('trade-offs-key-link')[0]
    assert.equal(within(firstLink).getByTestId('rests-on-figure').getAttribute('data-target'), links[0])
    assert.ok(within(firstLink).getByTestId('rests-on-figure-ask'))
    assert.ok(within(firstLink).getByTestId('rests-on-figure-show'))
    assert.equal(within(givesUp).getByTestId('trade-offs-key-route').textContent?.split('Rests on ')[1], '3 links: 1 with no figure yet, 1 Olumi estimate nobody has checked, 1 yours')
    fireEvent.click(within(firstLink).getByTestId('rests-on-figure-edit'))
    assert.deepEqual(opened, ['pro_plan_price>monthly_new_pro_subscribers'])
    // CONTRAST: nothing opens a link that is not on the picked route.
    assert.ok(!opened.includes('pro_plan_price>mrr'))
  })

  it('both lens readers react to the saved hash alone: stale means down, and no saved change means no route', () => {
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map((n) => n.id === 'p59'
        ? { ...n, data: { ...n.data, interventions: { pro_plan_price: { value: 0.2 } } } }
        : n.id === 'pro_plan_price' ? { ...n, data: { ...n.data, observedState: { value: 0.3 } } } : n),
      ceeAnalysisReady: { current_graph_hash: 'view', options: [{ id: 'p59', interventions: { pro_plan_price: { value: 0.4 } } }] },
      lastServerGraphHash: 'view',
    } as never)
    function Filter() { useLensFilter(); return null }
    const view = render(<><TradeOffsKey /><Filter /></>)
    const direct = () => view.getAllByTestId('trade-offs-key-route').find((r) => r.dataset.route === 'p59:pro_plan_price>pro_plan_price>mrr')!
    assert.ok(direct())
    assert.ok(within(view.getByTestId('trade-offs-key-group-gains')).getAllByTestId('trade-offs-key-route').includes(direct()))
    act(() => useCanvasStore.setState({ lastServerGraphHash: 'saved-after-edit' }))
    assert.ok(within(view.getByTestId('trade-offs-key-group-gives_up')).getAllByTestId('trade-offs-key-route').includes(direct()))
    assert.equal(direct().textContent, 'Pro plan pricefalls→MRRfallsRests on 1 link: 1 with no figure yet')
    act(() => useCanvasStore.setState({ lastServerGraphHash: 'view', nodes: useCanvasStore.getState().nodes.map((n) => n.id === 'p59'
      ? { ...n, data: { ...n.data, interventions: { pro_plan_price: { value: 0.3 } } } } : n) }))
    assert.equal(useCanvasStore.getState().lens._dimmedNodeIds.has('p54'), true)
    // Only the hash changes: both memoised readers must discard the old view.
    act(() => useCanvasStore.setState({ lastServerGraphHash: 'saved-no-change' }))
    assert.equal(view.queryAllByTestId('trade-offs-key-route').length, 0)
    assert.equal(useCanvasStore.getState().lens._dimmedNodeIds.size, 0)
  })

  it('a viewer can inspect a route but cannot edit its figures or send questions', () => {
    setViewerScenario('trade-offs-test')
    const view = render(<TradeOffsKey />)
    fireEvent.click(within(view.getByTestId('trade-offs-key-group-gives_up')).getByTestId('trade-offs-key-route'))
    assert.equal(view.queryAllByTestId('rests-on-figure-edit').length, 0)
    assert.equal(view.queryAllByTestId('rests-on-figure-ask').length, 0)
    assert.equal(view.queryByTestId('trade-offs-key-ask'), null)
    assert.equal(view.getAllByTestId('rests-on-figure-show').length, 3)
    assert.deepEqual(opened, [])
  })

  it('⭐ folded (step 4: legend first): the option, its stepper and one legend line; no route list until opened', () => {
    const view = render(<TradeOffsKey folded />)
    const key = view.getByTestId('trade-offs-key')
    assert.ok(key.hasAttribute('data-folded'))
    assert.equal(view.getByTestId('trade-offs-key-option').textContent, 'Increase price to £59')
    assert.equal(view.getByTestId('trade-offs-key-legend').textContent, 'In front: this option’s routes to MRR. Open the key to read each one.')
    assert.equal(view.queryByTestId('trade-offs-key-group-gains'), null)
    // The stepper still moves the lens's option pick, so the graph's emphasis follows it while folded.
    fireEvent.click(view.getByTestId('trade-offs-key-next'))
    assert.equal(useCanvasStore.getState().lens.selectedOptionId, 'p54')
  })

  it('⛔ folded, an option that changes nothing says so: never a legend for routes that are not there (A/B 21 Oct)', () => {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => n.id === 'p59' ? { ...n, data: { ...n.data, interventions: {} } } : n) } as never)
    const view = render(<TradeOffsKey folded />)
    assert.equal(view.getByTestId('trade-offs-key-empty').textContent, 'This option does not change anything in the model yet.')
    assert.equal(view.queryByTestId('trade-offs-key-legend'), null)
  })

  it('the stepper moves the lens’s own option pick, and the card follows it', () => {
    const view = render(<TradeOffsKey />)
    fireEvent.click(view.getByTestId('trade-offs-key-next'))
    assert.equal(useCanvasStore.getState().lens.selectedOptionId, 'p54')
    assert.equal(useCanvasStore.getState().lens.active, 'tradeoffs')
    assert.equal(view.getByTestId('trade-offs-key-option').textContent, 'Increase price to £54')
  })

  it('the risks and limits the model holds are listed whichever option is in view, each risk link with its own editor', () => {
    const view0 = render(<TradeOffsKey />)
    assert.equal(view0.queryByTestId('trade-offs-key-also'), null, 'CONTRAST: none in the model, none listed')
    cleanup()
    useCanvasStore.setState({
      nodes: [...useCanvasStore.getState().nodes, node('leadership_gap', 'risk', { label: 'Leadership gap' }), node('no_link_risk', 'risk', { label: 'Launch deadline pressure' })],
      edges: [...useCanvasStore.getState().edges, { ...link('pro_paying_subscribers', 'mrr'), id: 'leadership_gap>mrr', source: 'leadership_gap', target: 'mrr' }],
      goalConstraints: [{ constraint_id: 'spend:<=', node_id: 'mrr', label: 'Hiring spend', operator: '<=', value: 200000, unit: 'GBP' }],
    } as never)
    const view = render(<TradeOffsKey />)
    const also = view.getByTestId('trade-offs-key-also')
    assert.equal(within(also).getByRole('heading').textContent, 'Also in your model, whichever option')
    assert.deepEqual(within(also).getAllByTestId('trade-offs-key-link').map((li) => li.getAttribute('data-edge')), ['leadership_gap>mrr'])
    assert.equal(within(also).getByTestId('trade-offs-key-risk').textContent, 'Launch deadline pressure')
    assert.match(within(also).getByTestId('trade-offs-key-limit').textContent ?? '', /Hiring spend/)
    fireEvent.click(within(also).getByTestId('rests-on-figure-edit'))
    assert.deepEqual(opened, ['leadership_gap>mrr'])
    // The same list follows the other option: it is the model's, not an option's.
    fireEvent.click(view.getByTestId('trade-offs-key-next'))
    assert.ok(view.getByTestId('trade-offs-key-also'))
  })

  it('CONTRAST: a model with no goal says so and lists nothing', () => {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.filter((n) => n.type !== 'goal') } as never)
    const view = render(<TradeOffsKey />)
    assert.equal(view.getByTestId('trade-offs-key').textContent, 'Your model has no goal yet, so there is nothing to weigh the options against.')
    assert.equal(view.queryAllByTestId('trade-offs-key-route').length, 0)
  })
})
