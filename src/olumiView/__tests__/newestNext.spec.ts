/**
 * The one adapter for the newest reply's next step (layout.ts newestNextOf), which five surfaces draw from (the Run's "Suggested next
 * step", the reasoning commitment, Focus now, the analysis hero, and the composer's prompt). Core delta 5a (15 Nov): a conversational
 * reply's next has label '', no words and no move. Bound by the turn's identity on core's golden held-proposal View.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { newestNextOf } from '../layout'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const k = golden.chat.findIndex((t) => t.answer?.next.newest === true)
type Next = NonNullable<View['chat'][number]['answer']>['next']
const withNext = (patch: Partial<Next>): View['chat'] => golden.chat.map((t, i) => (i === k ? { ...t, answer: { ...t.answer!, next: { ...t.answer!.next, ...patch } } } : t))

describe('the newest reply\'s next step', () => {
  it('precondition: core\'s golden has one newest reply with a step (label, words and a move)', () => {
    expect(k).toBeGreaterThanOrEqual(0)
    expect(newestNextOf(golden.chat)?.turn.id).toBe(golden.chat[k]!.id)
  })
  it('CATCH (core delta 5a): a conversational reply (label \'\', no words, no move) offers no step, so nothing is drawn for it', () => {
    expect(newestNextOf(withNext({ label: '', text: [], move: null, about: ['some_card'], at: null }))).toBeNull()
    expect(newestNextOf(withNext({ label: '', text: [{ text: '  ' }], move: '' }))).toBeNull()
  })
  it('CONTRAST: a step with only a label, only words, or only a move is still the newest step', () => {
    for (const patch of [{ label: 'Check it', text: [], move: null }, { label: '', text: [{ text: 'Check the start date.' }], move: null }, { label: '', text: [], move: 'gather_evidence' }] as Partial<Next>[]) {
      expect(newestNextOf(withNext(patch))?.turn.id, JSON.stringify(patch)).toBe(golden.chat[k]!.id)
    }
  })
})
