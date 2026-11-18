/**
 * D1 (the owner's ruling, 17 Nov; the lead's D1a and D1b): on Simple, Olumi's unreviewed proposals of kind driver, risk, result or note fold into ONE
 * group card per row, and approved notes into ONE notes stack per row; options, aims and positions never fold, nor do the person's own or approved
 * cards. Bound by card id on the in-repo bakery fixture (invented words), each rule by the one field that differs. Pure: groups.ts.
 */
import { describe, expect, it, vi } from 'vitest'
// groups.ts reaches the store through the bands; the store's backend client is not part of what these rows read.
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard, ViewModel } from '../../../client'
import { cardGroupsOf, challengedIn, EXPLAIN_KEEP_CAP, explanationKeepOf, groupIdOf, groupKindOf, groupLinksOf, withoutGrouped } from '../groups'

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const card = (id: string) => base.model!.cards.find((c) => c.id === id)!
const added = { glyph: '+', title: 'An invented proposal', kind: 'added' }
const olumi = { by: 'olumi', text: 'Olumi inferred', title: '' }, person = { by: 'person', text: 'Yours', title: '' }
/** A card as the View sends it with core's kind, its author and whether it is in the pending proposal (`change`). */
const as = (id: string, kind: string, by: typeof olumi, change: typeof added | null): ViewCard => ({ ...card(id), kind, author: by, change } as unknown as ViewCard)
const withCards = (cards: ViewCard[]): { model: ViewModel; view: View } => {
  const model = { ...base.model!, cards: base.model!.cards.map((c) => cards.find((x) => x.id === c.id) ?? c) } as ViewModel
  return { model, view: { ...base, model } as View }
}

describe('which cards fold on Simple (D1a, D1b): read from change, author.by and core\'s kind', () => {
  it('G1 an Olumi driver in the pending proposal is grouped; the same card approved (change null) is not; an Olumi option in the proposal is not', () => {
    const { model, view } = withCards([as('budget', 'driver', olumi, added), as('second_oven', 'option', olumi, added)])
    expect(groupKindOf(model.cards.find((c) => c.id === 'budget')!, model, view), 'proposed by Olumi, not approved').toBe('proposed')
    const approved = as('budget', 'driver', olumi, null)
    expect(groupKindOf(approved, withCards([approved]).model, withCards([approved]).view), 'CONTRAST: approved').toBeNull()
    expect(groupKindOf(model.cards.find((c) => c.id === 'second_oven')!, model, view), 'CONTRAST: an option is never grouped').toBeNull()
  })
  it('G2b an approved STRUCTURAL card never folds, whoever wrote it: a figure, a risk, a result, an option, an aim; nor a note that holds a figure', () => {
    for (const [id, kind] of [['budget', 'driver'], ['oven_repair', 'risk'], ['sales', 'result'], ['second_oven', 'option'], ['sell_360', 'aim']] as const) {
      for (const by of [person, olumi]) { const c = as(id, kind, by, null); expect(groupKindOf(c, withCards([c]).model, withCards([c]).view), `${kind} by ${by.by}`).toBeNull() }
    }
    const figured = { ...as('budget', 'note', olumi, null), figure: card('budget').figure } as ViewCard
    expect(card('budget').figure, 'precondition: the fixture card has a figure').not.toBeNull()
    expect(groupKindOf(figured, withCards([figured]).model, withCards([figured]).view), 'a note with a figure is a figure').toBeNull()
  })
  it('G1 CONTRAST: the person\'s own driver in the proposal (a reply waiting for approval) is drawn; an aim Olumi proposed is drawn', () => {
    const { model, view } = withCards([as('budget', 'driver', person, added), as('sell_360', 'aim', olumi, added)])
    expect(['budget', 'sell_360'].map((id) => groupKindOf(model.cards.find((c) => c.id === id)!, model, view))).toEqual([null, null])
  })
  // REBOUND (DL 17 Nov ~03:50Z): v2 drew every approved note (an over-reading of "approved never grouped", which was about structural cards); the approved
  // funding board became a tangle of sentence cards. Approved sentence-only records fold again; structural approved cards never do (G2b).
  it('G2 an approved note folds into the notes stack (D1b), whoever wrote it; the same note in the proposal by Olumi is in the proposal group instead', () => {
    // A record that is only a sentence holds no figure: the fixture card is spread with `figure: null` (its own figure would make it a figure, G2b).
    const sentence = (by: typeof olumi, change: typeof added | null) => ({ ...as('fitting', 'note', by, change), figure: null }) as ViewCard
    for (const by of [person, olumi]) { const note = sentence(by, null); expect(groupKindOf(note, withCards([note]).model, withCards([note]).view), by.by).toBe('notes') }
    const proposed = sentence(olumi, added)
    expect(groupKindOf(proposed, withCards([proposed]).model, withCards([proposed]).view)).toBe('proposed')
  })
})

