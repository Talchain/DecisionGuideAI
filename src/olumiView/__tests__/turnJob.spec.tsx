/**
 * AI jobs, slice 2 (core API v1.28, 8 Nov 2026): a message is accepted at once and answered in core; the View's `turn` carries where it
 * stands, in core's words. One row per UI case: the chat draws their words and core's line verbatim, with the seconds since core accepted
 * it; Send waits while it is answered; the one poller reads about every 1.5 s while it is answered, then the normal pace; a failed turn
 * shows core's reason and Try again (the same words, a new op); core's one-at-a-time refusal is shown in core's words; an acceptance lost on
 * the way is asked again after a reload by the SAME op, and only on Send. Real stores and poller, a scripted fetch, fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { useMe } from '../../olumiCore/me'
import type { View } from '../client'
import { useViewStore } from '../store'
import { DRAFT_POLL_MS, POLL_MS, useViewPoll } from '../poll'
import { TurnInFlight, ViewConversation, turnAlreadyShown, ViewComposer, isAnswering, pendingTurn, useViewChat } from '../ViewChat'

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const SID = 's_00000000000a', UUID = '00000000-0000-4000-8000-00000000000a'
const STARTED = '2026-11-08T15:00:00.000Z'
const BUSY = 'Olumi is still answering the last message here. Send yours once it has answered.'
type Turn = NonNullable<View['turn']>
const turnOf = (over: Partial<Turn> = {}): Turn => ({ job: 31, status: 'answering', said: 'What if demand falls?', ask: 'message', by: 'Paul', by_id: '7', words: 'Olumi is answering.', started: STARTED, at: STARTED, ...over })
/** A scenario with its saved model (core's pricing golden, read as Paul, id 7) and `turn` as given. */
const viewWith = (turn: Turn | null): View => ({ ...golden('pricing'), id: SID, you_id: '7', turn } as unknown as View)

let served: View | 'fail' = viewWith(null), reads: string[] = [], posts: { url: string; body: Record<string, unknown> }[] = [], post: (url: string, body: unknown) => Response
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(Date.parse('2026-11-08T15:00:06.000Z'))
  served = viewWith(null); reads = []; posts = []
  post = () => new Response(JSON.stringify({ scenario: SID, job: { id: 31, kind: 'turn', status: 'running', words: 'Olumi is answering.' }, proposal: null, discussion: null, status_url: `/api/scenarios/${SID}/jobs/31` }), { status: 202 })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  try { sessionStorage.clear() } catch { /* none */ }
  setPagePerson(null)
  useMe.setState({ me: { id: '7', name: 'Paul' } } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (url === '/api/me') return new Response(JSON.stringify({ me: { id: '7', name: 'Paul' } }), { status: 200 })
    if (init?.method === 'POST') { const body = JSON.parse(String(init.body)); posts.push({ url, body }); return post(url, body) }
    reads.push(url)
    return served === 'fail' ? new Response(JSON.stringify({ error: 'Olumi could not do that this time.' }), { status: 500 }) : new Response(JSON.stringify(served), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => {
  cleanup(); vi.useRealTimers(); setTeamFetch(null); setPagePerson(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
  useMe.setState({ me: null } as never)
})
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const on = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view, status: 'ready', error: null, stale: false, at: null })

