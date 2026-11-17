/**
 * Codex H07 (17:12Z): a qualitative model (only the question and its aims) shows the purposes and tensions core folded behind the question on the
 * default canvas, by opening them once through core's own `?open=` read; a model with any option or figure stays as core folds it; and what core
 * folded behind any card is shown at rest (it is content, not a hover-only action).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { notesOpenOn, qualitativeNotesToOpen, resetQualitativeNotes, useQualitativeNotes } from '../qualitativeNotes'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
type Badge = NonNullable<NonNullable<View['model']>['question']['badge']>
const badge = { records: ['dissent_purposes', 'claim_visitors', 'claim_learning', 'claim_belonging'], text: '1 disagreement, 3 claims', title: '', label: 'Show 4 notes behind this', open: false, proposed: true, change: '+', words: '1 disagreement, 3 claims', face: '1 disagreement, 3 claims', icon: '' } as Badge
const aim = { ...fx.model!.cards.find((c) => c.family === 'goal')!, id: 'aim_purpose' }
const qualitative = (over: Partial<NonNullable<View['model']>> = {}): View => ({ ...fx, model: { ...fx.model!, question: { ...fx.model!.question, badge }, cards: [aim], ...over } } as View)
afterEach(() => { resetQualitativeNotes(); vi.restoreAllMocks() })

// CHANGED BY DESIGN (the lead's D2, 17 Nov: "worked steps, premises and what it rests on are closed at rest behind their existing count"): on a model
// with an option or a figure, a card's notes are closed at rest, the no-chance option and the unmeasured aim included (the 16 Nov rows opened them there).
describe('notes open on a card only where they are the picture: a qualitative model (D2, 17 Nov: closed at rest on every other model)', () => {
  const option = fx.model!.cards.find((c) => c.family === 'option')!
  const mixed = { cards: [aim, option] }
  it('closed on a model that has an option: the no-chance option and the unmeasured aim keep them behind "Rests on N" and the lens', () => {
    expect(notesOpenOn(mixed)).toBe(false)
    expect(notesOpenOn({ cards: [aim, { family: 'quantity' }] }), 'a figure makes it not qualitative too').toBe(false)
  })
  it('CONTRAST: the same aim in a qualitative model (no option, no figure) opens them: there the notes ARE the picture', () => {
    expect(notesOpenOn({ cards: [aim] })).toBe(true)
  })
})

describe('a qualitative model shows the question\'s notes on the canvas', () => {
  it('opens them only where the model is the question and its aims, with notes folded and not yet open', () => {
    expect(qualitativeNotesToOpen(qualitative())).toBe(true)
    // Contrast: any option or figure on the canvas leaves core's folds alone; an open or empty badge needs nothing.
    expect(qualitativeNotesToOpen(qualitative({ cards: [aim, fx.model!.cards.find((c) => c.family === 'option')!] }))).toBe(false)
    expect(qualitativeNotesToOpen(qualitative({ cards: [aim, fx.model!.cards.find((c) => c.family === 'quantity')!] }))).toBe(false)
    expect(qualitativeNotesToOpen(qualitative({ question: { ...fx.model!.question, badge: { ...badge, open: true } } }))).toBe(false)
    expect(qualitativeNotesToOpen(qualitative({ question: { ...fx.model!.question, badge: null } }))).toBe(false)
  })
  it('asks core for exactly the question\'s records, once per scenario, through the same read the badge makes', () => {
    const setOpened = vi.fn(async (_o: { open: Map<string, string[]>; all: boolean }) => true)
    useViewStore.setState({ opened: { open: new Map(), all: false }, setOpened } as never)
    const v = qualitative()
    const { rerender } = renderHook(({ view }) => useQualitativeNotes('s_q', view), { initialProps: { view: v } })
    expect(setOpened).toHaveBeenCalledTimes(1)
    expect([...setOpened.mock.calls[0]![0].open.entries()]).toEqual([['page:question', badge.records]])
    // The person closes them: the same scenario is never re-opened behind their back.
    rerender({ view: qualitative() })
    expect(setOpened).toHaveBeenCalledTimes(1)
  })
})
