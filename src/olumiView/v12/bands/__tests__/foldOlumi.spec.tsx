import { describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard, ViewModel } from '../../../client'
import { groupKindOf } from '../groups'

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const card = (id: string) => base.model!.cards.find((c) => c.id === id)!
const by = (who: string) => ({ by: who, text: who, title: '' })
/** A saved card (no change pending) as the View sends it, with core's kind and its author. */
const saved = (id: string, kind: string, who: string): ViewCard => ({ ...card(id), kind, author: by(who), change: null } as unknown as ViewCard)
const withCards = (cards: ViewCard[]): { model: ViewModel; view: View } => {
  const model = { ...base.model!, cards: base.model!.cards.map((c) => cards.find((x) => x.id === c.id) ?? c) } as ViewModel
  return { model, view: { ...base, model } }
}
describe('approved Olumi figures with no value yet stay drawn on Simple', () => {
  it('F0 preconditions: oven_price has core\'s gap words and no value; spend is a calculation waiting on an input; budget has a value', () => {
    expect([card('oven_price').figure?.text, card('oven_price').figure?.title.startsWith('not given yet')]).toEqual(['', true])
    expect(card('spend').figure?.state).toBe('waits')
    expect(card('budget').figure?.text).not.toBe('')
  })
  it('F1 an approved Olumi driver with no value yet and an approved Olumi result waiting on an input stay drawn', () => {
    const cards = [saved('oven_price', 'driver', 'olumi'), saved('spend', 'result', 'olumi')]
    const { model, view } = withCards(cards)
    expect(cards.map((card) => groupKindOf(card, model, view))).toEqual([null, null])
  })
})