describe('one group card per row, its links run to it', () => {
  const { model, view } = withCards([as('budget', 'driver', olumi, added), as('oven_price', 'driver', olumi, added), as('fitting', 'driver', olumi, added), as('oven_repair', 'risk', olumi, added)])
  // The fixture's `spend` is an approved Olumi calculation waiting on an input, which D1c (v9) folds on its own; it is held drawn here so these rows
  // read the proposal rule alone and its links to `spend` (foldOlumi.spec.tsx F1 holds D1c).
  const groups = cardGroupsOf(model, view, new Set(['spend']))
  it('G3 a row\'s proposals make ONE group card, by row (the risk in its own row), with the kinds it holds', () => {
    const byId = new Map(groups.map((g) => [g.id, g]))
    const inputs = byId.get(groupIdOf('proposed', 'inputs'))!, outcomes = byId.get(groupIdOf('proposed', 'outcomes'))!
    expect([inputs.cards, inputs.kinds, outcomes.cards, outcomes.kinds]).toEqual([['budget', 'oven_price', 'fitting'], ['driver'], ['oven_repair'], ['risk']])
    expect(withoutGrouped(model, groups).cards.map((c) => c.id)).not.toContain('budget')
  })
  it('G4 the grouped cards\' links run to the group card as ONE neutral connector per pair of drawn ends: a count and two ends, nothing of any member (Codex P1)', () => {
    const drawn = new Set([...withoutGrouped(model, groups).cards.map((c) => c.id), ...groups.map((g) => g.id)])
    const links = groupLinksOf(model, groups, drawn)
    const g = groupIdOf('proposed', 'inputs')
    // oven_price -> spend and fitting -> spend are one connector from the group (count 2); budget -> within_budget its own.
    expect(links.map((l) => `${l.from}>${l.to}:${l.count}`).sort()).toEqual([`${g}>spend:2`, `${g}>within_budget:1`, `${groupIdOf('proposed', 'outcomes')}>sales:1`].sort())
    // No member's record, removal, title, sign or place: the connector's only fields are its ends and its count.
    for (const l of links) expect(Object.keys(l).sort()).toEqual(['count', 'from', 'to'])
    // CONTRAST: a link between two drawn cards is not rerouted.
    expect(links.some((l) => l.from === 'base_sales')).toBe(false)
  })
  it('G5 a folded group says what it holds that is challenged: its challenged cards and the alert links at them; none where there is none', () => {
    const inputs = groups.find((x) => x.id === groupIdOf('proposed', 'inputs'))!
    expect(challengedIn(model, inputs)).toBe(0)
    const hot = { ...model, cards: model.cards.map((c) => (c.id === 'budget' ? { ...c, challenged: true } : c)), links: model.links.map((l) => (l.from === 'fitting' ? { ...l, alert: true } : l)) }
    expect(challengedIn(hot, inputs)).toBe(2)
    // CONTRAST: a challenge outside the group is not counted in it.
    expect(challengedIn({ ...model, cards: model.cards.map((c) => (c.id === 'base_sales' ? { ...c, challenged: true } : c)) }, inputs)).toBe(0)
  })
})

