/**
 * Answer in place, the UI half of dl-takeover/question-answer/CONTRACT.md: a typed question (`model.questions`) is answered where it is
 * asked, through core's answer route bound to its id; core's 409 sentence is shown as it is and the words are kept (re-sent under the same
 * op); the chat's question card resolves the same id (one answer path). CONTRASTS: an older core (no `model.questions`) draws today's tab
 * (text questions, no box); a past version offers no box.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const api = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('../../../olumiCore/team/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../olumiCore/team/api')>()), call: api.call }))
const focus = vi.hoisted(() => ({ node: vi.fn() }))
vi.mock('../../../canvas/utils/focusHelpers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../canvas/utils/focusHelpers')>()), focusNodeById: focus.node }))

import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { TeamApiError } from '../../../olumiCore/team/api'
import { StartHere, ViewReasoningBlock } from '../../ViewReasoning'
import { chatQuestionsOf } from '../../layout'

const read = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden/app-launch.view.json'), 'utf8'))
const Q = { id: 'q0123456789', text: 'How many weeks are left before the release must ship?', about: null as string | null, role: 'due', unit: 'week' }
const typed = (examined: unknown[] = []): View => {
  const view = read()
  const aim = view.model!.cards[0]!
  ;(view.model as unknown as { questions: unknown[] }).questions = [{ ...Q, about: aim.id }]
  ;(view as unknown as { reasoning: unknown }).reasoning = { examined }
  return view
}
const ready = (view: View, more: object = {}) => {
  const refresh = vi.fn(async () => true)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null, refresh, ...more } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return refresh
}
const answer = async (words: string) => {
  fireEvent.change(screen.getAllByTestId('reasoning-answer-input')[0]!, { target: { value: words } })
  await act(async () => { fireEvent.click(screen.getAllByTestId('reasoning-answer-send')[0]!) })
}
afterEach(() => { cleanup(); api.call.mockReset(); focus.node.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('answer in place (CONTRACT §2-§3)', () => {
  it('a typed question is answered where it is asked: core\'s answer route, bound to its id, then the View is read again', async () => {
    const view = typed()
    const refresh = ready(view)
    api.call.mockResolvedValue({})
    render(<ViewReasoningBlock />)
    expect(document.querySelector(`[data-answer-for="${Q.id}"]`)).not.toBeNull()
    await answer('12')
    expect(api.call).toHaveBeenCalledTimes(1)
    const [method, route, body] = api.call.mock.calls[0]!
    expect([method, route, body.question_id, body.text, typeof body.op]).toEqual(['POST', `/api/scenarios/${view.id}/answer`, Q.id, '12', 'string'])
    expect(refresh).toHaveBeenCalled()
  })
  it('core\'s 409 sentence is shown as it is, the words are kept, and pressing again re-sends under the SAME op', async () => {
    ready(typed())
    api.call.mockRejectedValueOnce(new TeamApiError(409, 'That question is no longer asked on the model you see.', false, 'question_stale'))
    render(<ViewReasoningBlock />)
    await answer('12')
    expect(screen.getByTestId('reasoning-answer-error').textContent).toBe('That question is no longer asked on the model you see.')
    expect((screen.getAllByTestId('reasoning-answer-input')[0] as HTMLInputElement).value).toBe('12')
    api.call.mockResolvedValueOnce({})
    await act(async () => { fireEvent.click(screen.getAllByTestId('reasoning-answer-send')[0]!) })
    expect(api.call.mock.calls[1]![2].op).toBe(api.call.mock.calls[0]![2].op)
  })
  it('CONTRAST: an older core (no model.questions) draws today\'s text questions with no answer box; a past version offers no box', () => {
    ready(read())
    render(<ViewReasoningBlock />)
    expect(screen.queryAllByTestId('reasoning-answer-input')).toHaveLength(0)
    expect(screen.getAllByTestId('reasoning-question').length).toBeGreaterThan(0)
    cleanup()
    ready(typed(), { at: 2 })
    render(<ViewReasoningBlock />)
    expect(screen.queryAllByTestId('reasoning-answer-input')).toHaveLength(0)
  })
})

describe('the chat\'s question card: bound by core\'s typed id, never by words (CONTRACT §6)', () => {
  it('with model.questions, each card is core\'s typed question and carries its id; CONTRAST: without it, the coaching texts carry none', () => {
    const view = typed()
    expect(chatQuestionsOf(view.model).filter((q) => q.key.startsWith('q:')).map((q) => [q.text, q.answers])).toEqual([[Q.text, Q.id]])
    expect(chatQuestionsOf(read().model).filter((q) => !q.key.startsWith('t:')).every((q) => q.answers === null)).toBe(true)
  })
})

describe('the box belongs to one question, and a send loses nothing typed (Codex ROOT 01:14Z)', () => {
  it('read-only while its answer is being sent, and success clears only the words that were sent', async () => {
    ready(typed())
    let resolve!: (v: unknown) => void
    api.call.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    render(<ViewReasoningBlock />)
    const input = screen.getAllByTestId('reasoning-answer-input')[0] as HTMLInputElement
    fireEvent.change(input, { target: { value: '12' } })
    await act(async () => { fireEvent.click(screen.getAllByTestId('reasoning-answer-send')[0]!) })
    expect(input.readOnly).toBe(true)
    await act(async () => { resolve({}) })
    expect([input.readOnly, input.value]).toEqual([false, ''])
  })
  it('Analysis\'s activity: when the first question changes from A to B, B\'s box starts empty and its answer is sent with B\'s id', async () => {
    const a = typed()
    ready(a)
    const r = render(<StartHere model={a.model!} />)
    fireEvent.change(screen.getByTestId('reasoning-answer-input'), { target: { value: 'for A' } })
    const b = typed()
    ;(b.model as unknown as { questions: unknown[] }).questions = [{ id: 'qB', text: 'What would tell you the release is safe?', about: null, role: null, unit: null }]
    ready(b)
    r.rerender(<StartHere model={b.model!} />)
    const input = screen.getByTestId('reasoning-answer-input') as HTMLInputElement
    expect([input.value, input.closest('[data-answer-for]')!.getAttribute('data-answer-for')]).toEqual(['', 'qB'])
    api.call.mockResolvedValueOnce({})
    fireEvent.change(input, { target: { value: 'for B' } })
    await act(async () => { fireEvent.click(screen.getByTestId('reasoning-answer-send')) })
    expect([api.call.mock.calls[0]![2].question_id, api.call.mock.calls[0]![2].text]).toEqual(['qB', 'for B'])
  })
})

describe('what core examined (AS BUILT view.reasoning.examined): drawn by id, every word core\'s or the person\'s', () => {
  it('the question, what was supplied and by whom, the card it was set on (one press), Olumi\'s reply as served, the cards it MENTIONS (never "rests on"), its limits', () => {
    const view = typed()
    const [c0, c1] = [view.model!.cards[0]!, view.model!.cards[1]!]
    ;(view as unknown as { reasoning: unknown }).reasoning = { examined: [{ id: 'x42', question_id: Q.id, question: Q.text, about: c0.id, supplied: { by: 'Ada', by_id: 'p1', text: '12', at: '2026-11-19T00:40:00Z' },
      bound: c0.id, finding: { row: 43, text: 'Twelve weeks is now the time left on this aim.' }, mentioned: [c1.id, 'not_a_card'], limits: 'The aim still has no measure.', proposal_id: 9, olumi: true }] }
    ready(view)
    render(<ViewReasoningBlock />)
    const x = screen.getByTestId('reasoning-answered').querySelector<HTMLElement>('[data-examined="x42"]')!
    expect([x.dataset['examinedQuestion'], x.querySelector('[data-testid="reasoning-examined-question"]')!.textContent, x.querySelector('[data-testid="reasoning-examined-supplied"]')!.textContent,
      x.querySelector('[data-testid="reasoning-examined-bound"]')!.textContent, x.querySelector('[data-testid="reasoning-examined-finding"]')!.textContent, x.querySelector('[data-testid="reasoning-examined-limits"]')!.textContent])
      .toEqual([Q.id, Q.text, 'Answer given: Ada: 12', c0.heading, 'Twelve weeks is now the time left on this aim.', 'Limits: The aim still has no measure.'])
    expect([...x.querySelectorAll<HTMLElement>('[data-mentioned]')].map((e) => e.dataset['mentioned'])).toEqual([c1.id])
    expect(x.querySelector('[data-testid="reasoning-examined-mentioned"]')!.textContent!.startsWith('Mentioned:')).toBe(true)
    expect(screen.getByTestId('reasoning-answered').textContent!.toLowerCase()).not.toMatch(/rests on|evidence/)
    fireEvent.click(x.querySelector('[data-testid="reasoning-examined-bound"]')!)
    expect(focus.node.mock.calls).toEqual([[c0.id]])
  })
  it('CONTRAST: empty mentioned draws no Mentioned line; no reasoning block or an empty list draws no Answered section', () => {
    const view = typed([{ id: 'x1', question_id: Q.id, question: Q.text, about: null, supplied: { by: 'Ada', by_id: 'p1', text: 'not sure', at: '' }, bound: null, finding: null, mentioned: [], limits: null, proposal_id: null, olumi: true }])
    ready(view)
    render(<ViewReasoningBlock />)
    const x = screen.getByTestId('reasoning-answered').querySelector<HTMLElement>('[data-examined="x1"]')!
    expect([x.querySelector('[data-testid="reasoning-examined-mentioned"]'), x.querySelector('[data-testid="reasoning-examined-bound"]'), x.querySelector('[data-testid="reasoning-examined-finding"]')]).toEqual([null, null, null])
    cleanup()
    ready(read())
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-answered')).toBeNull()
    cleanup()
    ready(typed([]))
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-answered')).toBeNull()
  })
})
