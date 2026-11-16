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

describe('an option with no chance shows the notes that bear on it (16 Nov: the reasoning a model stores reaches the canvas)', () => {
  const option = fx.model!.cards.find((c) => c.family === 'option')!
  const premise = { glyph: '⊢', text: 'An invented prerequisite', title: '', id: 'cond_invented', olumi: null }
  const mixed = { cards: [aim, option] }
  it('open on an option that has premises and no chance row; closed where it has a chance, where it has no premises, and on a figure card', () => {
    const noChance = { ...option, rows: option.rows.filter((r) => r.kind !== 'chance'), premises: [premise] }
    expect(notesOpenOn(mixed, noChance)).toBe(true)
    // Contrasts, each by the one field that differs.
    const chanceRow = { kind: 'chance' } as (typeof option.rows)[number]
    expect(notesOpenOn(mixed, { ...noChance, rows: [chanceRow] })).toBe(false)
    expect(notesOpenOn(mixed, { ...noChance, premises: [] })).toBe(false)
    expect(notesOpenOn(mixed, { ...noChance, family: 'quantity' })).toBe(false)
  })
  it('open on an aim nothing is counted against (bound.measured false) that carries notes, in a model that has options; closed on a measured aim and on one with no notes', () => {
    const words = { ...aim, premises: [premise], bound: { text: 'Kept in words', title: '', olumi: null, measured: false } }
    expect(notesOpenOn(mixed, words)).toBe(true)
    expect(notesOpenOn(mixed, { ...words, bound: { ...words.bound, measured: true } })).toBe(false)
    expect(notesOpenOn(mixed, { ...words, bound: null })).toBe(false)
    expect(notesOpenOn(mixed, { ...words, premises: [] })).toBe(false)
  })
  it('a qualitative model (no option, no figure) still opens them on every card, as before', () => {
    expect(notesOpenOn({ cards: [aim] }, { ...aim, premises: [] })).toBe(true)
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
