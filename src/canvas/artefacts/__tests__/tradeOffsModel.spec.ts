/**
 * What each option gains and gives up, in this model: routes bound by IDENTITY (their links' ids), on served-shape link
 * data (the MRR draft's own edges through the canvas mapper), each with a contrast that flips or withholds it.
 */
import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import type { Edge, Node } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeDirectionDisplay } from '../../domain/edgeValueProvenance'
import { alsoInModelOf, goalWantsOf, tradeOffsOf, tradeOffsForState, type OptionTradeOffs } from '../tradeOffsModel'
import { ASSUMPTION_MAP_COPY, assumptionMapOf } from '../assumptionMapModel'
import { TRADE_OFFS_COPY } from '../TradeOffsKey'

type Data = Record<string, unknown>
type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
/** The draft's link, mapped exactly as the canvas maps it; its id is `from>to`. */
const link = (from: string, to: string, patch: (d: Data) => Data = (d) => d): Edge => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  assert.ok(i >= 0, `${from} → ${to} is in the fixture`)
  return { id: `${from}>${to}`, source: from, target: to, data: patch(mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Data) }
}
const node = (id: string, type: string, data: Data = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })

const GOAL_LEVEL = { goal_threshold_raw: 100000, goal_threshold_frame: 'level', observedState: { raw_value: 75000 } }
const factor = (id: string, value: number) => node(id, 'factor', { observedState: { value } })
const NODES = (goal: Data = GOAL_LEVEL, baseline: Data = {}): Node[] => [
  node('keep', 'option', { is_baseline: true, ...baseline }),
  node('p59', 'option', { interventions: { pro_plan_price: { value: 0.295 } } }),
  factor('pro_plan_price', 0.245),
  factor('monthly_new_pro_subscribers', 0.075),
  factor('pro_paying_subscribers', 0.15),
  factor('monthly_churn', 0.03),
  node('price_sensitivity', 'risk'),
  node('mrr', 'goal', goal),
]
const EDGES = (patch: Partial<Record<string, (d: Data) => Data>> = {}): Edge[] => [
  ['pro_plan_price', 'mrr'],
  ['pro_plan_price', 'monthly_new_pro_subscribers'],
  ['monthly_new_pro_subscribers', 'pro_paying_subscribers'],
  ['pro_paying_subscribers', 'mrr'],
  ['pro_plan_price', 'price_sensitivity'],
  ['price_sensitivity', 'monthly_churn'],
  ['monthly_churn', 'pro_paying_subscribers'],
].map(([f, t]) => link(f, t, patch[`${f}>${t}`]))

const DIRECT = 'pro_plan_price>mrr'
const VIA_NEW = 'pro_plan_price>monthly_new_pro_subscribers'
const VIA_CHURN = 'pro_plan_price>price_sensitivity'
const read = (nodes: Node[], edges: Edge[]): OptionTradeOffs => {
  const goal = nodes.find((n) => n.type === 'goal')!
  const out = tradeOffsOf({ nodes, edges, goalId: goal.id, goalWants: goalWantsOf(goal), isBaseline: (o) => o.data?.is_baseline === true })
  assert.deepEqual(out.map((o) => o.optionId), ['p59'], 'the baseline is never weighed against itself')
  return out[0]
}
/** Each route by its identity: the link it leaves the changed factor on, with its effect. */
const byFirstLink = (o: OptionTradeOffs) => Object.fromEntries(o.routes.map((r) => [r.steps[1]?.edgeId ?? '', r.effect]))

