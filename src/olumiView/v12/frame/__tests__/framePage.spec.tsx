/**
 * The Frame page (spec framing-20261119/mock/SPEC.md, build-now rows 1, 3, 4, 5, 8, 9 and "No model yet"). Cards are bound by id and exact label.
 * Fields are invented over the effects fixture's own cards.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useLaneInspector } from '../../edit/inspectorStore'
import { FramePage, moreCardsWords } from '../FramePage'
import { FrameOpener, FrameStage } from '../FrameStage'
import { useFrameStage } from '../useFrameStage'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const base = fx.model!.cards.find((c) => c.family === 'goal')!
const card = (over: Record<string, unknown>): ViewCard => ({ ...base, olumi: null, bound: null, author: null, ...over } as unknown as ViewCard)
const OLUMI = { glyph: '◆', title: 'Proposed by Olumi' }
const bound = (text: string, olumi: typeof OLUMI | null, measured = true) => ({ text, title: text, olumi, measured })
const viewOf = (cards: ViewCard[], over: Record<string, unknown> = {}): View => ({ ...fx, model: { ...fx.model!, cards, ...over } } as unknown as View)
const mine = card({ id: 'aim_mine', family: 'goal', heading: 'Pay back within 12 months', bound: null, author: { by: 'person', text: 'Your words', title: '' } })
const olumiAim = card({ id: 'aim_olumi', family: 'goal', heading: 'Payback time within one year', olumi: OLUMI, bound: bound('at most 1 year', OLUMI) })
const limit = card({ id: 'lim_cap', family: 'limit', heading: 'Spend cap', bound: bound('at most £5,000', OLUMI), author: { by: 'person', text: 'Olumi’s wording of what you said', title: '' } })
const route = card({ id: 'opt_a', family: 'option', heading: 'Carry on as now', olumi: OLUMI })

beforeEach(() => { useFrameStage.setState({ open: false, armedFor: null }); useLaneInspector.setState({ current: null }) })
afterEach(cleanup)
const page = (v: View) => render(<FramePage view={v} onClose={() => undefined} />)

describe('the Frame page', () => {
  it('the question is the headline, and Edit is the first control; finding, routes and the count follow', () => {
    const v = viewOf([mine, limit, route, card({ id: 'f1', family: 'quantity', heading: 'x' })])
    page(v)
    expect(screen.getByTestId('frame-question').textContent).toBe(v.model!.question.text)
    const controls = [...screen.getByTestId('frame-page').querySelectorAll('button')]
    expect(controls[0]).toBe(screen.getByTestId('frame-edit-question'))
    expect(screen.getByTestId('frame-route-opt_a').textContent).toContain('Carry on as now')
    expect(screen.getByTestId('frame-more').textContent).toBe(moreCardsWords(1))
    expect(screen.getByTestId('frame-full-graph')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('frame-edit-aim_mine'))
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: 'aim_mine' } })
  })
  it('an Olumi bound on the person\'s own card is marked on the bound alone (not on the card, and no "yours")', () => {
    page(viewOf([limit]))
    const c = screen.getByTestId('frame-card-lim_cap')
    expect(c).not.toHaveAttribute('data-olumi-card')
    expect(c.querySelector('[data-frame="heading"] [data-olumi-mark], [data-frame="heading"] [data-person-mark]')).toBeNull()
    expect(c.querySelector('[data-frame="bound"] [data-olumi-mark]')).not.toBeNull()
    expect(c.querySelector('[data-person-mark]')).toBeNull()
    expect(within(c).getByText('at most £5,000')).toBeInTheDocument()
  })
  it('the person\'s aim and Olumi\'s aim are both shown, each with its own mark, never merged; a bound not measured reads "kept in words"', () => {
    page(viewOf([mine, olumiAim]))
    const a = screen.getByTestId('frame-card-aim_mine'), o = screen.getByTestId('frame-card-aim_olumi')
    expect(screen.getByTestId('frame-aims').querySelectorAll('li')).toHaveLength(2)
    expect(a.textContent).toContain('Pay back within 12 months'); expect(o.textContent).toContain('Payback time within one year')
    expect(a.querySelector('[data-person-mark]')).not.toBeNull(); expect(a.querySelector('[data-olumi-mark]')).toBeNull()
    expect(a.querySelector('[data-frame="bound"]')!.textContent).toBe('kept in words')
    expect(o).toHaveAttribute('data-olumi-card'); expect(o.querySelector('[data-olumi-mark]')).not.toBeNull(); expect(o.querySelector('[data-person-mark]')).toBeNull()
    expect(a.querySelector('[data-person-mark]')!.getAttribute('title')).toBe('Your words')
  })
  it('the finding is core\'s own words: most_likely.text, else the waits_on head, label and text', () => {
    const run = fx.model!.run
    if (run === null) throw new Error('the fixture must carry a run')
    const ml = { ...run, most_likely: { ...run.most_likely, text: 'CORE SAYS THIS' } }
    page(viewOf([mine], { run: ml }))
    expect(screen.getByTestId('frame-finding').textContent).toBe('CORE SAYS THIS')
    cleanup()
    page(viewOf([mine], { run: { ...run, most_likely: null, waits_on: { head: 'H', label: 'L', text: 'T', items: [] } } }))
    expect(screen.getByTestId('frame-finding').textContent).toBe('H L T')
  })
  it('no model yet: the question and "Build a model from this" only: no Edit, no Full graph', () => {
    page(viewOf([]))
    expect(screen.getByTestId('frame-no-model').textContent).toContain('No model yet')
    expect(screen.getByTestId('frame-build').textContent).toBe('Build a model from this')
    expect(screen.queryByTestId('frame-edit-question')).toBeNull(); expect(screen.queryByTestId('frame-full-graph')).toBeNull()
  })
})

describe('the stage', () => {
  const setView = (v: View) => useViewStore.setState({ uuid: 'u', sid: v.id, view: v, status: 'ready', error: null, stale: false, at: null })
  it('opens once when the scenario loads with a model; Full graph hides it; the opener brings it back and is pressed', () => {
    setView(viewOf([mine]))
    render(<><FrameOpener /><FrameStage /></>)
    expect(screen.getByTestId('frame-stage')).toBeInTheDocument()
    expect(screen.getByTestId('frame-opener')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('frame-full-graph'))
    expect(screen.queryByTestId('frame-stage')).toBeNull()
    fireEvent.click(screen.getByTestId('frame-opener'))
    expect(screen.getByTestId('frame-stage')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('frame-stage')).toBeNull()
  })
})
