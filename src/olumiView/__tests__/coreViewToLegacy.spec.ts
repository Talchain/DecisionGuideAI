/**
 * SPIKE (UI restore, 11 Nov 2026): the one adapter from core's View to the previous canvas maps and carries, and invents nothing. Core's
 * european golden (src/olumiView/golden/european.view.json), unedited; every assertion is bound by card id and core's exact words.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { legacyGraphOf } from '../coreViewToLegacy'
import { drawnModelOf, QUESTION } from '../layout'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View
const model = view.model!, drawn = drawnModelOf(model)
const card = (id: string) => model.cards.find((c) => c.id === id)!

describe("core's View as the previous canvas's own nodes and edges", () => {
  const { nodes, edges } = legacyGraphOf(model)
  const node = (id: string) => nodes.find((n) => n.id === id)!

  it('one node for the question and one per drawn card, each with core\'s heading verbatim and the previous kind the lane draws it as', () => {
    expect(nodes.map((n) => n.id)).toEqual([QUESTION, ...drawn.cards.map((c) => c.id)])
    expect(node(QUESTION).type).toBe('decision')
    expect(node(QUESTION).data.label).toBe(model.question.text)
    for (const c of drawn.cards) expect(node(c.id).data.label, c.id).toBe(c.heading)
    expect(node('broader_entry').type).toBe('option')
    expect(node('reach_customer_target').type).toBe('goal')
    expect(node('customer_target').type).toBe('factor')
    expect(node('investment_limit').type, 'a limit is the previous constraint kind, which has no card of its own').toBe('constraint')
  })

  it('a figure card carries its own figure text, verbatim; a card with no figure, or one figure per option, carries none', () => {
    expect(card('customer_target').figure!.text).toBe('800 customers')
    expect(node('customer_target').data.display_value).toBe('800 customers')
    expect(node('investment_cap').data.display_value).toBe(card('investment_cap').figure!.text)
    expect(card('target_interpretation').figure, 'precondition: an assumption has no figure').toBeNull()
    expect('display_value' in node('target_interpretation').data).toBe(false)
    expect(card('customers').values!.length, 'precondition: a figure per option').toBeGreaterThan(1)
    expect('display_value' in node('customers').data).toBe(false)
    expect('display_value' in node('reach_customer_target').data, 'only the previous factor card has the slot').toBe(false)
  })

  it('every drawn link is one edge between the same two cards, and no strength, sign or belief is made up for it', () => {
    expect(edges.length, 'contrast: the golden has links').toBe(drawn.links.length)
    edges.forEach((e, i) => { expect([e.source, e.target], e.id).toEqual([drawn.links[i]!.from, drawn.links[i]!.to]) })
    for (const e of edges) for (const invented of ['weight', 'direction', 'effect_direction', 'beliefExists', 'beliefStrength', 'confidence', 'exists_probability', 'kind', 'functionType'])
      expect(invented in e.data!, `${e.id}.${invented}`).toBe(false)
    expect(edges.every((e) => e.data!.style === 'solid'), 'contrast: how the link is drawn is set').toBe(true)
  })

  it('no link from the question to an option unless the rooted variant is asked for, which adds exactly one per option and nothing else', () => {
    const options = drawn.cards.filter((c) => c.family === 'option').map((c) => c.id)
    expect(options.length).toBe(3)
    expect(edges.filter((e) => e.source === QUESTION && options.includes(e.target))).toEqual([])
    const rooted = legacyGraphOf(model, true)
    expect(rooted.edges.length).toBe(edges.length + 3)
    expect(rooted.edges.filter((e) => e.source === QUESTION).map((e) => e.target).sort()).toEqual([...options].sort())
    expect(rooted.nodes).toEqual(nodes)
  })
})
