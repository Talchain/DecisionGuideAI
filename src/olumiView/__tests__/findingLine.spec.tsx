/**
 * One finding line (experience review 18 Nov, change 1): core's `model.run.finding` drawn verbatim on the question card (both levels) and at the top of
 * the Olumi panel; its title the hover; its figure one press to that card; `needs` only when not null; nothing at all where the field is absent.
 * Fixture: the bakery View from the wire with an invented finding spread onto its run.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
const press = vi.hoisted(() => vi.fn())
vi.mock('../reasoning/tabRing', async () => ({ ...(await vi.importActual<object>('../reasoning/tabRing')), pressCard: press }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { tipOf, tipOnFocus } from './tipHelpers'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { CoreCard } from '../previous/CoreCard'
import { ViewChat } from '../ViewChat'
import { QUESTION } from '../layout'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useMe } from '../../olumiCore/me'
import { setDefaultLevel, useSimpleLevel, type Level } from '../v12/simpleStore'
import { findingOf, hasAnyResult } from '../v12/contract'
import { findingSurfaceOf, useDockFrontsOlumi } from '../findingSurface'
import { FINDING_FIGURE } from '../FindingLine'

const served = structuredClone(JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8'))) as View
const CARD = served.model!.cards[1]!
const F = { text: 'An invented finding: on this model the first option is likely to meet the aim.', title: 'An invented long form of the finding.', figure: CARD.id, needs: 'An invented need: a figure for the sales target.' }
const withFinding = (finding: unknown): View => { const v = structuredClone(served); (v.model!.run as { finding?: unknown }).finding = finding; return v }

/** The same View with no calculated result on any option: the panel draws no finding, so the question card keeps the figure and the needs line. */
const noResult = (v: View): View => { const c = structuredClone(v); for (const card of c.model!.cards) if (card.family === 'option' && card.headline != null) (card.headline as { state: string }).state = 'none'; return c }

