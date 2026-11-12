/**
 * The journey layer's pure judgements (olumiView/journey.ts), on core's own served Views (fixtures/real, fixtures/v11: core output, not
 * written here): which lines stand or fall together, what a set of ticks approves and leaves out, when a direct edit may be made and why
 * not, and who a card is by. The acts themselves run against a real core in olumiCore/__tests__/actionLayer.journey.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { authorshipOf, editGateOf, groupTicked, lineKey, noChanceOf, partnersOf, picksOf, questionsOf, setGroup, tickEvery, toggleLine, turnStateOf, verdictOf } from '../journey'

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

describe('where the conversation stands (turnStateOf), typed, in core\'s words', () => {
  const failed = read('j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'), capacity = read('real/capacity.view3.json')
  it('a turn that did not finish: failed, with core\'s own words and the person\'s', () => {
    expect(turnStateOf(failed)).toEqual({ kind: 'failed', said: 'Not sure', words: 'Olumi could not finish this turn. Please try again in a moment.', job: 41 })
  })
  it('Olumi answering: waiting (the same served turn while it runs)', () => {
    const v = { ...failed, turn: { ...failed.turn!, status: 'answering', words: 'Olumi is answering.' } } as View
    expect(turnStateOf(v)).toMatchObject({ kind: 'waiting', said: 'Not sure', words: 'Olumi is answering.' })
  })
  it('an answer: answered, on the newest turn, with the proposal it brought or none', () => {
    const t = capacity.chat.at(-1)!, st = turnStateOf(capacity)
    expect(st).toMatchObject({ kind: 'answered', said: t.said, turn: t.id, proposal: null })
    expect(st.kind === 'answered' && st.answer).toBe(t.answer)
  })
  // Core's sentences as core's own tests pin them: ac41 shared/turn-words.ts REPLY_WITHHELD; f549b9cc view/__tests__/coach-withheld.test.ts.
  const AC41 = 'Olumi\'s reply broke its own rules, so it is not shown.'
  const F549 = { kind: 'untraced_figure', limit: 'Olumi held back its reply: it used a figure it could not trace to your model, and Olumi shows only what it can stand behind.', next: 'What share of your jobs are e-bike jobs?' }
  const held = (extra: object) => ({ ...capacity, chat: [...capacity.chat.slice(0, -1), { ...capacity.chat.at(-1)!, answer: null, ...extra }] }) as View
  it('a reply Olumi held back: held, never answered, with core\'s sentence (ac41: no typed reason)', () => {
    expect(turnStateOf(held({ broke: AC41 }))).toMatchObject({ kind: 'held', words: AC41, withheld: null })
  })
  it('held, with a core that types it: what Olumi could not stand behind and the question to take forward', () => {
    const words = `${F549.limit} A question to take forward: ${F549.next}`
    expect(turnStateOf(held({ broke: words, withheld: F549 }))).toMatchObject({ kind: 'held', words, withheld: F549 })
  })
  it('held wins over a stale answer object (core sends answer null with broke; never draw both)', () => {
    expect(turnStateOf(held({ broke: AC41, answer: capacity.chat.at(-1)!.answer })).kind).toBe('held')
  })
  it('a turn with no answer and no held reply, only core\'s words for why: problem, never an empty answer', () => {
    const t = capacity.chat.at(-1)!, words = 'Olumi stopped before it finished.'
    expect(turnStateOf({ ...capacity, chat: [...capacity.chat.slice(0, -1), { ...t, answer: null, broke: null, problem: words }] } as View)).toEqual({ kind: 'problem', said: t.said, words, turn: t.id })
  })
  it('nothing said yet: none', () => {
    expect(turnStateOf({ ...capacity, chat: [], turn: undefined } as View)).toEqual({ kind: 'none' })
  })
})

describe('Olumi\'s questions and where the model cannot support a chance', () => {
  it('questionsOf: core\'s questions in core\'s order, each answerable by its place and words', () => {
    const v = { ...read('real/capacity.view3.json') } as View
    const q = ['What would success look like here?', 'What are the main risks?']
    expect(questionsOf({ ...v, model: { ...v.model!, coaching_questions: q } } as View)).toEqual([{ at: 0, text: q[0] }, { at: 1, text: q[1] }])
    expect(questionsOf(v)).toEqual([])
  })
  it('noChanceOf: each option whose headline is "none", with its words and the View\'s own question for what it waits on', () => {
    const v = read('j1/bookshop-v1-turn-failed.core-172e23ae.view3.json')
    const nc = noChanceOf(v), opts = v.model!.cards.flatMap((c) => (c.family === 'option' ? [c] : []))
    expect(nc.map((x) => x.option)).toEqual(opts.map((c) => c.id))
    expect(nc[0]).toEqual({ option: 'newsletter', text: 'this option: no chance yet', waits: 'No chance can be worked out for this option yet', add: null })
    expect(noChanceOf(read('real/hiring-unchecked-first.view3.json'))).toEqual([])
  })
})
