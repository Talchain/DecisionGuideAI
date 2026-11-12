/**
 * The journey layer's pure judgements (olumiView/journey.ts), on core's own served Views (fixtures/real, fixtures/v11: core output, not
 * written here): which lines stand or fall together, what a set of ticks approves and leaves out, when a direct edit may be made and why
 * not, and who a card is by. The acts themselves run against a real core in olumiCore/__tests__/actionLayer.journey.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { authorshipOf, editGateOf, groupTicked, lineKey, partnersOf, picksOf, setGroup, tickEvery, toggleLine, verdictOf } from '../journey'

const read = (f: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8'))
const consulting = read('v11/consulting-proposal.view3.json'), together = read('real/together.view3.json'), hosting = read('real/hosting.view3.json')
const ids = (cs: readonly { id: string }[]) => cs.map((c) => c.id).sort()
const by = (v: View, id: string) => v.proposal!.changes.find((c) => c.id === id && !c.top)!

describe('which lines stand or fall together (core `together.ids`)', () => {
  it('a line named by one other comes with it, either way round', () => {
    const ch = together.proposal!.changes
    expect(ids(partnersOf(ch, by(together, 'add_two')))).toEqual(['add_two', 'two_specialists'])
    expect(ids(partnersOf(ch, by(together, 'c_extra')))).toEqual(['c_extra'])
  })
  it('as far as the links go: unticking one of four lines that need the same figure unticks all five, so core never sees a line without the figure it reads', () => {
    const ch = consulting.proposal!.changes
    const t = toggleLine(ch, tickEvery(ch), by(consulting, 'product_time_to_contract'))
    const left = picksOf(ch, t).left.map((c) => c.id).sort()
    expect(left).toEqual(['focus_product_sales', 'product_contract_to_cash', 'product_only_service_engagements', 'product_only_service_opportunity_share', 'product_time_to_contract'])
    // The lane's one-level rule (ViewChat.tsx withPartners) would leave three lines ticked that read the unticked figure.
    const oneLevel = [by(consulting, 'product_time_to_contract'), ...ch.filter((o) => !o.top && (by(consulting, 'product_time_to_contract').together?.ids ?? []).includes(o.id))]
    expect(oneLevel.length).toBeLessThan(left.length)
  })
  it('a top-level field never pairs with a record of the same name', () => {
    const ch = consulting.proposal!.changes, top = ch.find((c) => c.top && c.id === 'coaching_questions')!
    expect(partnersOf(ch, top).map(lineKey)).toEqual(['top:coaching_questions'])
  })
})

describe('ticks: by group and by line, and what they approve and leave out', () => {
  it('a group unticked and ticked again is whole again, partners with it; what is approved is in core\'s two lists, in core\'s order', () => {
    const p = hosting.proposal!, ch = p.changes, g = p.groups![1]!.lines
    let t = setGroup(ch, tickEvery(ch), g, false)
    expect(groupTicked(ch, t, g)).toBe(false)
    const off = picksOf(ch, t)
    expect(off.left.map((c) => c.id)).toEqual(expect.arrayContaining(g.map((i) => ch[i]!.id)))
    t = setGroup(ch, t, g, true)
    const all = picksOf(ch, t)
    expect(all.left).toEqual([])
    expect(all.only).toEqual(ch.flatMap((c) => (c.top ? [] : [c.id])))
    expect(all.only_top).toEqual(['coaching_questions'])
  })
  it('nothing ticked leaves every line out', () => {
    const ch = together.proposal!.changes
    expect(picksOf(ch, new Set()).left.map((c) => c.id)).toEqual(ch.map((c) => c.id))
  })
})

describe('may the person edit directly now, and if not, why (DL ruling c)', () => {
  const s = (view: View, over: Partial<{ sid: string | null; at: number | null; error: string | null; stale: boolean }> = {}) => ({ sid: 's_000000000001', view, at: null, error: null, stale: false, ...over })
  it('while Olumi\'s proposal is held: "after approval", naming the proposal; never a silent absence', () => {
    expect(editGateOf(s(consulting), { id: consulting.you_id!, name: 'x' })).toEqual({ ok: false, reason: 'after_approval', held: { id: consulting.proposal!.id, heading: consulting.proposal!.heading } })
  })
  it('on an approved board: open, on the version core takes edits on', () => {
    const approved = { ...consulting, proposal: null, model: { ...consulting.model!, edit_base: 41 } } as View
    expect(editGateOf(s(approved), null)).toEqual({ ok: true, sid: 's_000000000001', base: 41 })
  })
  it('an earlier version, a failed or overtaken read, or another person\'s page: closed, each with its own reason', () => {
    const approved = { ...consulting, proposal: null, model: { ...consulting.model!, edit_base: 41 } } as View
    expect(editGateOf(s(approved, { at: 2 }), null)).toMatchObject({ ok: false, reason: 'past_version' })
    expect(editGateOf(s(approved, { error: 'x' }), null)).toMatchObject({ ok: false, reason: 'not_read' })
    expect(editGateOf(s(approved, { stale: true }), null)).toMatchObject({ ok: false, reason: 'not_read' })
    expect(editGateOf(s(approved), { id: 'someone-else', name: 'x' })).toMatchObject({ ok: false, reason: 'not_your_page' })
  })
})

describe('who a card is by (core `cards[].author`, `change`, `doubt`, `challenged`)', () => {
  it('core\'s words as given; Olumi\'s proposed cards are provisional, a person\'s are not', () => {
    for (const v of [consulting, hosting, together]) for (const c of v.model!.cards) {
      const a = authorshipOf(c)
      if (c.author != null) expect(a.by).toBe(c.author.by)
      expect(a.provisional).toBe(c.doubt === true || (c.change != null && c.author?.by === 'olumi'))
      if (a.by === 'person' && c.doubt !== true) expect(a.provisional).toBe(false)
    }
  })
  it('a shape that is not core\'s reads as nobody, never guessed', () => {
    const c = { ...consulting.model!.cards[0]!, author: { by: 'someone', text: 'x', title: '' } } as unknown as NonNullable<View['model']>['cards'][number]
    expect(authorshipOf(c)).toMatchObject({ by: null, text: null })
  })
})

describe('core\'s verdict on a change', () => {
  it('absent from a core that sends none, so Approve is offered as before', () => {
    expect(verdictOf({ ...together.proposal!, verdict: undefined } as NonNullable<View['proposal']>)).toBeNull()
  })
})