const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const load = (view: View, level: Level) => {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
const question = (view: View, level: Level): HTMLElement => {
  load(view, level); useDockFrontsOlumi.getState().set(false)
  return render(<ReactFlowProvider><Node {...({ id: QUESTION, type: 'viewQuestion', data: { question: view.model!.question }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
const panel = (view: View): HTMLElement => { load(view, 'simple'); useDockFrontsOlumi.getState().set(true); return render(<ViewChat />).container }
const FRONTED = { olumiFronted: true, frameShown: false }
const lines = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-view="run.finding"]')]

beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never); press.mockClear() })
afterEach(() => {
  cleanup(); useDockFrontsOlumi.getState().set(false); setDefaultLevel('simple'); useSimpleLevel.setState({ levels: {} })
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' })
})

describe('the one finding line', () => {
  it('FL1 the same finding survives on the question card at both levels, ready when the Olumi panel is hidden', () => {
    expect(findingSurfaceOf(withFinding(F), FRONTED), 'precondition: the panel can draw it on this View').toBe('panel')
    for (const level of ['simple', 'working'] as const) {
      const q = question(withFinding(F), level)
      expect(lines(q).map((line) => line.textContent)).toEqual([F.text])
      expect(q.querySelector(`[data-finding-figure="${CARD.id}"]`)).not.toBeNull()
      expect(q.querySelector('[data-view="run.finding.needs"]')?.textContent).toBe(F.needs)
      cleanup()
    }
    const q = question(noResult(withFinding(F)), 'simple')
    expect([findingSurfaceOf(noResult(withFinding(F)), FRONTED), q.querySelectorAll(`[data-finding-figure="${CARD.id}"]`).length, q.querySelectorAll('[data-view="run.finding.needs"]').length]).toEqual(['question', 1, 1])
  })
  it.each([
    ['the same opening', F.text, []],
    ['a different opening', 'Core has a different finding.', [F.text]],
    ['an opening with one extra space', F.text + ' ', [F.text]],
  ] as const)('compares the finding with %s of the latest reply', (_, opening, expected) => {
    const v = withFinding(F)
    const session = JSON.parse(readFileSync('src/olumiView/fixtures/session/after-find-first.view3.json', 'utf8')) as View
    const source = session.chat.find((t) => t.answer !== null)!
    v.chat = [F.text, opening].map((line, i) => ({
      ...source, id: i + 1, answer: { ...source.answer!, lead: { opening: line, points: [] } },
    }))
    const chat = panel(v)
    expect(chat.querySelector('[data-view="chat.1.answer.lead.opening"]')?.textContent).toBe(opening)
    cleanup()
    const q = question(v, 'simple')
    expect(lines(q).map((line) => line.textContent)).toEqual(expected)
    expect(q.querySelector('[data-view="run.finding.needs"]')?.textContent).toBe(F.needs)
    expect(q.querySelector(`[data-finding-figure="${CARD.id}"]`)).not.toBeNull()
  })

  it('uses the opening of a newer standalone floor reply', () => {
    const v = withFinding(F)
    v.floor = [{ job: 100, at: '2026-11-26T12:00:00Z', by: v.you, by_id: v.you_id,
      said: 'What changed?', text: 'Full reply from Core.', lead: { opening: F.text, points: [] } }]
    const chat = panel(v)
    expect(chat.querySelector('[data-view="floor.100.lead.opening"]')?.textContent).toBe(F.text)
    cleanup()
    expect(lines(question(v, 'working'))).toEqual([])
  })

  it('FL2 the top of the Olumi panel draws the same sentence once, above the next step, title on hover (the one Tip, by pointer and by keyboard focus)', async () => {
    const c = panel(withFinding(F)), w = lines(c)
    expect([w.length, w[0]?.textContent, w[0]?.hasAttribute('title'), await tipOf(w[0]!), await tipOnFocus(w[0]!)]).toEqual([1, F.text, false, F.title, F.title])
    expect(c.querySelector('[data-testid="view-chat-finding"]')).not.toBeNull()
  })
  it('FL2b where NO option has a calculated result the finding is a status the reply already says: not above the conversation, not on the question card either (the aim card says it). CONTRASTS: one option with a result (an incomplete comparison) keeps the row; a fixed result counts', () => {
    const states = (v: View, state: (i: number) => string): View => { const c = structuredClone(v); let i = 0; for (const card of c.model!.cards) if (card.family === 'option' && card.headline != null) (card.headline as { state: string }).state = state(i++); return c }
    const STATUS = { text: 'The chance cannot be worked out yet: the aim has no measure.', title: 'The chance cannot be worked out yet: the aim has no measure.', figure: null, needs: null }
    expect(served.model!.cards.filter((c) => c.family === 'option' && c.headline != null).length, 'precondition: the fixture has option headlines').toBeGreaterThan(1)
    const none = states(withFinding(STATUS), () => 'none')
    expect([hasAnyResult(none.model), panel(none).querySelector('[data-testid="view-chat-finding"]')]).toEqual([false, null])
    cleanup()
    // FL2c (Paul 19 Nov, said once): the aim card already says it, so the question card does not draw the sentence while no option has a result.
    expect(lines(question(none, 'simple')).map((e) => e.textContent), 'the question card does not repeat it').toEqual([])
    cleanup()
    expect(lines(question(states(withFinding(STATUS), (i) => (i === 0 ? 'chance' : 'none')), 'simple')).map((e) => e.textContent)).toEqual([STATUS.text])
    cleanup()
    const withFigure = states(withFinding({ ...STATUS, figure: CARD.id, needs: 'Name a target.' }), () => 'none')
    const q2 = question(withFigure, 'simple')
    expect([lines(q2).length, q2.querySelectorAll(`[data-finding-figure="${CARD.id}"]`).length, q2.querySelectorAll('[data-view="run.finding.needs"]').length], 'no sentence, figure button and needs row kept').toEqual([0, 1, 1])
    cleanup()
    const partial = states(withFinding(STATUS), (i) => (i === 0 ? 'chance' : 'none'))
    expect([hasAnyResult(partial.model), lines(panel(partial)).map((e) => e.textContent)]).toEqual([true, [STATUS.text]])
    cleanup()
    const fixed = states(withFinding(STATUS), (i) => (i === 0 ? 'fixed' : 'none'))
    expect([hasAnyResult(fixed.model), panel(fixed).querySelector('[data-testid="view-chat-finding"]') !== null]).toEqual([true, true])
  })
  it('FL3 the figure\'s heading presses to that card, on the question card (where the panel draws no finding) and in the panel', async () => {
    const q = question(noResult(withFinding(F)), 'simple')
    const b = q.querySelector<HTMLElement>(`[data-finding-figure="${CARD.id}"]`)!
    // The figure is named (mark + hover and accessible name), never a bare card heading.
    expect([b.hasAttribute('title'), await tipOf(b), b.getAttribute('aria-label'), b.querySelectorAll('svg').length, b.textContent]).toEqual([false, `${FINDING_FIGURE}: ${CARD.heading}`, `${FINDING_FIGURE}: ${CARD.heading}`, 1, CARD.heading])
    expect(b.textContent).toBe(CARD.heading)
    fireEvent.click(b)
    expect(press).toHaveBeenCalledWith(CARD.id)
    cleanup(); press.mockClear()
    fireEvent.click(panel(withFinding(F)).querySelector<HTMLElement>(`[data-finding-figure="${CARD.id}"]`)!)
    expect(press).toHaveBeenCalledWith(CARD.id)
  })
  it('FL4 needs is drawn only when not null; a figure that is no card draws no button', () => {
    const on = (v: View) => [question(noResult(v), 'simple').querySelectorAll('[data-view="run.finding.needs"]').length, document.querySelectorAll('[data-finding-figure]').length]
    expect(on(withFinding(F))).toEqual([1, 1])
    cleanup()
    expect(on(withFinding({ ...F, needs: null, figure: null }))).toEqual([0, 0])
    cleanup()
    expect(on(withFinding({ ...F, figure: 'no_such_card' }))).toEqual([1, 0])
  })
  it('FL5 CONTRAST: no field (absent, null or empty text) draws nothing in either place, and the question card is as it was', () => {
    const before = question(served, 'simple').innerHTML
    cleanup()
    for (const v of [served, withFinding(null), withFinding({ ...F, text: '' })]) {
      const q = question(v, 'simple')
      expect([lines(q).length, q.querySelectorAll('[data-finding]').length, q.innerHTML]).toEqual([0, 0, before])
      cleanup()
      const p = panel(v)
      expect([lines(p).length, p.querySelector('[data-testid="view-chat-finding"]')]).toEqual([0, null])
      cleanup()
    }
    expect(findingOf({ run: { finding: { text: 'x', title: '', figure: '', needs: '' } } })).toEqual({ text: 'x', title: 'x', figure: null, needs: null })
  })
})
