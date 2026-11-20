/**
 * C4 (system build, 20 Nov; Codex BLOCK, round 3): TWO marks that a card can wear together and a person can tell apart.
 *  - The RING is Olumi's alone, "Olumi asks about this card": the card core's newest next step is beside (`answer.next.at`) wears Olumi's mark, named by core's label.
 *  - The NUMBER is the listed question core ties to a card (`trial_questions[].id`): its place in the panel's numbered list, the question's words its name (UI-BRIEF-20261115 step 3).
 * Neither depends on the other, and neither draws a native title. Fixture: the served run-2 funding View.
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
import { chatQuestionsOf } from '../layout'

const RUN2 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json'), 'utf8')) as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, card: ViewCard): HTMLElement => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('the ring (the next step) and the number (a listed question) on a card', () => {
  const placed = (at: string | null): View => { const v = structuredClone(RUN2); for (const t of v.chat) if (t.answer?.next.newest === true) t.answer.next.at = at; return v }
  const marksOf = (view: View, level: 'simple' | 'working') => {
    setDefaultLevel(level)
    return view.model!.cards.map((card) => {
      const el = draw(view, card)
      const num = [...el.querySelectorAll<HTMLElement>('[data-question-n]')]
      const out = {
        id: card.id,
        rings: [...el.querySelectorAll<HTMLElement>('[data-olumi-asks]')].map((r) => r.getAttribute('aria-label')),
        numbers: num.map((n) => [n.getAttribute('data-question-n'), n.textContent, n.getAttribute('aria-label')]),
        titled: el.querySelector('[data-olumi-asks][title], [data-question-n][title]') !== null,
        // The two marks are different elements: one never sits inside the other.
        apart: num.every((n) => n.querySelector('[data-olumi-asks]') === null && n.closest('[data-olumi-asks]') === null),
      }
      cleanup()
      return out
    })
  }
  const listed = (): Array<{ id: string; n: number; text: string }> => chatQuestionsOf(RUN2.model).map((q, i) => ({ id: q.id as string, n: i + 1, text: q.text })).filter((q) => q.id !== null && RUN2.model!.cards.some((c) => c.id === q.id))
  const nextOf = () => RUN2.chat.find((t) => t.answer?.next.newest === true)!.answer!.next

  it('Q1 the card the newest step is beside wears ONE ring at both levels, named by core\'s label, with no native title; every other card wears none', () => {
    const next = nextOf()
    expect([next.at !== null, next.label !== ''], 'precondition: core names a card and a label').toEqual([true, true])
    for (const level of ['simple', 'working'] as const) {
      expect(marksOf(RUN2, level).map((m) => [m.id, m.rings, m.titled]), level).toEqual(RUN2.model!.cards.map((c) => [c.id, c.id === next.at ? [next.label] : [], false]))
    }
  })
  it('Q2 every card a listed question names wears that question\'s number, named by its words, at both levels, whether or not core puts the next step on a card; every other card wears none', () => {
    const want = listed()
    expect(chatQuestionsOf(RUN2.model).length, 'precondition: a numbered list (two or more questions)').toBeGreaterThanOrEqual(2)
    expect(want.length, 'precondition: a listed question names a card on this board').toBeGreaterThan(0)
    for (const level of ['simple', 'working'] as const) for (const view of [RUN2, placed(null)]) {
      expect(marksOf(view, level).map((m) => [m.id, m.numbers, m.titled]), `${level}`)
        .toEqual(RUN2.model!.cards.map((c) => { const q = want.find((w) => w.id === c.id); return [c.id, q === undefined ? [] : [[String(q.n), String(q.n), q.text]], false] }))
    }
  })
  it('Q3 the ring follows core\'s `next.at`: move the step to another card and the ring moves with it; where core names no card no card wears the ring (a listed question\'s card keeps its number)', () => {
    const other = RUN2.model!.cards.find((c) => c.id !== nextOf().at)!
    for (const level of ['simple', 'working'] as const) {
      expect(marksOf(placed(other.id), level).filter((m) => m.rings.length > 0).map((m) => m.id), level).toEqual([other.id])
      expect(marksOf(placed(null), level).filter((m) => m.rings.length > 0), `${level}, no next.at`).toEqual([])
    }
  })
  it('Q4 SIMULTANEOUS: a card that a listed question is about AND the next step is beside wears both marks, as two different elements; CONTRAST: the ring alone does not draw a number', () => {
    const q = listed()[0]!
    const both = placed(q.id)
    for (const level of ['simple', 'working'] as const) {
      const m = marksOf(both, level).find((x) => x.id === q.id)!
      expect([level, m.rings.length, m.numbers, m.apart, m.titled]).toEqual([level, 1, [[String(q.n), String(q.n), q.text]], true, false])
      const quiet = RUN2.model!.cards.find((c) => !listed().some((l) => l.id === c.id) && c.id !== q.id)!
      const ringOnly = marksOf(placed(quiet.id), level).find((x) => x.id === quiet.id)!
      expect([level, ringOnly.rings.length, ringOnly.numbers]).toEqual([level, 1, []])
    }
  })
})
