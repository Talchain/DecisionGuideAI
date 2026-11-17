/**
 * "Show in the workspace": which cards a reply is about (targets.ts). Real path: core's own Views as the repo holds them, read whole and
 * resolved by the one pure function the control calls. Every row is bound by card or record id and carries a contrast. A View marked
 * INVENTED is a real View with a named, minimal change, kept in the real View shape; no words in it are anyone's own.
 *
 *   golden s_ce285b3617bb   turn 14 names three cards; turn 12 names one record nothing draws and two records that sit behind BOTH
 *                           net_funding's badge (18 records) and add_angel_bridge's (6 records)
 *   j1 bookshop-v1 / -open  the same scenario with monthly_revenue's and newsletter's badges closed, then open: core's turn 4 names two
 *                           records behind monthly_revenue's badge; `reminded` sits behind both badges
 *   sc01 growth16           four relation cards the board draws as links
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { QUESTION, drawnModelOf, inputIdsOf, inputsFolded, layerEntries, linkCards, marksOf, type LayerId, type View } from '../deps'
import { activeLayerOf, layerFor, planShow, type BoardNow, type Next } from '../targets'

const read = (file: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView', file), 'utf8')) as View
const golden = read('golden/s_ce285b3617bb.view.json')
const closed = read('fixtures/j1/bookshop-v1.core-5d8a009b.view3.json')
const opened = read('fixtures/j1/bookshop-v1-open.core-5d8a009b.view3.json')
const growth = read('fixtures/sc01/growth16.core-5d8a009b.view3.json')

const nextOf = (view: View, turn: number): Next => view.chat.find((t) => t.id === turn)!.answer!.next
/** A reply's next step in the real shape, pointing at the ids given (the words are the real turn's own). */
const pointing = (base: Next, at: string | null, about: string[]): Next => ({ ...base, at, about })
const clone = (v: View): View => JSON.parse(JSON.stringify(v)) as View
const detailed = (view: View): BoardNow => ({ sid: view.id, level: 'working', inputsOpen: {} })
const simple = (view: View, open = false): BoardNow => ({ sid: view.id, level: 'simple', inputsOpen: open ? { [view.id]: true } : {} })
const badgeOf = (view: View, card: string) => view.model!.cards.find((c) => c.id === card)!.badge!

describe('T1 a reply that names cards on the board', () => {
  it('names exactly those cards, in core\'s order, and asks for nothing to be opened', () => {
    const next = nextOf(golden, 14)
    expect(next.about).toStrictEqual(['reported_cash_and_spend_basis', 'opening_cash', 'monthly_burn'])
    expect(planShow(golden, next, detailed(golden))).toStrictEqual({ cards: ['reported_cash_and_spend_basis', 'opening_cash', 'monthly_burn'], open: [], inputs: false })
  })
  it('contrast: another reply on the same View names other cards', () => {
    const plan = planShow(golden, pointing(nextOf(golden, 14), 'horizon', ['horizon', 'cash_survival']), detailed(golden))
    expect(plan).toStrictEqual({ cards: ['horizon', 'cash_survival'], open: [], inputs: false })
  })
  it('`at` leads and an id named twice is one card', () => {
    const plan = planShow(golden, pointing(nextOf(golden, 14), 'monthly_burn', ['opening_cash', 'monthly_burn', 'opening_cash']), detailed(golden))
    expect(plan!.cards).toStrictEqual(['monthly_burn', 'opening_cash'])
  })
})

