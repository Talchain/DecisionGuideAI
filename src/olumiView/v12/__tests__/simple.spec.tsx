/** V12 Simple: every card and link is drawn at both levels (Simple removes text, not structure); each card kind has its visual; the pill switches per scenario. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useCanvasStore } from '../../../canvas/store'
import { useViewStore } from '../../store'
import { useViewCanvas, VIEW_CARD, VIEW_LINK } from '../../canvas'
import { drawnModelOf } from '../../layout'
import { levelOf, setDefaultLevel, showSimple, showWholeModel, useSimpleLevel } from '../simpleStore'
import { bandRowsOf, chanceWordsOf, SimpleFace } from '../SimpleFace'
import { SimpleSwitch } from '../SimpleSwitch'

vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../../canvas/hydrate/serverGraphHydration', async (real) => ({ ...(await real<object>()), hydrateCanvasFromServer: vi.fn(async () => 'merged') }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const SID = 's_0123456789ab'
const european: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/european.view3.json'), 'utf8'))
const model = european.model!
const whole = drawnModelOf(model)
const card = (id: string) => model.cards.find((c) => c.id === id)!
const face = (id: string, noted = false) => render(<SimpleFace card={card(id)} model={model} noted={noted} />)

beforeEach(() => {
  window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }); setDefaultLevel('simple')
  useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: true, currentScenarioId: null })
  useViewStore.setState({ uuid: 'a', sid: SID, view: european, status: 'ready', error: null })
})
afterEach(() => { setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' }) })

describe('V12 Simple draws the whole model', () => {
  it('S1 Simple and Detailed draw every card and every link of the model, in the same places', async () => {
    const { rerender } = renderHook(() => useViewCanvas(true))
    const ids = () => useCanvasStore.getState().nodes.filter((n) => n.type === VIEW_CARD).map((n) => n.id)
    const links = () => useCanvasStore.getState().edges.filter((e) => e.type === VIEW_LINK).length
    expect(levelOf(SID)).toBe('simple')
    await vi.waitFor(() => expect(ids()).toEqual(whole.cards.map((c) => c.id)))
    const simpleLinks = links()
    expect(whole.cards.length, 'CONTRAST: a model with many cards').toBeGreaterThan(10)
    expect(simpleLinks).toBeGreaterThan(10)
    act(() => showWholeModel(SID)); rerender()
    await vi.waitFor(() => expect(ids()).toEqual(whole.cards.map((c) => c.id)))
    expect(links()).toBe(simpleLinks)
  })
})

describe('V12 Simple faces', () => {
  it('S2 an option with a chance is a gauge: core\'s own value words and a track, no sentence', () => {
    const c = card('broader_entry'), words = chanceWordsOf(c)
    expect(words).not.toBeNull()
    const { container } = face('broader_entry')
    expect(container.querySelector('[data-simple-face="gauge"]')).not.toBeNull()
    expect(container.querySelector(`[data-simple-chance="broader_entry"]`)!.textContent).toBe(words)
    expect(container.querySelector('.ok-track')).not.toBeNull()
    expect(container.querySelector('[data-simple-face="no-chance"]')).toBeNull()
  })

  it('S4 a figure with a modelled band is one range bar per option on one axis, inside 0 to 100', () => {
    const rows = bandRowsOf(card('churn_rate'), model)
    expect(rows.length).toBe(card('churn_rate').values!.length)
    for (const r of rows) { expect(r.lo).toBeGreaterThanOrEqual(0); expect(r.hi).toBeLessThanOrEqual(100); expect(r.lo).toBeLessThanOrEqual(r.hi) }
    const { container } = face('churn_rate')
    expect(container.querySelectorAll('[data-simple-band]').length).toBe(rows.length)
    expect(container.querySelector('[data-simple-face="figure"]'), 'CONTRAST: a stated figure draws its words instead').toBeNull()
  })

  it('S5 a stated figure shows core\'s words on one line; a figure with no value is a dashed empty bar', () => {
    const { container } = face('starting_customers')
    expect(container.querySelector('[data-simple-face="figure"]')!.textContent).toBe(card('starting_customers').figure!.text)
    const empty = face('profitability').container
    expect(empty.querySelector('[data-simple-face="no-figure"]')).not.toBeNull()
    expect(empty.querySelector('[data-simple-face="figure"]')).toBeNull()
  })

  it('S6 a withheld chance is a dashed empty bar (a built case, since the fixture holds every chance)', () => {
    const opt = card('broader_entry')
    const built = { ...opt, headline: { ...opt.headline!, state: 'none' as const, why: 'A figure is missing' }, rows: [] }
    const { container } = render(<SimpleFace card={built as never} model={model} noted={false} />)
    const f = container.querySelector('[data-simple-face="no-chance"]')!
    expect(f.getAttribute('title')).toBe('A figure is missing')
    expect(container.querySelector('.ok-track')).toBeNull()
  })

  it('S7 an aim shows its bound and a target mark', () => {
    const { container } = face('reach_customer_target')
    expect(container.querySelector('[data-simple-face="target"]')!.textContent).toContain(card('reach_customer_target').bound!.text)
  })

  it('S8 authorship is a glyph (Olumi\'s or a person\'s) with the words on hover; Olumi\'s note is a badge only where it sits', () => {
    expect(face('horizon').container.querySelector('[data-simple-author="olumi"]')).not.toBeNull()
    expect(face('starting_customers').container.querySelector('[data-simple-author="person"]')!.getAttribute('title')).toBe(card('starting_customers').author!.text + (card('starting_customers').author!.title ? ` · ${card('starting_customers').author!.title}` : ''))
    expect(face('horizon', true).container.querySelector('[data-simple-note="horizon"]')).not.toBeNull()
    expect(face('horizon', false).container.querySelector('[data-simple-note]')).toBeNull()
  })
})

describe('V12 Simple | Detailed pill', () => {
  it('S9 two buttons; the choice is kept per scenario and another scenario is unaffected', () => {
    render(<SimpleSwitch />)
    expect(screen.getByTestId('view-level-simple').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('view-level-detailed'))
    expect(levelOf(SID)).toBe('working')
    expect(window.localStorage.getItem(`olumi.v12.level.${SID}`)).toBe('working')
    expect(levelOf('s_other')).toBe('simple')
    expect(screen.getByTestId('view-level-detailed').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('view-level-simple'))
    expect(levelOf(SID)).toBe('simple')
    act(() => showSimple(SID))
  })
})
