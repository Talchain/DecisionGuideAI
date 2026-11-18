/**
 * UI-BRIEF-20261115 step 3 (Paul, 15 Nov: "visualising it as much as it can … It's not intuitive at all"): each of Olumi's questions that core
 * ties to a card (trial_questions[].id) puts its number from the panel's numbered list on that card, with the question's words as its hover.
 * Bound by core's id and the list's own order (chatQuestionsOf, as ViewChat draws it). Fixture: the served run-2 funding View.
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
import { CoreCard, questionRingOf } from '../previous/CoreCard'
import { chatQuestionsOf } from '../layout'

const RUN2 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json'), 'utf8')) as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, card: ViewCard): HTMLElement => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('a question\'s number on the card it is about', () => {
  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences; v12/detailed): on Detailed the mark is Olumi's own in its ring
  // (Paul's capture: numbered circles sat on the figures), the question's words its name; Simple keeps the number (v12/__tests__ owns Simple).
  it('Q1 every card a listed question names carries Olumi\'s mark named by that question\'s words, no number; every other card carries none', () => {
    const qs = chatQuestionsOf(RUN2.model)
    expect(qs.length, 'precondition: a numbered list (two or more questions)').toBeGreaterThanOrEqual(2)
    const named = qs.map((q, i) => ({ id: q.id, n: i + 1, text: q.text })).filter((q) => q.id !== null && RUN2.model!.cards.some((c) => c.id === q.id))
    expect(named.length, 'precondition: a listed question names a card on this board').toBeGreaterThan(0)
    for (const card of RUN2.model!.cards) {
      const el = draw(RUN2, card)
      const ring = el.querySelector<HTMLElement>(`[data-question-ring="${card.id}"]`)
      const want = named.find((q) => q.id === card.id)
      const mark = ring?.querySelector<HTMLElement>('[data-olumi-asks]') ?? null
      expect(ring === null ? null : [ring.textContent, mark?.getAttribute('title'), mark?.getAttribute('aria-label')], card.id)
        .toEqual(want === undefined ? null : ['', want.text, want.text])
      cleanup()
    }
  })
  it('Q2 must not change: a question core gives no id marks no card; with only one question the list is not numbered and no card is marked', () => {
    const one = structuredClone(RUN2); one.model!.trial_questions = one.model!.trial_questions!.slice(1, 2); one.model!.coaching_questions = []
    expect(chatQuestionsOf(one.model).length).toBe(1)
    for (const c of one.model!.cards) {
      expect(questionRingOf(one.model, c.id), c.id).toBeNull()
      expect(draw(one, c).querySelector('[data-question-ring]'), `drawn ${c.id}`).toBeNull(); cleanup()
    }
    const coachingOnly = structuredClone(RUN2); coachingOnly.model!.trial_questions = []; coachingOnly.model!.coaching_questions = [...RUN2.model!.coaching_questions!, RUN2.model!.coaching_questions![0]! + ' (2)']
    expect(chatQuestionsOf(coachingOnly.model).length, 'a numbered list of questions with no id').toBe(2)
    for (const c of coachingOnly.model!.cards) {
      expect(questionRingOf(coachingOnly.model, c.id), c.id).toBeNull()
      expect(draw(coachingOnly, c).querySelector('[data-question-ring]'), `drawn ${c.id}`).toBeNull(); cleanup()
    }
  })
})