describe('T2 a record behind several badges: which badge opens is a stated rule, never the first one found', () => {
  const next = nextOf(golden, 12)
  it('the fixture is what the rule is tested on: both records sit behind both badges, and net_funding comes first in the View', () => {
    expect(next.at).toBe('receipt_timing_gap')
    expect(next.about).toStrictEqual(['receipt_timing_gap', 'test_speed_bottleneck', 'angel_speed_hypothesis'])
    for (const host of ['net_funding', 'add_angel_bridge']) for (const r of ['test_speed_bottleneck', 'angel_speed_hypothesis']) expect(badgeOf(golden, host).records).toContain(r)
    expect(badgeOf(golden, 'net_funding').records).toHaveLength(18)
    expect(badgeOf(golden, 'add_angel_bridge').records).toHaveLength(6)
    const order = golden.model!.cards.map((c) => c.id)
    expect(order.indexOf('net_funding')).toBeLessThan(order.indexOf('add_angel_bridge'))
  })
  it('equal ids held: the badge that unfolds the fewest records opens (add_angel_bridge, 6, not net_funding, 18)', () => {
    const plan = planShow(golden, next, detailed(golden))!
    expect(plan.open).toStrictEqual([{ host: 'add_angel_bridge', records: badgeOf(golden, 'add_angel_bridge').records }])
    expect(plan.cards).toStrictEqual(['add_angel_bridge'])
    expect(plan.inputs).toBe(false)
  })
  it('INVENTED contrast: with net_funding\'s badge cut to three records, net_funding opens', () => {
    const v = clone(golden)
    badgeOf(v, 'net_funding').records = ['angel_speed_hypothesis', 'overhead_tradeoff', 'test_speed_bottleneck']
    const plan = planShow(v, next, detailed(v))!
    expect(plan.open).toStrictEqual([{ host: 'net_funding', records: ['angel_speed_hypothesis', 'overhead_tradeoff', 'test_speed_bottleneck'] }])
    expect(plan.cards).toStrictEqual(['net_funding'])
  })
  it('INVENTED contrast: equal ids and equal record counts: the first in the View\'s order opens (net_funding)', () => {
    const v = clone(golden)
    badgeOf(v, 'net_funding').records = [...badgeOf(v, 'add_angel_bridge').records]
    expect(planShow(v, next, detailed(v))!.open.map((b) => b.host)).toStrictEqual(['net_funding'])
  })
  it('INVENTED contrast: most ids held beats fewest records: a small badge holding one of the two loses to the larger badge holding both', () => {
    const v = clone(golden)
    badgeOf(v, 'add_angel_bridge').records = ['test_speed_bottleneck'] // 1 record, holds one of the two ids
    const plan = planShow(v, next, detailed(v))!
    expect(plan.open.map((b) => b.host)).toStrictEqual(['net_funding']) // 18 records, holds both
  })
  it('INVENTED contrast: where no one badge holds every id, the cover opens a second badge for the rest', () => {
    const v = clone(golden)
    badgeOf(v, 'net_funding').records = badgeOf(v, 'net_funding').records.filter((r) => r !== 'angel_speed_hypothesis' && r !== 'test_speed_bottleneck')
    badgeOf(v, 'add_angel_bridge').records = badgeOf(v, 'add_angel_bridge').records.filter((r) => r !== 'angel_speed_hypothesis')
    badgeOf(v, 'cash_survival').records = [...badgeOf(v, 'cash_survival').records, 'angel_speed_hypothesis']
    const plan = planShow(v, next, detailed(v))!
    expect(plan.open.map((b) => b.host)).toStrictEqual(['add_angel_bridge', 'cash_survival'])
    expect(plan.cards).toStrictEqual(['add_angel_bridge', 'cash_survival'])
  })
  it('real second case: `reminded` sits behind monthly_revenue\'s badge (5 records) and newsletter\'s (1): newsletter opens', () => {
    expect(badgeOf(closed, 'monthly_revenue').records).toContain('reminded')
    expect(badgeOf(closed, 'newsletter').records).toStrictEqual(['reminded'])
    const plan = planShow(closed, pointing(nextOf(closed, 4), null, ['reminded']), detailed(closed))!
    expect(plan.open).toStrictEqual([{ host: 'newsletter', records: ['reminded'] }])
    expect(plan.cards).toStrictEqual(['newsletter'])
  })
  it('a record nothing draws (a premise only) is no target and leaves no trace', () => {
    expect(golden.model!.cards.some((c) => c.id === 'receipt_timing_gap' || c.badge?.records.includes('receipt_timing_gap'))).toBe(false)
    expect(JSON.stringify(planShow(golden, next, detailed(golden)))).not.toContain('receipt_timing_gap')
    expect(planShow(golden, pointing(next, 'receipt_timing_gap', ['receipt_timing_gap']), detailed(golden))).toBeNull()
  })
})

