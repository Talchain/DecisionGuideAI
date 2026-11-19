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
import { ViewReasoningBlock } from '../../ViewReasoning'
import { coreQuestionIdOf } from '../answer'

const read = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden/app-launch.view.json'), 'utf8'))
const Q = { id: 'q0123456789', text: 'How many weeks are left before the release must ship?', target: null as string | null, role: 'due', unit: 'week' }
const typed = (examined: unknown[] = []): View => {
  const view = read()
  const aim = view.model!.cards[0]!
  ;(view.model as unknown as { questions: unknown[] }).questions = [{ ...Q, target: aim.id }]
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

describe('the chat\'s question card: one answer path (CONTRACT §3)', () => {
  it('a coaching question core sent typed at the same place carries its id: the card\'s answer goes to …/answer bound to that id', () => {
    const view = typed()
    ;(view.model as unknown as { questions: unknown[] }).questions = view.model!.coaching_questions!.map((text, i) => ({ id: `qid${i}`, text, target: null, role: null, unit: null }))
    expect(coreQuestionIdOf(view.model, 'c:1', view.model!.coaching_questions![1]!)).toBe('qid1')
  })
  it('CONTRAST: no typed question (an older core), a trial question, or other words at that place: null, so the answer goes as today\'s message', () => {
    const view = typed()
    ;(view.model as unknown as { questions: unknown[] }).questions = view.model!.coaching_questions!.map((text, i) => ({ id: `qid${i}`, text, target: null, role: null, unit: null }))
    expect([coreQuestionIdOf(read().model, 'c:1', read().model!.coaching_questions![1]!), coreQuestionIdOf(view.model, 't:abc', view.model!.coaching_questions![1]!), coreQuestionIdOf(view.model, 'c:1', 'Some other words')])
      .toEqual([null, null, null])
  })
})