describe('what each option gains and gives up, in this model', () => {
  it('£59 raises the price: the direct route gains MRR; the routes through new subscribers and churn give it up', () => {
    // POSITIVE CONTROL: the served links carry a stated direction the gate shows.
    for (const e of EDGES()) assert.equal(resolveEdgeDirectionDisplay(e.data as Data).show, true, `${e.id} has a stated direction`)
    const o = read(NODES(), EDGES())
    assert.deepEqual(byFirstLink(o), { [DIRECT]: 'gains', [VIA_NEW]: 'gives_up', [VIA_CHURN]: 'gives_up' })
    const viaNew = o.routes.find((r) => r.steps.some((s) => s.edgeId === VIA_NEW))!
    assert.deepEqual(viaNew.steps.map((s) => [s.nodeId, s.move]), [
      ['pro_plan_price', 'up'], ['monthly_new_pro_subscribers', 'down'], ['pro_paying_subscribers', 'down'], ['mrr', 'down'],
    ])
    assert.equal(o.againstLabel, null, 'the baseline sets no price, so the reference is the factor’s value today')
  })

  it('a stale CEE target yields to the saved target by option/factor id; a fresh view keeps its target', () => {
    const nodes = NODES().map((n) => n.id === 'p59'
      ? { ...n, data: { ...n.data, interventions: { pro_plan_price: { value: 0.2 } } } }
      : n.id === 'pro_plan_price' ? factor(n.id, 0.3) : n)
    // Other option/factor values cannot supply this route's target, even when listed first.
    const ceeAnalysisReady = { current_graph_hash: 'view', options: [
      { id: 'other-option', interventions: { pro_plan_price: { value: 0.9 } } },
      { id: 'p59', interventions: { unrelated: { value: 0.8 }, pro_plan_price: { value: 0.4 } } },
    ] }
    for (const [lastServerGraphHash, effect, move] of [
      ['saved-after-edit', 'gives_up', 'down'], ['view', 'gains', 'up'],
    ] as const) {
      const read = tradeOffsForState({ nodes, edges: EDGES(), ceeAnalysisReady, lastServerGraphHash })
      const route = read.options.find((o) => o.optionId === 'p59')?.routes.find((r) => r.steps[1]?.edgeId === DIRECT)
      assert.ok(route)
      assert.equal(route.steps[0].nodeId, 'pro_plan_price')
      assert.equal(route.effect, effect, lastServerGraphHash)
      assert.deepEqual(route.steps.map((s) => [s.nodeId, s.move]), [['pro_plan_price', move], ['mrr', move]])
    }
  })

  it('CONTRAST: a goal held at or below its target flips every route, and a route only changes side with the goal', () => {
    const o = read(NODES({ ...GOAL_LEVEL, goal_direction: '<=' }), EDGES())
    assert.deepEqual(byFirstLink(o), { [DIRECT]: 'gives_up', [VIA_NEW]: 'gains', [VIA_CHURN]: 'gains' })
  })

  it('a link nobody set a direction on leaves its route unsorted, never guessed; the other routes keep their side', () => {
    const unstated = (d: Data) => { const { directionSource: _drop, ...rest } = d; return rest }
    const edges = EDGES({ [VIA_NEW]: unstated })
    assert.equal(resolveEdgeDirectionDisplay(edges.find((e) => e.id === VIA_NEW)!.data as Data).show, false, 'POSITIVE CONTROL: the gate hides it')
    const o = read(NODES(), edges)
    assert.deepEqual(byFirstLink(o), { [DIRECT]: 'gains', [VIA_NEW]: 'not_set', [VIA_CHURN]: 'gives_up' })
    const route = o.routes.find((r) => r.steps.some((s) => s.edgeId === VIA_NEW))!
    assert.deepEqual(route.steps.map((s) => s.move), ['up', null, null, null], 'nothing after the unstated link carries a move')
  })

  it('a link the user set and one Olumi estimated are shown apart, by the owner reader’s own columns', () => {
    const o = read(NODES(), EDGES({ [VIA_NEW]: (d) => ({ ...d, weightSource: 'user' }) }))
    const columnOf = (id: string) => o.routes.flatMap((r) => r.steps).find((s) => s.edgeId === id)?.link?.column
    assert.equal(columnOf(VIA_NEW), 'yours')
    assert.equal(columnOf('monthly_new_pro_subscribers>pro_paying_subscribers'), 'unchecked')
    // CONTRAST: unchanged, the same link is Olumi's estimate nobody has checked, never the user's.
    assert.equal(read(NODES(), EDGES()).routes.flatMap((r) => r.steps).find((s) => s.edgeId === VIA_NEW)?.link?.column, 'unchecked')
  })

  it('the option is read against the baseline option’s own target where it sets one (the card’s reference)', () => {
    const o = read(NODES(GOAL_LEVEL, { label: 'Keep current £49 price', interventions: { pro_plan_price: { value: 0.3 } } }), EDGES())
    assert.equal(o.againstLabel, 'Keep current £49 price')
    // 0.295 is BELOW the baseline's 0.3, so the price falls along every route and each side flips.
    assert.deepEqual(byFirstLink(o), { [DIRECT]: 'gives_up', [VIA_NEW]: 'gains', [VIA_CHURN]: 'gains' })
  })

  it('an option that leaves a factor where it stands has no route for it', () => {
    const nodes = NODES().map((n) => (n.id === 'p59' ? { ...n, data: { ...n.data, interventions: { pro_plan_price: { value: 0.245 } } } } : n))
    assert.deepEqual(read(nodes, EDGES()).routes, [])
    assert.equal(read(nodes, EDGES()).changes, 0, 'it changes nothing in the model yet')
    // CONTRAST: £59 moves the price, so it changes one factor.
    assert.equal(read(NODES(), EDGES()).changes, 1)
  })

  it('each link on a route carries its owner’s own item, with the source words the owner gives it', () => {
    const nodes = NODES()
    const edges = EDGES()
    const owner = assumptionMapOf(nodes, edges, 'mrr').items.find((i) => i.target.id === VIA_NEW)!
    const step = read(nodes, edges).routes.flatMap((r) => r.steps).find((s) => s.edgeId === VIA_NEW)!
    assert.deepEqual(step.link, owner)
    assert.notEqual(step.link?.source, ASSUMPTION_MAP_COPY.sourceNotRecorded, 'the real source, never a stand-in')
  })

  it('every risk and every goal limit the model holds is listed, by identity, whichever option is in view', () => {
    // A hiring-shaped model: risks that act on the goal with no option route to them, and a spend limit.
    const nodes: Node[] = [...NODES(), node('leadership_gap', 'risk', { label: 'Leadership gap' })]
    const edges: Edge[] = [...EDGES(), { ...link('price_sensitivity', 'monthly_churn'), id: 'leadership_gap>mrr', source: 'leadership_gap', target: 'mrr' }]
    const goalConstraints = [
      { constraint_id: 'spend:<=', node_id: 'mrr', label: 'Hiring spend', operator: '<=', value: 200000, unit: 'GBP' },
      { constraint_id: 'target-row', node_id: 'mrr', label: 'MRR', operator: '>=', value: 100000, role: 'goal_target' },
    ] as never
    const also = alsoInModelOf({ nodes, edges, goalConstraints }, 'mrr')
    assert.deepEqual(also.risks.map((r) => [r.id, r.links.map((l) => l.item.target.id)]), [
      ['price_sensitivity', ['price_sensitivity>monthly_churn']],
      ['leadership_gap', ['leadership_gap>mrr']],
    ])
    assert.deepEqual(also.limits.map((l) => l.id), ['spend:<='], 'the goal’s own target row is its target, not a limit')
    assert.match(also.limits[0].text, /Hiring spend/)
    // CONTRAST: a model with no risks and no limits lists nothing.
    const bare = alsoInModelOf({ nodes: nodes.filter((n) => n.type !== 'risk'), edges, goalConstraints: null }, 'mrr')
    assert.deepEqual([bare.risks, bare.limits], [[], []])
  })

  it('a goal with no stated target or comparator sorts nothing, whatever its name says', () => {
    const goal = node('mrr', 'goal', { label: 'Reduce churn and grow MRR' })
    assert.equal(goalWantsOf(goal), null)
    const o = read([...NODES().filter((n) => n.type !== 'goal'), goal], EDGES())
    assert.ok(o.routes.length > 0)
    assert.ok(o.routes.every((r) => r.effect === 'not_set'))
    // CONTRAST: a change target says its direction by its sign.
    assert.equal(goalWantsOf(node('g', 'goal', { goal_threshold_raw: -0.15, goal_threshold_frame: 'change_rel' })), 'lower')
    assert.equal(goalWantsOf(node('g', 'goal', GOAL_LEVEL)), 'higher')
  })

  it('the key’s words never rank, recommend or name a winner', () => {
    const words = JSON.stringify(TRADE_OFFS_COPY, (_k, v) => (typeof v === 'function' ? String(v('MRR', 2)) + String(v(1)) : v))
    assert.doesNotMatch(words, /\b(best|better|recommend\w*|winner|leads?|should|top)\b/i)
    assert.match(words, /not which option to choose/, 'POSITIVE CONTROL: the note is in the scan')
  })
})
