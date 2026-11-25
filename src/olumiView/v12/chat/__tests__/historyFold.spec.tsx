import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson } from '../../../../olumiCore/team/api'
import { useMe } from '../../../../olumiCore/me'
import type { View, ViewTurn } from '../../../client'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { ViewChat, useViewChat } from '../../../ViewChat'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
type Answer = NonNullable<ViewTurn['answer']>
const withTurn = (v: View, i: number, a: Partial<Answer>, over: Record<string, unknown> = {}): View =>
  ({ ...v, chat: v.chat.map((t, j) => (j === i && t.answer !== null ? { ...t, ...over, answer: { ...t.answer, ...a } } : t)) })
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<ViewChat />).container
}
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)

let base: View
beforeEach(() => {
  base = golden('proposal')
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setPagePerson(null); useMe.setState({ me: { id: '7', name: 'Ada' } } as never)
})
afterEach(() => {
  cleanup(); setPagePerson(null); useMe.setState({ me: null } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

const showTurn = (view: View) => show(view).querySelector<HTMLElement>('[data-view-turn="chat.1"]')!
const withHistory = (lines = ['L one', 'L two']) => withTurn(base, 1, { history: { heading: 'H words', lines } } as Partial<Answer> & { history: { heading: string; lines: string[] } })

describe('proposal history', () => {
  it('puts closed history between the next step and the version in the same turn', () => {
    const turn = showTurn(withHistory())
    const details = q(turn, 'view-chat-history')!
    const summary = details.firstElementChild!
    expect(details.tagName).toBe('DETAILS')
    expect(details).not.toHaveAttribute('open')
    expect(summary.tagName).toBe('SUMMARY')
    expect(summary.textContent).toBe('H words')
    expect([...details.querySelectorAll('li')].map((line) => line.textContent)).toEqual(['L one', 'L two'])
    expect(q(turn, 'view-chat-next')!.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(details.compareDocumentPosition(q(turn, 'view-chat-version')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('opens and closes when the summary is clicked', () => {
    const details = q(showTurn(withHistory()), 'view-chat-history') as HTMLDetailsElement
    const summary = details.querySelector('summary')!
    summary.click()
    expect(details.open).toBe(true)
    summary.click()
    expect(details.open).toBe(false)
  })

  it('omits the fold when history is absent or empty', () => {
    expect(q(show(base), 'view-chat-history')).toBeNull()
    cleanup()
    expect(q(show(withHistory([])), 'view-chat-history')).toBeNull()
  })

  it('draws the same answer text with and without history', () => {
    const without = q(showTurn(base), 'view-chat-answer')!.textContent
    cleanup()
    expect(q(showTurn(withHistory()), 'view-chat-answer')!.textContent).toBe(without)
  })
})
