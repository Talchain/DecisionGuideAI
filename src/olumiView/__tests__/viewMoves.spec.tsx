/**
 * ONE-TAP COACHING MOVES (R2 W1; DL 16:36Z, option b): the newest reply's next move is one tap, in the shell's button, with core's label.
 * A tap sends a structured choice `{ move, at }` through the chat's own write, never words: Olumi's `next.text` is never sent as the
 * person's. A move core refuses as stale (409) re-reads the View and drops the tap, with no retry. The route is a stand-in for core's R2c.
 * Fixture: core's whatif golden, its newest reply carrying a `move` as core's View does from 228d66d.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import golden from '../golden/whatif.view.json'
import type { View } from '../client'
import { ViewChat, useViewChat } from '../ViewChat'
import { useViewStore } from '../store'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'

const base = golden as unknown as View
const SID = base.id
const last = base.chat.length - 1
/** Every reply with a move, as core's View carries one on each; only the newest is offered as a tap. */
const withMove = (move: string): View => ({ ...base, chat: base.chat.map((t) => (t.answer ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, move } } } : t)) } as View)
const NEXT = withMove('outside_view').chat[last]!.answer!.next
const NEXT_WORDS = NEXT.text.map((p) => ('text' in p ? p.text : '')).join('')

let calls: Array<{ method: string; path: string; body: Record<string, unknown> | undefined }> = []
let refuse: { status: number; error: string } | null = null
let served: View
beforeEach(() => {
  calls = []; refuse = null; served = withMove('outside_view')
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', path = String(u)
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (path === '/api/me') return new Response(JSON.stringify({ me: { id: base.you_id, name: base.you } }), { status: 200 })
    if (method === 'POST') return refuse ? new Response(JSON.stringify({ error: refuse.error }), { status: refuse.status }) : new Response(JSON.stringify({ proposal: null, discussion: true }), { status: 201 })
    return new Response(JSON.stringify(served), { status: 200 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-441113f79584', sid: SID, view: served, status: 'ready', error: null, stale: false })
})
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null }) })
const posts = () => calls.filter((c) => c.method === 'POST')
const reads = () => calls.filter((c) => c.method === 'GET' && c.path.startsWith(`/api/scenarios/${SID}/view`)).length

describe('the coach\'s next move is one tap', () => {
  it('the newest reply\'s move is one tap with core\'s label; a tap sends the move and where, as a choice, and the View is read again', async () => {
    render(<ViewChat />)
    const tap = screen.getByTestId('view-next-move')
    expect(tap.textContent).toBe(NEXT.label)
    await act(async () => { fireEvent.click(tap) })
    await waitFor(() => expect(reads()).toBe(1))
    expect(posts()).toEqual([{ method: 'POST', path: `/api/scenarios/${SID}/messages`, body: { move: 'outside_view', at: NEXT.at, op: expect.any(String) } }])
  })

  it('NEVER sends next.text as the person\'s words: no text at all, and nothing of Olumi\'s words in the request', async () => {
    render(<ViewChat />)
    await act(async () => { fireEvent.click(screen.getByTestId('view-next-move')) })
    await waitFor(() => expect(posts()).toHaveLength(1))
    const body = posts()[0]!.body!
    expect('text' in body).toBe(false)
    expect(JSON.stringify(body)).not.toContain(NEXT_WORDS.slice(0, 20))
    expect(useViewChat.getState().text).toBe('')
  })

  it('a move core refuses as stale (409): core\'s words, the View read again, the tap dropped, and no retry', async () => {
    refuse = { status: 409, error: 'That suggestion is no longer the newest. Here is where the conversation is now.' }
    render(<ViewChat />)
    await act(async () => { fireEvent.click(screen.getByTestId('view-next-move')) })
    await waitFor(() => expect(reads()).toBe(1))
    expect(useViewChat.getState().said).toBe('That suggestion is no longer the newest. Here is where the conversation is now.')
    expect(screen.queryByTestId('view-next-move')).toBeNull()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(posts()).toHaveLength(1)
  })

  it('any other refusal keeps the tap, in core\'s words, and reads nothing again (a move that may be taken still)', async () => {
    refuse = { status: 429, error: 'You have sent a lot just now. Wait a minute, then try again.' }
    render(<ViewChat />)
    await act(async () => { fireEvent.click(screen.getByTestId('view-next-move')) })
    await waitFor(() => expect(useViewChat.getState().said).toBe('You have sent a lot just now. Wait a minute, then try again.'))
    expect(screen.getByTestId('view-next-move')).toBeTruthy()
    expect(reads()).toBe(0)
  })

  it('only the newest reply\'s move is a tap; a View from a core before moves (none carried) offers none', () => {
    render(<ViewChat />)
    expect(screen.getAllByTestId('view-next-move')).toHaveLength(1)
    cleanup()
    useViewStore.setState({ view: base })
    render(<ViewChat />)
    expect(screen.queryByTestId('view-next-move')).toBeNull()
  })

  it('a reply core does not mark as its newest offers no tap, even shown last: the tap follows core\'s word for which move is current', () => {
    const v = withMove('outside_view')
    useViewStore.setState({ view: { ...v, chat: v.chat.map((t) => (t.answer ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, newest: false } } } : t)) } as View })
    render(<ViewChat />)
    expect(screen.queryByTestId('view-next-move')).toBeNull()
  })
})