describe('T3 resolved again after unfolding, from the View core then sends', () => {
  const next = nextOf(closed, 4)
  it('core\'s own reply (turn 4) names two records behind monthly_revenue\'s closed badge: that badge opens', () => {
    expect([next.at, next.about]).toStrictEqual(['visits', ['visits', 'spend_per_visit']])
    expect(planShow(closed, next, detailed(closed))).toStrictEqual({ cards: ['monthly_revenue'], open: [{ host: 'monthly_revenue', records: badgeOf(closed, 'monthly_revenue').records }], inputs: false })
  })
  it('on the View with that badge open the records ARE cards: they are the targets, and nothing more is asked for', () => {
    expect(badgeOf(opened, 'monthly_revenue').open).toBe(true)
    expect(planShow(opened, next, detailed(opened))).toStrictEqual({ cards: ['visits', 'spend_per_visit'], open: [], inputs: false })
  })
  it('INVENTED: a record still inside an OPEN badge (core did not draw it as a card) is shown on the card whose badge it is', () => {
    const v = clone(opened)
    v.model!.cards = v.model!.cards.filter((c) => c.id !== 'spend_per_visit')
    v.model!.links = v.model!.links.filter((l) => l.from !== 'spend_per_visit' && l.to !== 'spend_per_visit')
    expect(planShow(v, next, detailed(v))).toStrictEqual({ cards: ['visits', 'monthly_revenue'], open: [], inputs: false })
  })
  it('the question\'s own badge is a badge: its record opens the question', () => {
    const q = closed.model!.question.badge!
    expect(q.records).toContain('rival_chance')
    expect(planShow(closed, pointing(next, null, ['rival_chance']), detailed(closed))).toStrictEqual({ cards: [QUESTION], open: [{ host: QUESTION, records: q.records }], inputs: false })
  })
})

describe('T4 a relation the board draws as a link', () => {
  const base = nextOf(growth, 6)
  it('names the two cards the link joins, read as linkCards reads them', () => {
    expect(linkCards(growth.model!).has('i_adoption_pilot')).toBe(true)
    expect(planShow(growth, pointing(base, 'i_adoption_pilot', ['i_adoption_pilot']), detailed(growth))).toStrictEqual({ cards: ['cross_team_adoption', 'pilot_conversion'], open: [], inputs: false })
  })
  it('contrast: another link card names its own two ends', () => {
    expect(planShow(growth, pointing(base, null, ['i_pilot_arr']), detailed(growth))!.cards).toStrictEqual(['pilot_conversion', 'arr_2027'])
  })
  it('INVENTED contrast: with the link between its ends gone the relation stays a card, and the card is the target', () => {
    const v = clone(growth)
    v.model!.links = v.model!.links.filter((l) => !(l.kind !== 'reason' && ((l.from === 'cross_team_adoption' && l.to === 'pilot_conversion') || (l.from === 'pilot_conversion' && l.to === 'cross_team_adoption'))))
    expect(linkCards(v.model!).has('i_adoption_pilot')).toBe(false)
    expect(planShow(v, pointing(base, null, ['i_adoption_pilot']), detailed(v))!.cards).toStrictEqual(['i_adoption_pilot'])
  })
})

describe('T5 Simple\'s folded inputs', () => {
  /** INVENTED: the golden View with `horizon` (an input card) copied until Simple folds the inputs; the copies carry no links. */
  const many = (() => {
    const v = clone(golden)
    const seed = v.model!.cards.find((c) => c.id === 'horizon')!
    for (let i = 0; inputIdsOf(drawnModelOf(v.model!)).length < 15; i++) v.model!.cards.push({ ...(JSON.parse(JSON.stringify(seed)) as typeof seed), id: `invented_input_${i}`, badge: null })
    return v
  })()
  const next = pointing(nextOf(golden, 14), 'horizon', ['horizon', 'add_angel_bridge'])
  it('the fixture folds: 15 or more inputs, `horizon` among them, `add_angel_bridge` not', () => {
    const drawn = drawnModelOf(many.model!)
    expect(inputsFolded(many.id, drawn, {})).toBe(true)
    expect(inputIdsOf(drawn)).toContain('horizon')
    expect(inputIdsOf(drawn)).not.toContain('add_angel_bridge')
  })
  it('Simple, inputs not opened: the card is a target and the inputs must be opened', () => {
    expect(planShow(many, next, simple(many))).toStrictEqual({ cards: ['horizon', 'add_angel_bridge'], open: [], inputs: true })
  })
  it('contrast: the person has opened the inputs, or the level is Detailed: nothing to open', () => {
    expect(planShow(many, next, simple(many, true))!.inputs).toBe(false)
    expect(planShow(many, next, detailed(many))!.inputs).toBe(false)
  })
  it('contrast: a reply that names no input asks for no unfolding in Simple', () => {
    expect(planShow(many, pointing(next, null, ['add_angel_bridge']), simple(many))).toStrictEqual({ cards: ['add_angel_bridge'], open: [], inputs: false })
  })
  it('contrast: the golden View itself has too few inputs to fold', () => {
    expect(inputsFolded(golden.id, drawnModelOf(golden.model!), {})).toBe(false)
    expect(planShow(golden, next, simple(golden))!.inputs).toBe(false)
  })
})

