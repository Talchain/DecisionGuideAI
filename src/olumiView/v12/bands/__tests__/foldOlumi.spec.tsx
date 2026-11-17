/**
 * D1c (v9; Codex UI reviewer 008 v8 clutter answers): on Simple an APPROVED driver or result Olumi wrote, whose figure core holds with no value yet
 * (core's gap words, or a calculation waiting on an input), folds into ONE "N more from Olumi" per row. Every contrast the reviewer named: the person's
 * unknown driver stays; every option stays; what the newest reply points at, the figure being tried and the card open in details stay; a qualitative
 * card with no figure is not swept in. Bound by card id on the in-repo bakery fixture (invented words), each rule by the one field that differs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import type { NodeProps } from '@xyflow/react'
import type { View, ViewCard, ViewModel } from '../../../client'
import { cardGroupsOf, foldKeepOf, groupIdOf, groupKindOf } from '../groups'
import { FoldCard, olumiMore } from '../BandNodes'
import { useWhatIf } from '../../../whatif'
import { useLaneInspector } from '../../edit/inspectorStore'

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const card = (id: string) => base.model!.cards.find((c) => c.id === id)!
const by = (who: string) => ({ by: who, text: who, title: '' })
/** A saved card (no change pending) as the View sends it, with core's kind and its author. */
const saved = (id: string, kind: string, who: string): ViewCard => ({ ...card(id), kind, author: by(who), change: null } as unknown as ViewCard)
const withCards = (cards: ViewCard[], chat: unknown[] = []): { model: ViewModel; view: View } => {
  const model = { ...base.model!, cards: base.model!.cards.map((c) => cards.find((x) => x.id === c.id) ?? c) } as ViewModel
  return { model, view: { ...base, model, chat } as unknown as View }
}
const kindOf = (id: string, cards: ViewCard[], chat: unknown[] = []) => { const { model, view } = withCards(cards, chat); return groupKindOf(model.cards.find((c) => c.id === id)!, model, view, foldKeepOf(view)) }
/** A chat turn whose answer points at `about` (core's `answer.next`). Only the fields the rule reads. */
const reply = (id: number, about: string[], at: string | null = null) => ({ id, answer: { next: { at, about } } })

afterEach(() => { useWhatIf.setState({ shown: null }); useLaneInspector.setState({ target: null }) })

describe('D1c: which approved cards fold behind "N more from Olumi" on Simple', () => {
  it('F0 preconditions: oven_price has core\'s gap words and no value; spend is a calculation waiting on an input; budget has a value', () => {
    expect([card('oven_price').figure?.text, card('oven_price').figure?.title.startsWith('not given yet')]).toEqual(['', true])
    expect(card('spend').figure?.state).toBe('waits')
    expect(card('budget').figure?.text).not.toBe('')
  })
  it('F1 an approved Olumi driver with no value yet folds; an approved Olumi result waiting on an input folds; each in its own row', () => {
    const cards = [saved('oven_price', 'driver', 'olumi'), saved('spend', 'result', 'olumi')]
    expect([kindOf('oven_price', cards), kindOf('spend', cards)]).toEqual(['olumi', 'olumi'])
    const { model, view } = withCards(cards)
    const ids = cardGroupsOf(model, view).filter((g) => g.kind === 'olumi').map((g) => `${g.id}:${g.cards.join(',')}`)
    expect(ids.sort()).toEqual([`${groupIdOf('olumi', 'inputs')}:oven_price`, `${groupIdOf('olumi', 'outcomes')}:spend`].sort())
  })
  it('F2 CONTRAST: the same unknown driver stays drawn when the person, the brief or both wrote it', () => {
    for (const who of ['person', 'brief', 'mixed']) expect(kindOf('oven_price', [saved('oven_price', 'driver', who)]), who).toBeNull()
  })
  it('F3 CONTRAST: every option stays, Olumi\'s too, with or without a result; aims and risks are not in this rule', () => {
    for (const [id, kind] of [['second_oven', 'option'], ['longer_hours', 'option'], ['sell_360', 'aim'], ['oven_repair', 'risk']] as const) {
      expect(kindOf(id, [saved(id, kind, 'olumi')]), `${id} ${kind}`).toBeNull()
    }
  })
  it('F4 CONTRAST: a qualitative Olumi driver (no figure) is not swept in; an Olumi driver with a value is drawn', () => {
    const words = { ...saved('oven_price', 'driver', 'olumi'), figure: null } as ViewCard
    expect(kindOf('oven_price', [words]), 'no figure: not a number waiting').toBeNull()
    expect(kindOf('budget', [saved('budget', 'driver', 'olumi')]), 'has a value').toBeNull()
  })
  it('F5 what the NEWEST reply points at stays drawn (its next.about and next.at); an older reply\'s pointer does not hold it', () => {
    const cards = [saved('oven_price', 'driver', 'olumi'), saved('spend', 'result', 'olumi')]
    expect(kindOf('oven_price', cards, [reply(1, ['oven_price'])]), 'about').toBeNull()
    expect(kindOf('spend', cards, [reply(1, [], 'spend')]), 'at').toBeNull()
    expect(kindOf('oven_price', cards, [reply(1, ['oven_price']), reply(2, ['spend'])]), 'CONTRAST: an older reply').toBe('olumi')
    expect(kindOf('oven_price', cards, [reply(1, ['oven_price']), { id: 2, answer: null }]), 'a newer turn with no reply leaves the newest reply in place').toBeNull()
  })
  it('F6 the figure being tried in a what-if on this scenario and the card open in details stay drawn; a what-if on another scenario does not hold it', () => {
    const cards = [saved('oven_price', 'driver', 'olumi'), saved('spend', 'result', 'olumi')]
    useWhatIf.setState({ shown: { sid: base.id, base: 1, quantity: 'oven_price', typed: '5000', variant: {} as never } })
    expect(kindOf('oven_price', cards)).toBeNull()
    useWhatIf.setState({ shown: { sid: 'another', base: 1, quantity: 'oven_price', typed: '5000', variant: {} as never } })
    expect(kindOf('oven_price', cards), 'CONTRAST: another scenario').toBe('olumi')
    useLaneInspector.setState({ target: { kind: 'card', id: 'spend' } })
    expect(kindOf('spend', cards)).toBeNull()
  })
})

describe('D1c: the count card', () => {
  it('F7 says "N more from Olumi" with Olumi\'s mark, framed as a saved card (not the dashed proposal frame)', () => {
    const group = { id: groupIdOf('olumi', 'inputs'), kind: 'olumi', kinds: ['driver'], words: null, hover: 'Oven price', challenged: 0 }
    render(<FoldCard {...({ data: { count: 2, sid: 's_x', width: 220, group } } as unknown as NodeProps)} />)
    const b = screen.getByTestId('view-group-card')
    expect(b.textContent).toContain(olumiMore(2))
    expect(olumiMore(2)).toBe('2 more from Olumi')
    expect(b.getAttribute('data-group-kind')).toBe('olumi')
    expect(b.querySelector('[data-olumi-mark]')).not.toBeNull()
    expect(b.className).not.toContain('border-dashed')
  })
})
