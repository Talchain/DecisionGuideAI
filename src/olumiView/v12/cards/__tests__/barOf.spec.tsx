/**
 * Core 79b57973 (`cards[].bar_of`): a figure whose only reader is one aim's target or bound, used once there, is that aim's bar. Url3-2 (Paul, 19 Nov): the bar
 * ("… bar · at least 10%") was drawn as a card of its own AND the aim card said "at least 10%". Simple says it once, on the aim; Detailed draws every card.
 * Hand-built from a stored View (core-38eebca9 bakery): the `budget` figure is the bound of `within_budget`; `bar_of` is set on it as core now sends.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../../../client'
import { useViewStore } from '../../../store'
import { boardOf } from '../../../canvas'
import { barsOf } from '../../../layout'
import { SimpleFace } from '../../SimpleFace'
import { detailsOf, useLaneInspector } from '../../edit/inspectorStore'
import { showSimple, showWholeModel } from '../../simpleStore'

const BASE = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const AIM = 'within_budget', BAR = 'budget', INPUT = 'oven_price'
const byOlumi = (c: ViewCard): ViewCard => ({ ...c, author: { ...c.author!, by: 'olumi' } }) as unknown as ViewCard
/** The same model with `bar_of` on the bar figure (core 79b57973), or without it (a core before), and an input that feeds the bar. */
const modelOf = (barOf: boolean): ViewModel => {
  const m = BASE.model!
  const cards = m.cards.map((c) => (c.id === BAR ? { ...byOlumi(c), ...(barOf ? { bar_of: AIM } : {}) } : c))
  const feeds = { ...m.links.find((l) => l.from === BAR)!, from: INPUT, to: BAR, title: '' }
  return { ...m, cards, links: [...m.links, feeds] }
}
const WITH = modelOf(true), WITHOUT = modelOf(false)
const ids = (m: ViewModel) => m.cards.map((c) => c.id)
const board = (m: ViewModel, level: 'simple' | 'detailed') => {
  useViewStore.setState({ uuid: 'u', sid: BASE.id, view: { ...BASE, model: m }, status: 'ready' } as never)
  if (level === 'simple') showSimple(BASE.id); else showWholeModel(BASE.id)
  return boardOf(m)
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never) })

describe('an aim\'s bar is the aim\'s bound, not a card of its own on Simple', () => {
  it('R1 precondition: core marks the bar figure `bar_of` its aim, and only that one', () => {
    expect([...barsOf(WITH)]).toEqual([[BAR, AIM]])
    expect([...barsOf(WITHOUT)]).toEqual([])
  })
  it('R2 Simple draws no card for the bar; CONTRAST: without `bar_of` it is a card, and Detailed draws it either way', () => {
    expect([ids(board(WITH, 'simple').model).includes(BAR), ids(board(WITHOUT, 'simple').model).includes(BAR)]).toEqual([false, true])
    expect(ids(board(WITH, 'detailed').model).includes(BAR)).toBe(true)
  })
  it('R3 a bar whose aim is not in the model stays a card, so nothing is lost', () => {
    const lone = { ...WITH, cards: WITH.cards.filter((c) => c.id !== AIM) }
    expect(barsOf(lone).size).toBe(0)
  })
  it('R4 links: what fed the bar runs to its aim, the bar\'s own bound line is no second connector; CONTRAST: no bar, no connector; an aim link of its own is not doubled', () => {
    const onAim = (m: ViewModel) => board(m, 'simple').links.filter((l) => l.to === AIM && l.from === INPUT).map((l) => [l.from, l.count])
    expect(onAim(WITH)).toEqual([[INPUT, 1]])
    expect(onAim(WITHOUT)).toEqual([])
    const direct = { ...WITH, links: [...WITH.links, { ...WITH.links[0]!, from: INPUT, to: AIM, title: '' }] }
    expect(onAim(direct)).toEqual([])
  })
})

describe('the aim card says the bar once, with the bar\'s author mark', () => {
  const aim = BASE.model!.cards.find((c) => c.id === AIM)!
  const pill = (m: ViewModel) => render(<SimpleFace card={aim} model={m} noted={false} />).container.querySelector<HTMLElement>('.ok-bound')!
  it('R5 with `bar_of` the bound pill carries the bar figure\'s author mark (core\'s author words); CONTRAST: without it the pill carries none', () => {
    const on = pill(WITH)
    expect([on.textContent, on.querySelector('[data-author-mark]')?.getAttribute('data-author-mark')]).toEqual([aim.bound!.text, 'olumi'])
    cleanup()
    expect(pill(WITHOUT).querySelector('[data-author-mark]')).toBeNull()
  })
  it('R6 the pill still opens the bar figure\'s own editor (core\'s bound line, the existing path): pressing it shows the bar\'s details, though it is no card', () => {
    board(WITH, 'simple')
    pill(WITH).querySelector<HTMLElement>(`[data-testid="view-aim-edit-${BAR}"]`)!.click()
    expect(detailsOf(useLaneInspector.getState())).toMatchObject({ kind: 'card', id: BAR })
  })
  it('R7 a bar with no author keeps the aim\'s own bound.olumi mark (decided on data, not on an element); CONTRAST: a bar with an author shows the bar\'s mark; the pill opens the same card that is the bar', () => {
    const withBoundOlumi = { ...aim, bound: { ...aim.bound!, olumi: { title: 'Olumi set this bar' } } } as unknown as ViewCard
    const noAuthor = (m: ViewModel): ViewModel => ({ ...m, cards: m.cards.map((c) => (c.id === BAR ? { ...c, author: undefined, olumi: null } as unknown as ViewCard : c)) })
    const mark = (m: ViewModel) => render(<SimpleFace card={withBoundOlumi} model={m} noted={false} />).container.querySelector<HTMLElement>('.ok-bound [data-olumi-mark]')
    expect(mark(noAuthor(WITH))).not.toBeNull()
    cleanup()
    expect(render(<SimpleFace card={withBoundOlumi} model={noAuthor(WITH)} noted={false} />).container.querySelector('.ok-bound [data-simple-author]')).toBeNull()
    cleanup()
    expect(render(<SimpleFace card={withBoundOlumi} model={WITH} noted={false} />).container.querySelector('.ok-bound [data-simple-author]')).not.toBeNull()
  })
})