describe('T6 a stale id', () => {
  const base = nextOf(golden, 14)
  it('an id no longer in the model is dropped and the live ones stay', () => {
    expect(planShow(golden, pointing(base, 'record_since_removed', ['record_since_removed', 'opening_cash']), detailed(golden))).toStrictEqual({ cards: ['opening_cash'], open: [], inputs: false })
  })
  it('a reply whose every id is stale has no plan: no control is drawn', () => {
    expect(planShow(golden, pointing(base, 'record_since_removed', ['record_since_removed', 'another_gone']), detailed(golden))).toBeNull()
  })
  it('no ids, no answer, no model, no View: no plan', () => {
    expect(planShow(golden, pointing(base, null, []), detailed(golden))).toBeNull()
    expect(planShow(golden, null, detailed(golden))).toBeNull()
    expect(planShow({ ...golden, model: null }, base, detailed(golden))).toBeNull()
    expect(planShow(null, base, detailed(golden))).toBeNull()
  })
})

describe('T7 an id core does not send this reader', () => {
  /** INVENTED: the reader's View as core would send it without `rival_sales`: the card and every link that touches it are absent. */
  const readers = (() => {
    const v = clone(opened)
    v.model!.cards = v.model!.cards.filter((c) => c.id !== 'rival_sales')
    v.model!.links = v.model!.links.filter((l) => l.from !== 'rival_sales' && l.to !== 'rival_sales')
    return v
  })()
  const next = pointing(nextOf(opened, 4), 'rival_sales', ['rival_sales', 'newsletter'])
  it('the pair differs by exactly that card', () => {
    const ids = (v: View) => v.model!.cards.map((c) => c.id)
    expect(ids(opened).filter((id) => !ids(readers).includes(id))).toStrictEqual(['rival_sales'])
    expect(ids(readers).filter((id) => !ids(opened).includes(id))).toStrictEqual([])
  })
  it('in the reader\'s View the card they are sent is the only target, and nothing of the plan names the other', () => {
    const plan = planShow(readers, next, detailed(readers))
    expect(plan).toStrictEqual({ cards: ['newsletter'], open: [], inputs: false })
    expect(JSON.stringify(plan)).not.toContain('rival_sales')
  })
  it('contrast: in a View that holds the card, the same reply names both', () => {
    expect(planShow(opened, next, detailed(opened))!.cards).toStrictEqual(['rival_sales', 'newsletter'])
  })
  it('a reply about that card alone has no plan in the reader\'s View: no control, so no hint that anything is there', () => {
    expect(planShow(readers, pointing(next, 'rival_sales', ['rival_sales']), detailed(readers))).toBeNull()
    expect(planShow(opened, pointing(next, 'rival_sales', ['rival_sales']), detailed(opened))).toStrictEqual({ cards: ['rival_sales'], open: [], inputs: false })
  })
})

describe('T8 the layer the cards are shown in', () => {
  const option: LayerId = 'option:add_angel_bridge'
  it('the fixture: the option layer sets cards outside its path back; Evidence quality sets none back', () => {
    const m = marksOf(golden, option)!
    expect(m.dim).toBe(true)
    expect(m.on.has('add_angel_bridge')).toBe(true)
    expect(m.on.has('continue_outreach')).toBe(false)
    expect(layerEntries(golden).map((e) => e.id)).toContain('evidence')
    expect(marksOf(golden, 'evidence')!.dim).toBe(false)
  })
  it('a layer that sets a target back gives way to the full model', () => {
    expect(layerFor(golden, option, ['add_angel_bridge', 'continue_outreach'])).toBe('full')
  })
  it('contrast: a layer every target stands out in is kept', () => {
    expect(layerFor(golden, option, ['add_angel_bridge'])).toBe(option)
  })
  it('contrast: a layer that sets nothing back is kept, and so is the full model', () => {
    expect(layerFor(golden, 'evidence', ['continue_outreach'])).toBe('evidence')
    expect(layerFor(golden, 'full', ['continue_outreach'])).toBe('full')
  })
  it('the question is never set back by a layer', () => {
    expect(layerFor(golden, option, [QUESTION, 'add_angel_bridge'])).toBe(option)
  })
  it('the layer that is really on: one chosen for another scenario, or one the View cannot fill, reads as the full model', () => {
    expect(activeLayerOf(golden, golden.id, { layer: option, sid: golden.id })).toBe(option)
    expect(activeLayerOf(golden, golden.id, { layer: option, sid: 's_another' })).toBe('full')
    expect(activeLayerOf(golden, golden.id, { layer: 'option:no_such_option', sid: golden.id })).toBe('full')
  })
})
