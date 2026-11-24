/**
 * W2 (Paul 0950 point 7: "after the user submits a prompt, should the panel move to the end of the conversation so they can see the response?"): the viewer's
 * OWN accepted send brings the thread to its turn and the reply it brings, however far up they had scrolled. Another member's activity never moves a reader
 * who scrolled back (contract 3, chatThread.spec CT5). The setup is chatThread.spec.tsx's: saved core fixtures, the real mounted chat and composer, the
 * thread's measured layout stubbed as CT5 stubs it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'

const fixture: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const show = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-cb215d057b96', sid: view.id, view, error: null, status: 'ready', stale: false, at: null })
let posts: { url: string; body: unknown }[] = []
beforeEach(() => {
  posts = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response('{}', { status: 201 }) }
    return new Response(JSON.stringify(fixture), { status: 200 })
  }) as unknown as typeof fetch)
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null, sent: 0 })
  show(fixture)
})
afterEach(() => {
  cleanup()
  setTeamFetch(null)
  vi.restoreAllMocks()
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
})

describe('the viewer\'s own send brings its reply into view', () => {
  it('a reader scrolled back is not moved by another member\'s turn; their own accepted message brings the thread to the newest line and Latest goes', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(1300)
    show({ ...fixture, chat: fixture.chat.slice(0, 1) })
    const { getByTestId, queryByTestId, getByRole } = render(<><ViewChat /><ViewComposer /></>)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 200, configurable: true },
      scrollTop: { value: 200, writable: true, configurable: true },
    })
    fireEvent.scroll(scroll)
    expect(getByTestId('view-chat-to-latest')).not.toBeNull()
    // CONTRAST: a newer turn arrives that this viewer did not send (the saved thread grows); the reader stays where they scrolled.
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(200)
    // Their own message, accepted by core: the thread follows to the newest line (scrollHeight − clientHeight here), and Latest is gone.
    const box = getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'What should we check before Sunday?' } })
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }) })
    await waitFor(() => expect(posts).toHaveLength(1))
    await waitFor(() => expect(scroll.scrollTop).toBe(800))
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    expect(useViewChat.getState().sent).toBe(1)
  })
})
