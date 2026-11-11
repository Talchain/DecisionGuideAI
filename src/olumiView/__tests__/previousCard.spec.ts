/**
 * UI restore, 11 Nov 2026 (Paul: "the previous UI plugged into the alpha data model"). The lane's own canvas draws core's View on the
 * previous product's card frame and layout: it maps and carries, and invents nothing; a core card on the previous frame leads with core's
 * own words. Core's european golden (src/olumiView/golden/european.view.json) and the real hosting board
 * (fixtures/real/hosting.view3.json), both unedited; every assertion is bound by card id and core's exact words.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { leadLineOf, leadTitleOf } from '../previous/CoreCard'
import { drawViewCanvas, ROOT_LINK, VIEW_CARD, VIEW_LINK, VIEW_QUESTION } from '../canvas'
import { cardLinks, causalPlaces, CARD_WIDTH, drawnModelOf, LIMIT_TIER, QUESTION } from '../layout'
import { useCanvasStore } from '../../canvas/store'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View
const hosting = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hosting.view3.json'), 'utf8')) as View
const model = view.model!, drawn = drawnModelOf(model)
const card = (id: string) => model.cards.find((c) => c.id === id)!

describe("core's View on the lane's own canvas, laid out by the previous product's layout", () => {
  const options = drawn.cards.filter((c) => c.family === 'option').map((c) => c.id)
  beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [] }) })
  const draw = async () => { drawViewCanvas(drawn, await causalPlaces(drawn, new Map())); return useCanvasStore.getState() }

  it('one node for the question and one per drawn card, each carrying core\'s own card (nothing copied out of it, no value slot of the previous model filled)', async () => {
    const { nodes } = await draw()
    expect(nodes.map((n) => n.id)).toEqual([QUESTION, ...drawn.cards.map((c) => c.id)])
    expect(nodes[0]!.type).toBe(VIEW_QUESTION)
    for (const c of drawn.cards) { const n = nodes.find((x) => x.id === c.id)!; expect(n.type, c.id).toBe(VIEW_CARD); expect((n.data as { card: unknown }).card, c.id).toBe(c) }
    for (const n of nodes) for (const slot of ['display_value', 'observedState', 'prior', 'interventions', 'probability', 'provenance', 'category'])
      expect(slot in (n.data as object), `${n.id}.${slot}`).toBe(false)
  })

  it('RULING 2, on the board: each limit stands in its own row, under the figure that measures it and above the goal, and no two limits overlap', async () => {
    expect(LIMIT_TIER).toBe(4)
    for (const id of ['investment_limit', 'proposed_churn_guardrail']) expect(card(id).family).toBe('limit')
    const places = await causalPlaces(drawn, new Map())
    const at = (id: string) => places.get(id)!
    expect(model.links.some((l) => l.from === 'churn_rate' && l.to === 'proposed_churn_guardrail' && l.title === 'measured by'), 'precondition').toBe(true)
    expect(at('proposed_churn_guardrail').y).toBeGreaterThan(at('churn_rate').y)
    expect(at('proposed_churn_guardrail').y).toBeGreaterThan(at('customers').y)
    expect(at('reach_customer_target').y).toBeGreaterThan(at('proposed_churn_guardrail').y)
    expect(at('investment_limit').y).toBe(at('proposed_churn_guardrail').y)
    expect(Math.abs(at('investment_limit').x - at('proposed_churn_guardrail').x), 'the row leaves each limit the width it draws at').toBeGreaterThanOrEqual(CARD_WIDTH)
    // Contrast: a figure card is NOT in the limits' row (so the row is the limits' own, not a row every card shares).
    expect(at('customer_target').y).not.toBe(at('investment_limit').y)
  })

  it('RULING 6: every link of core\'s is the lane\'s own link edge carrying core\'s link itself, between the same two cards; nothing about it is made up', async () => {
    const { edges } = await draw()
    const links = edges.filter((e) => e.type === VIEW_LINK), own = cardLinks(drawn)
    expect(links.length, 'contrast: the golden has links').toBe(own.length)
    expect(own.length).toBeGreaterThan(0)
    links.forEach((e, i) => { expect([e.source, e.target], e.id).toEqual([own[i]!.link.from, own[i]!.link.to]); expect((e.data as unknown as { link: unknown }).link).toBe(own[i]!.link) })
    for (const e of edges) for (const invented of ['weight', 'direction', 'effect_direction', 'beliefExists', 'beliefStrength', 'confidence', 'exists_probability', 'kind', 'functionType'])
      expect(invented in (e.data as object), `${e.id}.${invented}`).toBe(false)
  })

  it('RULING 1: each option is linked from the question, once, by a line that carries nothing (no strength, sign or word)', async () => {
    const { edges } = await draw()
    const roots = edges.filter((e) => e.type === ROOT_LINK)
    expect(options.length).toBe(3)
    expect(roots.map((e) => [e.source, e.target])).toEqual(options.map((o) => [QUESTION, o]))
    for (const e of roots) expect(e.data).toEqual({})
    expect(edges.length, 'and no other edge is added').toBe(roots.length + cardLinks(drawn).length)
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

describe('R12 / PL-100: the hover carries core\'s own title for the lead line, verbatim', () => {
  it('an option: its chance\'s own title; a figure: its figure\'s title; an aim: its bound\'s title; a card with none: null', () => {
    expect(leadTitleOf(card('broader_entry'))).toBe(card('broader_entry').headline!.title)
    expect(card('broader_entry').headline!.title, 'precondition: core sends a title').not.toBe('')
    expect(leadTitleOf(card('customer_target'))).toBe(card('customer_target').figure!.title)
    expect(leadTitleOf(card('reach_customer_target'))).toBe(card('reach_customer_target').bound!.title)
    expect(leadTitleOf(card('customers'))).toBeNull()
  })
})
