import { describe, expect, it, vi } from 'vitest'
// groups.ts reaches the store through the bands; the store's backend client is not part of what these rows read.
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard, ViewModel } from '../../../client'
import { cardGroupsOf, groupIdOf, groupKindOf, groupLinksOf, withoutGrouped } from '../groups'

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
  it('G1 a pending or approved Olumi driver is drawn; a pending Olumi option is drawn', () => {
    const { model, view } = withCards([as('budget', 'driver', olumi, added), as('second_oven', 'option', olumi, added)])
    expect(groupKindOf(model.cards.find((c) => c.id === 'budget')!, model, view), 'proposed by Olumi').toBeNull()
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

describe('non-note proposals and their links stay on the drawn cards', () => {
  const { model, view } = withCards([as('budget', 'driver', olumi, added), as('oven_price', 'driver', olumi, added), as('fitting', 'driver', olumi, added), as('oven_repair', 'risk', olumi, added)])
  const groups = cardGroupsOf(model, view)
  it('G3 the proposed drivers and risk have no row group', () => {
    expect(groups.filter((g) => g.kind === 'proposed')).toEqual([])
    expect(withoutGrouped(model, groups).cards.map((c) => c.id)).toContain('budget')
  })
  it('G4 the proposed drivers and risk have no group connectors', () => {
    const drawn = new Set([...withoutGrouped(model, groups).cards.map((c) => c.id), ...groups.map((g) => g.id)])
    const links = groupLinksOf(model, groups, drawn)
    expect(links.filter((l) => [groupIdOf('proposed', 'inputs'), groupIdOf('proposed', 'outcomes')].includes(l.from))).toEqual([])
    // CONTRAST: a link between two drawn cards is not rerouted.
    expect(links.some((l) => l.from === 'base_sales')).toBe(false)
  })
})

describe('D1a on a first model: Olumi\'s proposed figures, drivers, results and risks are drawn; only its notes fold', () => {
  const PROPOSED: ReadonlyArray<readonly [string, string]> = [['budget', 'driver'], ['oven_repair', 'risk'], ['sales', 'result'], ['fitting', 'note']]
  const pending = () => withCards(PROPOSED.map(([id, kind]) => as(id, kind, olumi, added)))
  const firstOf = (v: { model: ViewModel; view: View }) => ({ model: v.model, view: { ...v.view, version: null } as View })
  it('F1 first model: a proposed driver, risk and result are drawn, in no group, and keep their proposed mark (by id)', () => {
    expect(base.version, 'precondition: the fixture is an approved model').not.toBeNull()
    const { model, view } = firstOf(pending()), groups = cardGroupsOf(model, view), grouped = new Set(groups.flatMap((g) => g.cards))
    const drawn = withoutGrouped(model, groups)
    for (const id of ['budget', 'oven_repair', 'sales']) {
      expect(grouped.has(id), `${id} is in no group`).toBe(false)
      const c = drawn.cards.find((x) => x.id === id)!
      expect([c.id, c.change, c.author?.by], `${id} is drawn and keeps its proposed mark`).toEqual([id, added, 'olumi'])
    }
  })
  it('F2 CONTRAST, same fixture: the proposed note still folds into the proposed group', () => {
    const { model, view } = firstOf(pending()), groups = cardGroupsOf(model, view)
    // Order #22 (23 Nov): a note stands among the points raised by Core's kind, never in "What drives it", so its proposed group is the points row's.
    expect(groups.filter((g) => g.kind === 'proposed').map((g) => [g.id, g.cards]), 'only the note is in a proposed group').toEqual([[groupIdOf('proposed', 'points'), ['fitting']]])
  })
  it('F3 on an approved model, the proposed driver, risk and result are drawn; the proposed note still folds', () => {
    const { model, view } = pending(), groups = cardGroupsOf(model, view)
    expect(groups.find((g) => g.id === groupIdOf('proposed', 'inputs'))).toBeUndefined()
    expect(groups.find((g) => g.id === groupIdOf('proposed', 'points'))!.cards).toEqual(['fitting'])
    expect(groups.find((g) => g.id === groupIdOf('proposed', 'outcomes'))).toBeUndefined()
    for (const id of ['budget', 'oven_repair', 'sales']) expect(groupKindOf(model.cards.find((c) => c.id === id)!, model, view), id).toBeNull()
  })
  it('F4 no card object is mutated: the drawn card is the very object core sent, change and author intact', () => {
    const { model, view } = firstOf(pending()), before = JSON.stringify(model.cards)
    const drawn = withoutGrouped(model, cardGroupsOf(model, view))
    expect(JSON.stringify(model.cards)).toBe(before)
    for (const id of ['budget', 'oven_repair', 'sales']) expect(drawn.cards.find((c) => c.id === id)).toBe(model.cards.find((c) => c.id === id))
  })
})
