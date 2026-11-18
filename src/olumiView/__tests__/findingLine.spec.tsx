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
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { CoreCard } from '../previous/CoreCard'
import { ViewChat } from '../ViewChat'
import { QUESTION } from '../layout'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useMe } from '../../olumiCore/me'
import { setDefaultLevel, useSimpleLevel, type Level } from '../v12/simpleStore'
import { findingOf } from '../v12/contract'

const served = structuredClone(JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8'))) as View
const CARD = served.model!.cards[1]!
const F = { text: 'An invented finding: on this model the first option is likely to meet the aim.', title: 'An invented long form of the finding.', figure: CARD.id, needs: 'An invented need: a figure for the sales target.' }
const withFinding = (finding: unknown): View => { const v = structuredClone(served); (v.model!.run as { finding?: unknown }).finding = finding; return v }

const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const load = (view: View, level: Level) => {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
const question = (view: View, level: Level): HTMLElement => {
  load(view, level)
  return render(<ReactFlowProvider><Node {...({ id: QUESTION, type: 'viewQuestion', data: { question: view.model!.question }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
const panel = (view: View): HTMLElement => { load(view, 'simple'); return render(<ViewChat />).container }
const lines = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-view="run.finding"]')]

beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never); press.mockClear() })
afterEach(() => {
  cleanup(); setDefaultLevel('simple'); useSimpleLevel.setState({ levels: {} })
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' })
})

describe('the one finding line', () => {
  it('FL1 the question card draws core\'s sentence once, verbatim, at both levels; its title is the hover', () => {
    for (const level of ['simple', 'working'] as const) {
      const w = lines(question(withFinding(F), level))
      expect([level, w.length, w[0]?.textContent, w[0]?.title]).toEqual([level, 1, F.text, F.title])
      cleanup()
    }
  })
  it('FL2 the top of the Olumi panel draws the same sentence once, above the next step, title on hover', () => {
    const c = panel(withFinding(F)), w = lines(c)
    expect([w.length, w[0]?.textContent, w[0]?.title]).toEqual([1, F.text, F.title])
    expect(c.querySelector('[data-testid="view-chat-finding"]')).not.toBeNull()
  })
  it('FL3 the figure\'s heading presses to that card, on the question card and in the panel', () => {
    const q = question(withFinding(F), 'simple')
    const b = q.querySelector<HTMLElement>(`[data-finding-figure="${CARD.id}"]`)!
    expect(b.textContent).toBe(CARD.heading)
    fireEvent.click(b)
    expect(press).toHaveBeenCalledWith(CARD.id)
    cleanup(); press.mockClear()
    fireEvent.click(panel(withFinding(F)).querySelector<HTMLElement>(`[data-finding-figure="${CARD.id}"]`)!)
    expect(press).toHaveBeenCalledWith(CARD.id)
  })
  it('FL4 needs is drawn only when not null; a figure that is no card draws no button', () => {
    const on = (v: View) => [question(v, 'simple').querySelectorAll('[data-view="run.finding.needs"]').length, document.querySelectorAll('[data-finding-figure]').length]
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
