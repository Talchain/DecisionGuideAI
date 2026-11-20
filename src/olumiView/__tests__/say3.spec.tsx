/**
 * S4 lane say3 (Paul 18 Nov: "nothing said twice; a chart only when it shows a change"). Each row names what goes RED if its change is reverted.
 * 1. The Olumi tab at rest: the pinned finding is drawn only while the newest reply's headline (its typed `lead`) is not; a waiting proposal's status is not
 *    drawn beside the proposal's own foot; the dashed proposal strip is on Analysis only.
 * 2. An aim's measured bound is drawn once; the person's quote (core's `author.title`) stays on its mark.
 * 3. An option core calls fixed with a chance of 0 draws words only, no empty bar.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { tipOf } from './tipHelpers'
import type { View, ViewCard } from '../client'
import { ViewChat } from '../ViewChat'
import { ViewReasoningBlock } from '../ViewReasoning'
import { PortAnalysisTab } from '../port/PortAnalysisTab'
import { ChanceChart, CHART_WORDS } from '../port/ChanceChart'
import { SimpleFace } from '../v12/SimpleFace'
import { newestLeadDrawn } from '../early'
import { useDockFrontsOlumi } from '../findingSurface'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useMe } from '../../olumiCore/me'

const DIR = path.resolve('src/olumiView')
const session = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'fixtures/session', `${n}.view3.json`), 'utf8')) as View
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8')) as View
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
const FINDING = { text: 'An invented finding: on this model the first option is likely to meet the aim.', title: 'An invented long form.', figure: null, needs: null }
const withFinding = (v: View): View => { const c = structuredClone(v); (c.model!.run as { finding?: unknown }).finding = FINDING; return c }
const withLead = (v: View): View => {
  const c = structuredClone(v)
  const t = [...c.chat].reverse().find((x) => x.answer !== null)!;
  (t.answer as unknown as { lead: unknown }).lead = { opening: 'An invented short opening that is not the whole answer.', points: [] }
  return c
}
beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never); useDockFrontsOlumi.getState().set(true) })
afterEach(() => { cleanup(); useDockFrontsOlumi.getState().set(false); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('1. the Olumi tab at rest says the one fact once', () => {
  const base = (): View => withFinding({ ...golden('bakery'), chat: session('after-find-first').chat } as View)
  it('S1 the pinned finding is drawn while the newest reply has no lead; with a lead (its headline on screen) it is not. CONTRAST of the same View', () => {
    const v = base()
    expect(newestLeadDrawn(v), 'precondition: no lead yet').toBeNull()
    ready(v); const a = render(<ViewChat />).container
    expect(a.querySelector('[data-testid="view-chat-finding"]')).not.toBeNull()
    cleanup()
    const w = withLead(v)
    expect(newestLeadDrawn(w)).not.toBeNull()
    ready(w); const b = render(<ViewChat />).container
    expect([b.querySelector('[data-testid="view-chat-finding"]'), b.querySelectorAll('[data-reply-opening]').length > 0]).toEqual([null, true])
  })
  it('S2 the reply\'s status is core\'s words in the version icon\'s hover, with or without a waiting proposal; it is never drawn as text beside the foot (P4, system spec)', async () => {
    const STATUS = 'An invented status from core.'
    const held = golden('proposal')
    const stamped = (v: View, proposal: View['proposal']): View => ({ ...v, proposal, chat: v.chat.map((x, k) => (k === v.chat.length - 1 ? { ...x, status: STATUS } : x)) } as View)
    ready(stamped(held, held.proposal)); const a = render(<ViewChat />).container
    const latest = a.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')!
    expect([latest.querySelector('[data-view$=".status"]'), (await tipOf(latest.querySelector<HTMLElement>('[data-testid="view-chat-version"] [role="img"]')!)).includes(STATUS)]).toEqual([null, true])
    cleanup()
    ready(stamped(held, null)); const b = render(<ViewChat />).container
    // CHANGED BY DESIGN (P4): no proposal: the status is still not drawn as text; it is in the icon's hover (it was a visible line).
    expect([b.querySelector('[data-testid="view-chat-latest"] [data-view$=".status"]'), (await tipOf(b.querySelector<HTMLElement>('[data-testid="view-chat-latest"] [data-testid="view-chat-version"] [role="img"]')!)).includes(STATUS)]).toEqual([null, true])
  })
  it('S3 the dashed proposal strip is on Analysis only: Reasoning does not repeat it', () => {
    const held = golden('proposal')
    ready(held); render(<PortAnalysisTab />)
    expect(document.querySelectorAll('[data-testid="view-reasoning-state"]')).toHaveLength(1)
    cleanup()
    render(<ViewReasoningBlock />)
    expect(document.querySelectorAll('[data-testid="view-reasoning-state"]')).toHaveLength(0)
  })
})

describe('2. an aim\'s measured bound is drawn once', () => {
  const QUOTE = 'at least 100 tickets a week'
  const aim = (extra: Partial<ViewCard> & Record<string, unknown>): ViewCard => ({
    id: 'g', family: 'goal', heading: 'At least 100 a week', glyph: '*', figure: null, status: null, rows: [], premises: [],
    bound: { text: 'at least 100 tickets/week', title: 'at least 100 tickets/week', olumi: null, measured: true },
    author: { by: 'person', text: 'Stated by the team', title: `Theirs: “${QUOTE}”` }, description: QUOTE, ...extra } as unknown as ViewCard)
  const model = golden('bakery').model!
  const lines = (card: ViewCard) => render(<SimpleFace card={card} model={model} noted={false} />).container
  it('A1 core\'s description that is the quote in the card\'s own author.title is not drawn under the measured bound; the pill stays; the quote stays on the author hover', () => {
    const c = lines(aim({}))
    expect([c.querySelector('.ok-pill.ok-bound')?.textContent, c.querySelector('[data-simple-description]')]).toEqual(['at least 100 tickets/week', null])
    expect((aim({}).author as { title: string }).title).toContain(QUOTE)
  })
  it('A2 CONTRASTS: a description core did not quote (not in author.title), or an unmeasured bound, is still drawn', () => {
    const other = lines(aim({ description: 'by the end of the second quarter' }))
    expect(other.querySelector('[data-simple-description]')?.textContent).toBe('by the end of the second quarter')
    cleanup()
    const unmeasured = lines(aim({ bound: { text: 'not checked yet', title: 'not checked yet', olumi: null, measured: false } }))
    expect(unmeasured.querySelector('[data-simple-description]')?.textContent).toBe(QUOTE)
  })
})

describe('3. a never-met option draws words only', () => {
  const view = (): View => {
    const v = structuredClone(golden('bakery'))
    const o = v.model!.cards.filter((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))
    const first = o[0]!, row = first.rows.find((r) => r.kind === 'chance') as { chance: number; value: string }
    row.chance = 0; row.value = 'never met in this model'
    ;(first.headline as { state: string }).state = 'fixed'
    return v
  }
  it('N1 the fixed option with chance 0 has no track and its words stand; the first drawn bar carries the axis. CONTRAST: the other options keep their bars', () => {
    const v = view()
    const first = v.model!.cards.find((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))!
    render(<ChanceChart model={v.model!} />)
    const li = document.querySelector(`[data-chart-option="${first.id}"]`)!
    expect([li.querySelector('[data-testid="analysis-chance-track"]'), li.textContent?.includes('never met in this model')]).toEqual([null, true])
    const tracks = document.querySelectorAll('[data-testid="analysis-chance-track"]')
    expect(tracks.length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-testid="analysis-chart-axis"]')).toHaveLength(1)
    expect(document.querySelector('[data-testid="analysis-chart-axis"]')!.textContent).toBe(CHART_WORDS.axis.join(''))
    expect(screen.queryByTestId('analysis-chart-axis')!.closest('[data-chart-option]')!.getAttribute('data-chart-option')).not.toBe(first.id)
  })
})