describe('a turn answered in core', () => {
  it('UT1 draws their words, then core\'s line verbatim as an accessible status with the seconds since core accepted it; another member\'s turn names them and offers no Try again', () => {
    on(viewWith(turnOf()))
    const mine = render(<TurnInFlight turn={turnOf()} me="7" />).container
    expect(mine.querySelector('[data-view="turn.said"]')?.textContent).toBe('What if demand falls?')
    const status = mine.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(mine.querySelector('[data-view="turn.words"]')?.textContent).toBe('Olumi is answering.')
    expect(mine.querySelector('[data-testid="view-chat-turn-seconds"]')?.textContent).toBe(' 6 s')
    // DL-538: the bubble names whose words it holds, the viewer's own quieter (this row replaced "mine names no one")
    const by = mine.querySelector('[data-view="turn.by"]')!
    expect([by.textContent, by.parentElement === mine.querySelector('[data-view="turn.said"]')!.parentElement, by.classList.contains('text-text-light')]).toEqual([turnOf().by, true, true])
    cleanup()
    const theirs = render(<TurnInFlight turn={turnOf({ by: 'Sam', by_id: '9', status: 'failed', words: 'the model changed while Olumi was working; send your message again' })} me="7" />).container
    expect(theirs.querySelector('[data-view="turn.by"]')?.textContent).toBe('Sam')
    expect(theirs.querySelector('[data-view="turn.words"]')?.textContent).toBe('the model changed while Olumi was working; send your message again')
    expect(theirs.querySelector('[data-testid="view-chat-turn-again"]')).toBeNull()
  })

  it('UT2 Send waits while a turn is answered, and the poller reads about every 1.5 s until it is answered, then at the normal pace', async () => {
    served = viewWith(turnOf())
    on(viewWith(turnOf()))
    expect(isAnswering(useViewStore.getState().view)).toBe(true)
    useViewChat.setState({ text: 'And another thing' })
    const composer = render(<ViewComposer />).container
    expect((composer.querySelector('[data-testid="view-composer-send"]') as HTMLButtonElement).disabled).toBe(true)
    renderHook(() => useViewPoll(true))
    const viewReads = () => reads.filter((r) => r.includes('/view?'))
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(1)
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(2)
    served = viewWith(null) // answered: its proposal is the conversation's turn now
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(3)
    expect(useViewStore.getState().view?.turn ?? null).toBeNull()
    expect((composer.querySelector('[data-testid="view-composer-send"]') as HTMLButtonElement).disabled).toBe(false)
    await tick(POLL_MS - DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(3) // back to the normal pace: nothing more until POLL_MS
    await tick(DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(4)
    expect(posts).toEqual([]) // reading never writes
  })

  it('UT3 a failed turn of theirs shows core\'s reason and Try again, which sends the same words under a NEW op', async () => {
    const failed = turnOf({ status: 'failed', words: 'Olumi could not finish this turn. Please try again in a moment.' })
    served = viewWith(turnOf({ job: 32 }))
    on(viewWith(failed))
    const c = render(<TurnInFlight turn={failed} me="7" />).container
    expect(c.querySelector('[data-view="turn.words"]')?.textContent).toBe('Olumi could not finish this turn. Please try again in a moment.')
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-chat-turn-again"]')!) })
    await tick(0)
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/messages`, body: { text: 'What if demand falls?', op: expect.any(String) } }])
    // A failed challenge (or method question, move, evidence to consider) is asked again from its own control: it is never sent as words.
    cleanup()
    const challenge = turnOf({ status: 'failed', ask: 'challenge', said: "What are we assuming about 'Add one specialist', and what if it's wrong?", words: 'Olumi could not finish this turn. Please try again in a moment.' })
    on(viewWith(challenge))
    expect(render(<TurnInFlight turn={challenge} me="7" />).container.querySelector('[data-testid="view-chat-turn-again"]')).toBeNull()
  })

  it('UT4 core\'s one-turn-at-a-time refusal is shown in core\'s words, never a raw error, and the words stay in the box', async () => {
    post = () => new Response(JSON.stringify({ error: BUSY }), { status: 409 })
    on(viewWith(null))
    useViewChat.setState({ text: 'Is 20 right?' })
    const c = render(<ViewComposer />).container
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-composer-send"]')!) })
    await tick(0)
    expect(c.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe(BUSY)
    expect(useViewChat.getState().text).toBe('Is 20 right?')
    expect(posts).toHaveLength(1)
  })

  it('UT5 an acceptance lost on the way: after a reload the message is back in the box with the SAME op, sent only on Send, even when the View shows the same words', async () => {
    post = () => { throw new TypeError('network down') }
    on(viewWith(null))
    useViewChat.setState({ text: 'Lost on the way' })
    const c = render(<ViewComposer />).container
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-composer-send"]')!) })
    await tick(0)
    const sent = posts[0]!.body['op']
    expect(pendingTurn('7')).toEqual({ sid: SID, text: 'Lost on the way', op: sent })
    cleanup()
    // The reload: a fresh composer state; nothing is sent by reading.
    useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
    post = () => new Response(JSON.stringify({ scenario: SID, job: { id: 31, kind: 'turn', status: 'running', words: 'Olumi is answering.' }, proposal: null, discussion: null, status_url: '' }), { status: 202 })
    on(viewWith(null))
    const again = render(<ViewComposer />).container
    await tick(0)
    expect(useViewChat.getState().text).toBe('Lost on the way')
    expect(posts).toHaveLength(1)
    await act(async () => { fireEvent.click(again.querySelector('[data-testid="view-composer-send"]')!) })
    await tick(0)
    expect(posts).toHaveLength(2)
    expect(posts[1]!.body).toEqual({ text: 'Lost on the way', op: sent })
    expect(pendingTurn('7')).toBeNull()
    // The same words on the View (Sam's message, or an earlier one of theirs) prove nothing about this op: it is put back, with its op.
    cleanup()
    sessionStorage.setItem('olumi-pending-turn:7', JSON.stringify({ sid: SID, text: 'What if demand falls?', op: 'op-same-words-0001' }))
    useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
    on(viewWith(turnOf({ by: 'Sam', by_id: '9', status: 'failed', words: 'Olumi could not finish this turn. Please try again in a moment.' })))
    const third = render(<ViewComposer />).container
    await tick(0)
    expect(useViewChat.getState().text).toBe('What if demand falls?')
    await act(async () => { fireEvent.click(third.querySelector('[data-testid="view-composer-send"]')!) })
    await tick(0)
    expect(posts[2]!.body).toEqual({ text: 'What if demand falls?', op: 'op-same-words-0001' })
  })
})

// Codex d9d66e579 (old look, 14 Nov), ported to the new look for DL journey (5): the saved failed reply and its job share one notice.
describe('the saved failed reply and its job share one notice', () => {
  it('keeps the saved row and gives it one retry without repeating the message or failure', () => {
    const failed = turnOf({ status: 'failed', words: 'Olumi could not finish its reply.' })
    const last: View['chat'][number] = { id: 32, by: 'Paul', by_id: failed.by_id, version: 'version 1', earlier: false, status: null, answer: null, said: failed.said!, broke: null, problem: failed.words, marks: [], choice: null }
    const state = { chat: [last], turn: failed }
    const c = render(<><ViewConversation chat={state.chat} me="7" /><TurnInFlight turn={failed} me="7" shown={turnAlreadyShown(state)} /></>).container
    expect(c.textContent!.split(failed.words!)).toHaveLength(2)
    expect(c.textContent!.split(failed.said!)).toHaveLength(2)
    expect(c.querySelectorAll('[data-testid="view-chat-turn-again"]')).toHaveLength(1)
    expect(turnAlreadyShown({ ...state, turn: { ...failed, status: 'answering' } })).toBe(false)
    expect(turnAlreadyShown({ ...state, turn: { ...failed, by_id: '9' } })).toBe(false)
    expect(turnAlreadyShown({ ...state, turn: { ...failed, said: 'something else' } })).toBe(false)
  })
})
