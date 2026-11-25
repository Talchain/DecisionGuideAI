/**
 * The Frame page (spec framing-20261119/mock/SPEC.md, build-now rows 1, 3, 4, 5, 8, 9 and "No model yet"). Cards are bound by id and exact label.
 * Fields are invented over the effects fixture's own cards.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useLaneInspector } from '../../edit/inspectorStore'
import { FRAME_WORDS, FramePage, moreCardsWords } from '../FramePage'
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
// The page is drawn as FrameStage draws it: the View is the store's and the Frame is open (findingSurfaceOf names the Frame for the finding).
const page = (v: View) => { useViewStore.setState({ view: v } as never); useFrameStage.setState({ open: true }); return render(<FramePage view={v} onClose={() => undefined} />) }

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
    expect(screen.getByTestId('frame-edit-question').textContent, 'says what it does: it asks, it does not edit in place').toBe(FRAME_WORDS.askChange)
    fireEvent.click(screen.getByTestId('frame-edit-aim_mine'))
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: 'aim_mine' } })
  })
  it('#2 each route says its chance at rest in core\'s headline words; a withheld chance says nothing on the route', () => {
    const chance = { state: 'chance', text: 'about 51% chance', title: 'Chance of the aim', why: null, add: null, aim_id: null }
    const withheld = { state: 'none', text: 'No chance yet', title: 'Every option waits on a figure.', why: 'It needs a size for one link.', add: null, aim_id: null }
    page(viewOf([card({ id: 'opt_x', family: 'option', heading: 'Hire one', headline: chance }), card({ id: 'opt_y', family: 'option', heading: 'Hire two', headline: withheld })]))
    expect(screen.getByTestId('frame-route-opt_x').querySelector('[data-view="opt_x.headline.text"]')?.textContent).toContain('about 51% chance')
    expect([screen.getByTestId('frame-route-opt_y').querySelector('[data-view$=".headline.text"]'), screen.getByTestId('frame-route-opt_y').textContent]).toEqual([null, 'Hire two'])
  })
  it('#2 scope (Codex): core\'s run lead says once what the chances are of; a route whose chance is another aim\'s names that aim by its heading; no chance shown, no lead', () => {
    const LEAD = 'Chance of ‘Handle 160 calls a day’, in this model on current information'
    const on = (aim: string | null) => ({ state: 'chance', text: 'about 51% chance', title: 't', why: null, add: null, aim_id: aim })
    const other = card({ id: 'aim_cost', family: 'goal', heading: 'Stay within £40,000' })
    const run = { ...fx.model!.run, aim: 'aim_calls', lead: LEAD }
    page(viewOf([other, card({ id: 'opt_x', family: 'option', heading: 'Hire one', headline: on('aim_calls') }), card({ id: 'opt_z', family: 'option', heading: 'Hire two', headline: on('aim_cost') })], { run }))
    expect(screen.getAllByText(LEAD)).toHaveLength(1)
    expect([screen.getByTestId('frame-route-opt_x').textContent, screen.getByTestId('frame-route-opt_z').textContent]).toEqual(['Hire one · about 51% chance', 'Hire two · about 51% chance (Stay within £40,000)'])
    cleanup()
    page(viewOf([card({ id: 'opt_y', family: 'option', heading: 'Hire two', headline: { ...on('aim_calls'), state: 'none', why: 'Needs a size.' } })], { run }))
    expect(screen.queryByText(LEAD)).toBeNull()
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
  it('the person\'s aim and Olumi\'s aim are both shown, each with its own mark, never merged; an aim with no bound draws no bound line (PL a350f889)', () => {
    page(viewOf([mine, olumiAim]))
    const a = screen.getByTestId('frame-card-aim_mine'), o = screen.getByTestId('frame-card-aim_olumi')
    expect(screen.getByTestId('frame-aims').querySelectorAll('li')).toHaveLength(2)
    expect(a.textContent).toContain('Pay back within 12 months'); expect(o.textContent).toContain('Payback time within one year')
    expect(a.querySelector('[data-person-mark]')).not.toBeNull(); expect(a.querySelector('[data-olumi-mark]')).toBeNull()
    expect(a.querySelector('[data-frame="bound"]')).toBeNull()
    expect(o).toHaveAttribute('data-olumi-card'); expect(o.querySelector('[data-olumi-mark]')).not.toBeNull(); expect(o.querySelector('[data-person-mark]')).toBeNull()
    expect(a.querySelector('[data-person-mark]')!.getAttribute('aria-label')).toBe('Your words')
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
  it('the Frame exposes the same typed finding as the panel when it exists, with the earlier model words as fallback', () => {
    const run = fx.model!.run
    if (run === null) throw new Error('the fixture must carry a run')
    const withResult = { ...route, headline: { state: 'chance' } } as unknown as ViewCard
    const finding = { text: 'PANEL SAYS THIS', title: 'PANEL SAYS THIS', figure: null, needs: null }
    page(viewOf([mine, withResult], { run: { ...run, finding } }))
    expect(document.querySelector('[data-finding="frame"] [data-view="run.finding"]')).toHaveTextContent(finding.text)
    expect(screen.queryByTestId('frame-finding')).toBeNull()
    cleanup()
    page(viewOf([mine, withResult], { run: { ...run, finding: null } }))
    expect(screen.getByTestId('frame-finding')).toBeInTheDocument()
    cleanup()
    page(viewOf([mine, route], { run: { ...run, finding } }))
    expect(document.querySelector('[data-finding="frame"] [data-view="run.finding"]')).toHaveTextContent(finding.text)
  })
  it('no model yet: the question and "Build a model from this" only: no Edit, no Full graph', () => {
    page(viewOf([]))
    expect(screen.getByTestId('frame-no-model').textContent).toContain('No model yet')
    expect(screen.getByTestId('frame-build').textContent).toBe('Build a model from this')
    expect(screen.queryByTestId('frame-edit-question')).toBeNull(); expect(screen.queryByTestId('frame-full-graph')).toBeNull()
  })
})

describe('an Olumi bound is marked on the bound alone whether or not it is measured', () => {
  it('measured or not, the bound line is Core\'s own words with the mark on Olumi\'s bounds alone (PL a350f889)', () => {
    const unmeasured = card({ id: 'lim_u', family: 'limit', heading: 'Cap', bound: bound('hidden words', OLUMI, false) })
    const plain = card({ id: 'lim_p', family: 'limit', heading: 'Cap two', bound: bound('hidden words', null, false) })
    page(viewOf([limit, unmeasured, plain]))
    const at = (id: string) => screen.getByTestId(`frame-card-${id}`).querySelector('[data-frame="bound"]')!
    expect(at('lim_cap').textContent).toBe('at most £5,000'); expect(at('lim_cap').querySelector('[data-olumi-mark]')).not.toBeNull()
    expect(at('lim_u').textContent).toBe('hidden words'); expect(at('lim_u').querySelector('[data-olumi-mark]')).not.toBeNull()
    expect(at('lim_p').textContent).toBe('hidden words'); expect(at('lim_p').querySelector('[data-olumi-mark]')).toBeNull()
  })
})

describe('the Question frame says Core\'s bound words (PL a350f889)', () => {
  it('draws the bound text verbatim whenever Core supplies a bound', () => {
    const uncheckedLimit = 'at most £5,000; not checked yet: nothing in the model is counted against it'
    page(viewOf([
      card({ id: 'aim_waiting', family: 'goal', bound: bound('needs a target', null, false) }),
      card({ id: 'aim_budget', family: 'goal', bound: bound('£40,000', null, false) }),
      card({
        id: 'budget_bar', family: 'quantity', bar_of: 'aim_budget',
        figure: { text: '£40,000', title: '£40,000', edit: { prompt: 'New figure', ask: 'Type a new figure.' } },
      }),
      card({ id: 'limit_unchecked', family: 'limit', bound: bound(uncheckedLimit, null, false) }),
      card({ id: 'aim_words', family: 'goal', bound: bound('kept in words, not measured', null, false) }),
      card({ id: 'aim_measured', family: 'goal', bound: bound('at least 20%', null) }),
      card({ id: 'aim_no_bound', family: 'goal', bound: null }),
    ]))
    const cardAt = (id: string) => screen.getByTestId(`frame-card-${id}`)
    const boundAt = (id: string) => cardAt(id).querySelector('[data-frame="bound"]')
    expect(boundAt('aim_waiting')?.textContent).toBe('needs a target')
    expect(boundAt('aim_budget')?.textContent).toBe('£40,000')
    expect(cardAt('aim_budget').textContent).not.toContain('kept in words')
    expect(cardAt('aim_budget').textContent).not.toContain('chance')
    expect(boundAt('limit_unchecked')?.textContent).toBe(uncheckedLimit)
    expect(boundAt('aim_words')?.textContent).toBe('kept in words, not measured')
    expect(boundAt('aim_measured')?.textContent).toBe('at least 20%')
    expect(boundAt('aim_no_bound')).toBeNull()
  })
})

/** The spec's own measure (SPEC.md "Result"): words, controls, objects, on every stored View with a model, drawn in jsdom. */
describe('the build-now page on the stored Views: the spec\'s budget', () => {
  const root = path.resolve('src/olumiView/fixtures')
  const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []))
  const views = files(root).flatMap((f) => { try { const v = JSON.parse(readFileSync(f, 'utf8')) as View; return v?.model?.cards?.length ? [v] : [] } catch { return [] } })
  const words = (el: Element) => (el.textContent ?? '').split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length
  it('every stored View with a model fits 15 controls and 10 card objects; with a finding of 25 words or fewer it fits 150 words', () => {
    expect(views.length, 'the fixtures must hold Views with a model').toBeGreaterThan(10)
    const over: string[] = []
    for (const v of views) {
      page(v)
      const el = screen.getByTestId('frame-page')
      const f = screen.queryByTestId('frame-finding')
      const short = f === null || words(f) <= 25
      const controls = el.querySelectorAll('button').length, objects = el.querySelectorAll('li').length
      if (controls > 15 || objects > 10 || (short && words(el) > 150)) over.push(`${v.id}: controls ${controls}, objects ${objects}, words ${words(el)}`)
      cleanup()
    }
    expect(over).toEqual([])
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
