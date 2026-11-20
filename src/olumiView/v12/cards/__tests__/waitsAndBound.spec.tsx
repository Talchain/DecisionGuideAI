/**
 * Url3-2 (Paul, 19 Nov): the same waits item was said on every option, each cut by a two-line clamp (core now says it once, 0f85bc3d), and an aim's "not checked yet"
 * state was a large outlined pill. Core's words only, by typed field: the option's `headline.add` and `needs[].id`, the aim's `bound.measured`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../../../client'
import { SimpleFace } from '../../SimpleFace'

const BASE = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const ADD = "Still unresolved: 'Productivity gain from the hire', which Olumi has not been able to size from what is in the model so far."
const waiting = (c: ViewCard, ids: string[], add: string): ViewCard => ({ ...c, needs: ids.map((id) => ({ id, label: id, edit: null })), headline: { ...c.headline!, state: 'none', add, shared: false } }) as unknown as ViewCard
const modelWith = (per: (c: ViewCard, i: number) => ViewCard): ViewModel => {
  let i = 0
  return { ...BASE.model!, cards: BASE.model!.cards.map((c) => (c.family === 'option' ? per(c, i++) : c)) }
}
const CORE_ONCE = modelWith((c) => waiting(c, ['gain'], ''))
const options = (m: ViewModel) => m.cards.filter((c) => c.family === 'option')
afterEach(cleanup)

describe('a waits item every option shares: core says it once (core 0f85bc3d), the options draw what core sent', () => {
  it('W1 core sends the shared item on no option: each option draws its own headline words and never the item', () => {
    for (const o of options(CORE_ONCE)) {
      const { container } = render(<SimpleFace card={o} model={CORE_ONCE} noted={false} />)
      const line = container.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
      expect([o.id, line.textContent, container.textContent?.includes('Still unresolved')]).toEqual([o.id, o.headline!.text, false])
      cleanup()
    }
  })
  it('W2 CONTRAST: an option that still carries its own `add` line draws it whole, with no two-line clamp', () => {
    const own = modelWith((c, i) => (i === 1 ? waiting(c, ['gain'], ADD) : waiting(c, ['gain'], '')))
    const o = options(own)[1]!
    const { container } = render(<SimpleFace card={o} model={own} noted={false} />)
    const line = container.querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    expect([line.textContent, line.classList.contains('ok-two-lines')]).toEqual([ADD, false])
  })
})

describe('an aim\'s unmeasured bound is a quiet line, not a pill', () => {
  const aim = BASE.model!.cards.find((c) => c.id === 'within_budget')!
  const NOT_COUNTED = 'not checked yet: nothing in the model is counted against it'
  it('B1 a bound core has not measured is drawn as the card\'s quiet line, core\'s words unchanged, no pill; CONTRAST: a measured bound keeps the pill', () => {
    const unmeasured = { ...aim, bound: { ...aim.bound!, text: NOT_COUNTED, title: NOT_COUNTED, measured: false } } as unknown as ViewCard
    const { container } = render(<SimpleFace card={unmeasured} model={BASE.model!} noted={false} />)
    const line = container.querySelector<HTMLElement>('[data-simple-face="target"]')!
    expect([line.textContent, line.classList.contains('ok-quiet'), container.querySelector('.ok-pill')]).toEqual([NOT_COUNTED, true, null])
    cleanup()
    const measured = { ...aim, bound: { ...aim.bound!, text: 'at most £200', title: 'at most £200', measured: true } } as unknown as ViewCard
    const again = render(<SimpleFace card={measured} model={BASE.model!} noted={false} />).container
    expect([again.querySelector('[data-simple-face="target"]')!.classList.contains('ok-quiet'), again.querySelector('.ok-pill.ok-bound')?.textContent]).toEqual([false, 'at most £200'])
  })
})
