/**
 * SPIKE (UI restore, 11 Nov 2026): the one adapter from core's View to the previous canvas maps and carries, and invents nothing; a core
 * card on the previous frame leads with core's own words. Core's european golden (src/olumiView/golden/european.view.json) and the real
 * hosting board (fixtures/real/hosting.view3.json), both unedited; every assertion is bound by card id and core's exact words.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import type { View } from '../client'
import { legacyGraphOf, LIMIT_TIER } from '../coreViewToLegacy'
import { leadLineOf } from '../previous/CoreCard'
import { VIEW_LINK } from '../canvas'
import { cardLinks, drawnModelOf, QUESTION } from '../layout'
import { layoutGraph } from '../../canvas/utils/layout'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View
const hosting = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hosting.view3.json'), 'utf8')) as View
const model = view.model!, drawn = drawnModelOf(model)
const card = (id: string) => model.cards.find((c) => c.id === id)!

describe("core's View as the previous canvas's own nodes and edges", () => {
  const { nodes, edges } = legacyGraphOf(model)
  const node = (id: string) => nodes.find((n) => n.id === id)!
  const options = drawn.cards.filter((c) => c.family === 'option').map((c) => c.id)
  const links = edges.filter((e) => e.type === VIEW_LINK), roots = edges.filter((e) => e.type !== VIEW_LINK)

  it('one node for the question and one per drawn card: core\'s heading verbatim, the previous kind the lane draws it as, marked core\'s, and no value slot filled', () => {
    expect(nodes.map((n) => n.id)).toEqual([QUESTION, ...drawn.cards.map((c) => c.id)])
    expect(node(QUESTION).type).toBe('decision')
    expect(node(QUESTION).data.label).toBe(model.question.text)
    for (const c of drawn.cards) { expect(node(c.id).data.label, c.id).toBe(c.heading); expect(node(c.id).data.core, c.id).toBe(true) }
    expect(node('broader_entry').type).toBe('option')
    expect(node('reach_customer_target').type).toBe('goal')
    expect(node('customer_target').type).toBe('factor')
    for (const n of nodes) for (const slot of ['display_value', 'observedState', 'prior', 'interventions', 'probability', 'provenance', 'category'])
      expect(slot in n.data, `${n.id}.${slot}`).toBe(false)
  })

  it('RULING 2: a limit is the previous constraint kind and states its own row, between the consequences and the goal; no other card states a row', () => {
    for (const id of ['investment_limit', 'proposed_churn_guardrail']) {
      expect(card(id).family).toBe('limit')
      expect(node(id).type).toBe('constraint')
      expect(node(id).data.layoutTier).toBe(LIMIT_TIER)
    }
    expect(nodes.filter((n) => 'layoutTier' in n.data).map((n) => n.id).sort()).toEqual(['investment_limit', 'proposed_churn_guardrail'])
  })

  it('RULING 2, on the board: the previous layout puts each limit under the figure that measures it and above the goal, and no two limits overlap at the width they draw at', async () => {
    const sized = nodes.map((n): Node => ({ ...n, measured: { width: 248, height: 100 } }))
    const laid = await layoutGraph(sized, edges, { direction: 'DOWN', preserveLocked: false })
    const at = (id: string) => laid.nodes.find((n) => n.id === id)!.position
    expect(model.links.some((l) => l.from === 'churn_rate' && l.to === 'proposed_churn_guardrail' && l.title === 'measured by'), 'precondition').toBe(true)
    expect(at('proposed_churn_guardrail').y).toBeGreaterThan(at('churn_rate').y)
    expect(at('proposed_churn_guardrail').y).toBeGreaterThan(at('customers').y)
    expect(at('reach_customer_target').y).toBeGreaterThan(at('proposed_churn_guardrail').y)
    expect(at('investment_limit').y).toBe(at('proposed_churn_guardrail').y)
    const w = laid.layoutCardWidths.constraint!
    expect(Math.abs(at('investment_limit').x - at('proposed_churn_guardrail').x), 'the row leaves each limit its drawn width').toBeGreaterThanOrEqual(w)
    expect(laid.layoutCardWidths.factor, 'contrast: the factors keep their own row\'s width').not.toBeUndefined()
  })

  it('RULING 6: every drawn link is the lane\'s own link edge carrying core\'s link itself, between the same two cards; nothing about it is made up', () => {
    const own = cardLinks(drawn)
    expect(links.length, 'contrast: the golden has links').toBe(own.length)
    links.forEach((e, i) => { expect([e.source, e.target], e.id).toEqual([own[i]!.link.from, own[i]!.link.to]); expect((e.data as { link: unknown }).link).toBe(own[i]!.link) })
    for (const e of edges) for (const invented of ['weight', 'direction', 'effect_direction', 'beliefExists', 'beliefStrength', 'confidence', 'exists_probability', 'kind', 'functionType'])
      expect(invented in (e.data as object), `${e.id}.${invented}`).toBe(false)
  })

  it('RULING 1: each option is linked from the question, once, with no strength or sign; the contrast variant draws none and changes nothing else', () => {
    expect(options.length).toBe(3)
    expect(roots.map((e) => [e.source, e.target])).toEqual(options.map((o) => [QUESTION, o]))
    const bare = legacyGraphOf(model, false)
    expect(bare.edges.length).toBe(edges.length - 3)
    expect(bare.edges.some((e) => e.source === QUESTION && options.includes(e.target))).toBe(false)
    expect(bare.nodes).toEqual(nodes)
  })
})

describe('a core card on the previous frame leads with core\'s own words (RULINGS 3, 4, 7)', () => {
  const lead = (v: View, id: string) => leadLineOf(v.model!.cards.find((c) => c.id === id)!)
  it('an option: its chance of meeting the goal, core\'s words; where core withholds it, core\'s own first line saying so (never a blank, never a default)', () => {
    expect(card('broader_entry').headline!.text).toBe('about 41% chance')
    expect(lead(view, 'broader_entry')).toBe('about 41% chance')
    const withheld = hosting.model!.cards.find((c) => c.id === 'own_hosting')!
    expect(withheld.headline ?? null, 'precondition: the hosting option has no headline').toBeNull()
    expect(withheld.rows[0]).toMatchObject({ kind: 'none', text: 'cannot be worked out yet · Steady monthly revenue within a year' })
    expect(lead(hosting, 'own_hosting')).toBe('cannot be worked out yet · Steady monthly revenue within a year')
  })
  it('a figure card: its figure; an aim or a limit: its bound; a figure per option: no single line (its rows say each once)', () => {
    expect(lead(view, 'customer_target')).toBe('800 customers')
    expect(lead(view, 'reach_customer_target')).toBe(card('reach_customer_target').bound!.text)
    expect(lead(view, 'investment_limit')).toBe('at most £500,000')
    expect(card('customers').values!.length).toBeGreaterThan(1)
    expect(lead(view, 'customers')).toBeNull()
  })
  it('a card core gives no figure, bound or line: nothing is said for it', () => {
    const quiet = model.cards.filter((c) => c.family === 'assumption' && (c.face?.line ?? null) === null)
    expect(quiet.length, 'contrast: the golden has such a card').toBeGreaterThan(0)
    for (const c of quiet) expect(leadLineOf(c), c.id).toBeNull()
  })
})
