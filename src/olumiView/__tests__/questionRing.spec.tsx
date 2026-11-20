/**
 * C4 (system build, 20 Nov): ONE ring, Olumi's alone, meaning "Olumi asks about this card": the card core's newest next step is beside (`answer.next.at`)
 * wears Olumi's mark in a ring, named by core's label for the step, on Simple and on Detailed. It replaces UI-BRIEF-20261115 step 3 (a question's
 * number on the card a listed question names): that numbered circle and its second ring are gone, so no card wears two. Fixture: the served run-2 funding View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { CoreCard } from '../previous/CoreCard'
import { setDefaultLevel } from '../v12/simpleStore'

const RUN2 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json'), 'utf8')) as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, card: ViewCard): HTMLElement => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('the one ring: Olumi asks about this card', () => {
  const placed = (at: string | null): View => { const v = structuredClone(RUN2); for (const t of v.chat) if (t.answer?.next.newest === true) t.answer.next.at = at; return v }
  const ringsOf = (view: View, level: 'simple' | 'working') => {
    setDefaultLevel(level)
    return view.model!.cards.map((card) => {
      const el = draw(view, card)
      const out = { id: card.id, rings: [...el.querySelectorAll<HTMLElement>('[data-olumi-asks]')].map((r) => r.getAttribute('aria-label')), titled: el.querySelector('[data-olumi-asks][title]') !== null, numbered: el.querySelector('[data-question-n]') !== null }
      cleanup()
      return out
    })
  }
  it('Q1 the card the newest step is beside wears ONE ring at both levels, named by core\'s label, with no native title and no number; every other card wears none', () => {
    const next = RUN2.chat.find((t) => t.answer?.next.newest === true)!.answer!.next
    expect([next.at !== null, next.label !== ''], 'precondition: core names a card and a label').toEqual([true, true])
    for (const level of ['simple', 'working'] as const) {
      expect(ringsOf(RUN2, level), level).toEqual(RUN2.model!.cards.map((c) => ({ id: c.id, rings: c.id === next.at ? [next.label] : [], titled: false, numbered: false })))
    }
  })
  it('Q2 CONTRAST: where core names no card for the step, no card wears the ring, even a card a listed question is about (the question-number marker is gone)', () => {
    const tied = RUN2.model!.trial_questions!.filter((q) => q.id !== null && RUN2.model!.cards.some((c) => c.id === q.id))
    expect(tied.length, 'precondition: a listed question names a card on this board').toBeGreaterThan(0)
    for (const level of ['simple', 'working'] as const) expect(ringsOf(placed(null), level).filter((r) => r.rings.length > 0 || r.numbered), level).toEqual([])
  })
  it('Q3 the ring follows core\'s `next.at`: move the step to another card and the ring moves with it', () => {
    const other = RUN2.model!.cards.find((c) => c.id !== RUN2.chat.find((t) => t.answer?.next.newest === true)!.answer!.next.at)!
    for (const level of ['simple', 'working'] as const) expect(ringsOf(placed(other.id), level).filter((r) => r.rings.length > 0).map((r) => r.id), level).toEqual([other.id])
  })
})
