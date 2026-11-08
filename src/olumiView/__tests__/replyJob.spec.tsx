/**
 * AI jobs slice 3 (core API v1.29, 8 Nov 2026): a figure edit saves at once and Olumi replies to it in core; the View's `reply` says where
 * that reply stands, in core's words. It is drawn on the edit's own turn (the conversation's turn whose `id` is `reply.proposal`), in place
 * of the answer it does not have yet, as a polite status; never anywhere else. The one poller reads about every 1.5 s while it runs, then
 * the normal pace. Real stores and poller, a scripted fetch, fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, renderHook } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { useMe } from '../../olumiCore/me'
import type { View } from '../client'
import { useViewStore } from '../store'
import { DRAFT_POLL_MS, POLL_MS, useViewPoll } from '../poll'
import { ViewConversation, ViewTurns, useViewChat } from '../ViewChat'

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const SID = 's_00000000000b', OTHER = 's_00000000000c', UUID = '00000000-0000-4000-8000-00000000000b'
const STARTED = '2026-11-08T15:00:00.000Z'
const RUNNING = 'Olumi is replying to this edit.'
type Reply = NonNullable<View['reply']>
const replyOf = (over: Partial<Reply> = {}): Reply => ({ job: 41, proposal: 5, version: 9, status: 'running', words: RUNNING, by: 'Paul', by_id: '7', started: STARTED, at: STARTED, ...over })
/** Core's proposal golden (turns 3 and 5), read as Paul (id 7), with `reply` as given; the turn it names has no answer yet unless `answered`. */
const viewWith = (reply: Reply | null, { sid = SID, answered = false }: { sid?: string; answered?: boolean } = {}): View => {
  const g = golden('proposal')
  return { ...g, id: sid, you_id: '7', reply, chat: g.chat.map((t) => (!answered && reply !== null && t.id === reply.proposal ? { ...t, answer: null } : t)) } as unknown as View
}

let served: View = viewWith(null), reads: string[] = [], posts: string[] = []
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(Date.parse('2026-11-08T15:00:06.000Z'))
  served = viewWith(null); reads = []; posts = []
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  setPagePerson(null)
  useMe.setState({ me: { id: '7', name: 'Paul' } } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (url === '/api/me') return new Response(JSON.stringify({ me: { id: '7', name: 'Paul' } }), { status: 200 })
    if (init?.method === 'POST') { posts.push(url); return new Response('{}', { status: 201 }) }
    reads.push(url)
    return new Response(JSON.stringify(served), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => {
  cleanup(); vi.useRealTimers(); setTeamFetch(null); setPagePerson(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
  useMe.setState({ me: null } as never)
})
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const on = (view: View, sid = SID) => useViewStore.setState({ uuid: UUID, sid, view, status: 'ready', error: null, stale: false, at: null })
const lines = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="view-chat-reply"]')]

describe('Olumi\'s reply to an edit, answered in core', () => {
  it('UR1 while it runs: core\'s words verbatim, as a polite status, on the edit\'s own turn and nowhere else', () => {
    const v = viewWith(replyOf())
    on(v)
    const c = render(<ViewConversation chat={v.chat} />).container
    expect(lines(c)).toHaveLength(1)
    const line = lines(c)[0]!
    expect(line.closest('[data-view-turn]')?.getAttribute('data-view-turn')).toBe('chat.1') // turn id 5, the newest
    expect([line.getAttribute('role'), line.getAttribute('aria-live')]).toEqual(['status', 'polite'])
    expect(line.querySelector('[data-view="reply.words"]')?.textContent).toBe(RUNNING)
    expect(c.querySelector('[aria-live="assertive"]')).toBeNull()
  })

  it('UR2 how it ended without a reply: each of core\'s sentences verbatim on that turn, with no control of the page\'s own', () => {
    for (const [status, words] of [
      ['failed', 'Olumi could not finish its reply.'],
      ['interrupted', 'The server restarted while Olumi was working on this, so it did not finish.'],
      ['stale', 'A later edit changed the model before Olumi replied, so this edit has no reply.'],
    ] as const) {
      const v = viewWith(replyOf({ status, words }))
      on(v)
      const c = render(<ViewTurns chat={v.chat} />).container
      expect(lines(c).map((l) => [l.closest('[data-view-turn]')?.getAttribute('data-view-turn'), l.getAttribute('data-reply'), l.textContent])).toEqual([['chat.1', status, words]])
      expect(lines(c)[0]!.closest('[data-view-turn]')!.querySelector('button')).toBeNull()
      cleanup()
    }
  })

  it('UR3 it names an earlier turn: drawn there only; a turn that has its answer shows the answer, never the line; no reply, no line', () => {
    const earlier = viewWith(replyOf({ proposal: 3 }))
    on(earlier)
    let c = render(<ViewTurns chat={earlier.chat} />).container
    expect(lines(c).map((l) => l.closest('[data-view-turn]')?.getAttribute('data-view-turn'))).toEqual(['chat.0'])
    cleanup()
    const answered = viewWith(replyOf(), { answered: true })
    on(answered)
    c = render(<ViewTurns chat={answered.chat} />).container
    expect(lines(c)).toEqual([])
    expect(c.querySelector('[data-view-turn="chat.1"] [data-testid="view-chat-answer"]')).not.toBeNull()
    cleanup()
    const none = viewWith(null)
    on(none)
    expect(lines(render(<ViewTurns chat={none.chat} />).container)).toEqual([])
  })

  it('UR4 the poller reads about every 1.5 s while the reply runs, then at the normal pace once it has landed; reading never writes', async () => {
    served = viewWith(replyOf())
    on(viewWith(replyOf()))
    renderHook(() => useViewPoll(true))
    const viewReads = () => reads.filter((r) => r.includes('/view?'))
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(1)
    served = viewWith(null, { answered: true }) // landed: no reply state, and the edit's turn has its answer
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(2)
    expect(useViewStore.getState().view?.reply ?? null).toBeNull()
    await tick(POLL_MS - DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(2) // back to the normal pace
    await tick(DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(3)
    expect(posts).toEqual([])
  })

  it('UR5 an ended reply does not speed the poller; after moving to another scenario, the first one\'s reply neither draws nor speeds it', async () => {
    served = viewWith(replyOf({ status: 'failed', words: 'Olumi could not finish its reply.' }))
    on(served)
    renderHook(() => useViewPoll(true))
    const viewReads = () => reads.filter((r) => r.includes('/view?'))
    await tick(DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(0) // ended: the normal pace
    cleanup()
    const other = viewWith(null, { sid: OTHER })
    served = other
    on(other, OTHER)
    const c = render(<ViewTurns chat={other.chat} />).container
    expect(lines(c)).toEqual([])
    renderHook(() => useViewPoll(true))
    await tick(DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(0)
  })
})