// D1d (Codex 18 Nov): the cards that explain the answer stay drawn on a first model though Olumi proposed them; drawing is not approving.
describe('D1d the explanation-critical cards stay drawn, still Olumi\'s proposals', () => {
  /** A first model: Olumi proposed the figures; core names `sales` as what the aim is measured by (role measures), `oven_price` as the figure the
   *  option's chance moves most with (`driver.figure`), and the newest reply's next step points at `fitting`. */
  const first = () => {
    const proposed = ['budget', 'oven_price', 'fitting', 'sales', 'oven_repair'].map((id) => as(id, id === 'oven_repair' ? 'risk' : 'driver', olumi, added))
    const { model: m0, view: v0 } = withCards([...proposed, { ...card('second_oven'), driver: { text: 'x', title: 'x', figure: 'oven_price', low: 0.2, high: 0.8 } } as unknown as ViewCard])
    const model = { ...m0, links: m0.links.map((l) => (l.from === 'sales' && l.to === 'sell_360' ? { ...l, role: 'measures' } : l)) } as unknown as ViewModel
    const view = { ...v0, model, chat: [{ answer: { next: { at: 'fitting', about: [] } } }] } as unknown as View
    return { model, view }
  }
  it('K1 the next step\'s target, the primary outcome and the figure core names as the driver are drawn, still marked as Olumi\'s proposals', () => {
    const { model, view } = first()
    const grouped = new Set(cardGroupsOf(model, view).flatMap((g) => g.cards))
    for (const id of ['fitting', 'sales', 'oven_price']) {
      expect(grouped.has(id), `${id} is not inside a group`).toBe(false)
      const c = withoutGrouped(model, cardGroupsOf(model, view)).cards.find((x) => x.id === id)!
      expect([c.id, c.change, c.author?.by], `${id} is drawn and keeps its proposed mark`).toEqual([id, added, 'olumi'])
    }
  })
  it('K2 CONTRAST: a secondary Olumi proposal outside that set still folds into its group', () => {
    const { model, view } = first()
    const groups = cardGroupsOf(model, view)
    expect(groups.find((g) => g.id === groupIdOf('proposed', 'inputs'))!.cards).toEqual(['budget'])
    expect(groups.find((g) => g.id === groupIdOf('proposed', 'outcomes'))!.cards).toEqual(['oven_repair'])
  })
  it('K3 the set is capped: outcomes first, then drivers, at most EXPLAIN_KEEP_CAP; with no driver named the outcome\'s direct causes stand in', () => {
    const extra = Array.from({ length: 10 }, (_, i) => ({ ...card('budget'), id: `x${i}` }) as ViewCard)
    const model = { ...base.model!, cards: [...base.model!.cards, ...extra], links: [...base.model!.links, ...extra.slice(0, 8).map((c) => ({ ...base.model!.links[0]!, from: c.id, to: 'sell_360', role: 'measures' }))] } as unknown as ViewModel
    expect(explanationKeepOf(model)).toEqual(['x0', 'x1', 'x2', 'x3', 'x4', 'x5'])
    expect(EXPLAIN_KEEP_CAP).toBe(6)
    const withRole = { ...base.model!, links: base.model!.links.map((l) => (l.to === 'sell_360' && l.from === 'sales' ? { ...l, role: 'measures' } : l)) } as unknown as ViewModel
    expect(explanationKeepOf(withRole), 'sales, then its causes').toEqual(['sales', 'base_sales', 'extra_hours_sold'])
    expect(explanationKeepOf(base.model!), 'CONTRAST: core names no outcome: nothing is kept').toEqual([])
  })
  it('K4 approval is untouched: keeping a card drawn changes no card', () => {
    const { model, view } = first(), before = JSON.stringify(model.cards)
    cardGroupsOf(model, view)
    expect(JSON.stringify(model.cards)).toBe(before)
    expect(model.cards.find((c) => c.id === 'sales')!.change).toEqual(added)
  })
})
