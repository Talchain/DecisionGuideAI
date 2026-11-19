/**
 * Typed fields 13a + 13b, the UI half (CONTRACT dl-takeover/typed-fields; Codex ROOT 02:53:03Z; UI lead's brief 19 Nov). The View is mocked
 * with the contract's shapes on core's own View (fixtures/core-38eebca9/proposal.view3.json, read as p_1):
 *  - `chat[].press` / `turn.press` / unanswered `floor[].press` = { kind, card, label }: the person's row draws core's label · the card's heading,
 *    never `said`; card null → the label alone; absent → today's row (their words).
 *  - Try again on a pressed turn sends `about` + `press` again; card null → neither.
 *  - `chat[].ask` 'challenge' | 'method' draws the "Asked with a method" chrome; 'message' draws their words; absent → the draft entry, as before.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { TurnInFlight, ViewComposer, ViewConversation, restorePendingTurn, useViewChat } from '../ViewChat'
import { askFieldOf, pressFieldOf } from '../press'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/proposal.view3.json'), 'utf8'))
const SID = 's_00000000000c', UUID = '00000000-0000-4000-8000-00000000000c'
const CARD = fx.model!.cards.find((c) => c.id === 'per_specialist')!
const EXPLAIN = { kind: 'explain', card: CARD.id, label: 'Asked Olumi to explain' } as const
const PREFILL = 'Explain how Per specialist feeds the result.'
type ChatRow = View['chat'][number]
const row = (over: Record<string, unknown> = {}): ChatRow => ({ ...fx.chat[0]!, by_id: 'p_1', said: PREFILL, ...over } as unknown as ChatRow)
type Turn = NonNullable<View['turn']>
const turnOf = (over: Record<string, unknown> = {}): Turn => ({ job: 41, status: 'failed', said: PREFILL, ask: 'message', by: 'Paul', by_id: 'p_1', words: 'Olumi could not finish this turn.', started: '2026-11-19T03:00:00Z', at: '2026-11-19T03:00:00Z', ...over } as unknown as Turn)

let posts: { url: string; body: Record<string, unknown> }[] = []
beforeEach(() => {
  posts = []
  setPagePerson(null)
  useMe.setState({ me: { id: 'p_1', name: 'Paul' } } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (url === '/api/me') return new Response(JSON.stringify({ me: { id: 'p_1', name: 'Paul' } }), { status: 200 })
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ scenario: SID, job: { id: 42, kind: 'turn', status: 'running', words: '' }, proposal: null, discussion: null }), { status: 202 }) }
    return new Response(JSON.stringify(useViewStore.getState().view), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, pressBack: null } as never)
  useMe.setState({ me: null } as never)
  try { sessionStorage.clear() } catch { /* none */ }
})
const on = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view: { ...view, id: SID } as View, status: 'ready', error: null, stale: false, at: null })
const conversation = (chat: ChatRow[], floor: unknown[] = [], draft: unknown = null) => render(<ViewConversation chat={chat} floor={floor as never} draft={draft as never} me="p_1" />).container

describe('13b: a pressed message is drawn as core\'s label and the card, never as typed words', () => {
  it('on a saved chat turn: label · heading, and not `said`; card null: the label alone; contrast: no press, their words', () => {
    on(fx)
    let c = conversation([row({ press: EXPLAIN, ask: 'message' })])
    const p = c.querySelector('[data-testid="view-chat-press"]')!
    expect(p.textContent).toBe(`${EXPLAIN.label} · ${CARD.heading}`)
    expect(p.getAttribute('data-press')).toBe('explain')
    expect(p.getAttribute('data-press-card')).toBe(CARD.id)
    expect(c.textContent).not.toContain(PREFILL)
    cleanup()
    c = conversation([row({ press: { ...EXPLAIN, card: null } })])
    expect(c.querySelector('[data-testid="view-chat-press"]')!.textContent).toBe(EXPLAIN.label)
    cleanup()
    c = conversation([row()])
    expect(c.querySelector('[data-testid="view-chat-press"]')).toBeNull()
    expect(c.textContent).toContain(PREFILL)
  })
  it('on the turn being answered (`turn.press`) and on an unanswered floor turn (`floor[].press`)', () => {
    on(fx)
    let c = render(<TurnInFlight turn={turnOf({ press: { kind: 'ask_about', card: CARD.id, label: 'Asked Olumi about' } })} me="p_1" />).container
    expect(c.querySelector('[data-testid="view-chat-press"]')!.textContent).toBe(`Asked Olumi about · ${CARD.heading}`)
    expect(c.textContent).not.toContain(PREFILL)
    cleanup()
    const floor = [{ job: 40, at: '2026-11-19T02:59:00Z', by: 'Paul', by_id: 'p_1', said: PREFILL, text: '', unanswered: { status: 'failed', words: 'Olumi could not answer this.' }, press: EXPLAIN }]
    c = conversation([], floor)
    expect(c.querySelector('[data-testid="view-chat-press"]')!.textContent).toBe(`${EXPLAIN.label} · ${CARD.heading}`)
    expect(c.querySelector('[data-testid="view-floor-said"]')).toBeNull()
    cleanup()
    // Contrast: the same unanswered floor turn from an older core (no press) draws their words.
    c = conversation([], [{ ...floor[0], press: undefined }])
    expect(c.querySelector('[data-testid="view-floor-said"]')!.textContent).toBe(PREFILL)
  })
  it('reads the field by type only: an unknown kind, an empty label or a non-string card is an older core (today\'s row)', () => {
    expect(pressFieldOf({ press: EXPLAIN })).toEqual(EXPLAIN)
    expect(pressFieldOf({ press: { ...EXPLAIN, kind: 'summarise' } })).toBeNull()
    expect(pressFieldOf({ press: { ...EXPLAIN, label: ' ' } })).toBeNull()
    expect(pressFieldOf({ press: { ...EXPLAIN, card: 7 } })).toBeNull()
    expect(pressFieldOf({})).toBeNull()
    expect(askFieldOf({ ask: 'consider' })).toBe('consider')
    expect(askFieldOf({ ask: 'other' })).toBeNull()
  })
})

describe('13b: Try again asks again as the same press about the same card', () => {
  it('sends about + press from `turn.press`; card null sends neither (a plain message)', async () => {
    const pressed = turnOf({ press: EXPLAIN })
    on({ ...fx, turn: pressed } as View)
    let c = render(<TurnInFlight turn={pressed} me="p_1" />).container
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-chat-turn-again"]')!) })
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/messages`, body: { text: PREFILL, about: CARD.id, press: 'explain', op: expect.any(String) } })
    cleanup(); useViewChat.setState({ ops: new Map(), busy: false })
    const gone = turnOf({ job: 43, press: { ...EXPLAIN, card: null } })
    on({ ...fx, turn: gone } as View)
    c = render(<TurnInFlight turn={gone} me="p_1" />).container
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-chat-turn-again"]')!) })
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body).toEqual({ text: PREFILL, op: expect.any(String) })
  })
})

describe('13b: a press whose acceptance was lost comes back after a reload as that press (Codex HOLD 03:05:28Z)', () => {
  const OP = 'press-op-0000001'
  const keep = () => sessionStorage.setItem('olumi-pending-turn:p_1', JSON.stringify({ sid: SID, text: PREFILL, op: OP, about: CARD.id, press: 'explain' }))
  const send = async (c: HTMLElement) => { await act(async () => { fireEvent.click([...c.querySelectorAll('button')].find((b) => b.textContent === 'Send')!) }) }
  it('an unchanged Send resends {text, about, press} under the ORIGINAL op; an edited Send is a plain message under a new op', async () => {
    on(fx); keep()
    expect(restorePendingTurn()).toBe(true)
    let c = render(<ViewComposer />).container
    expect(useViewChat.getState().text).toBe(PREFILL)
    await send(c)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/messages`, body: { text: PREFILL, about: CARD.id, press: 'explain', op: OP } })
    cleanup(); useViewChat.setState({ text: '', busy: false } as never)
    on(fx); keep()
    expect(restorePendingTurn()).toBe(true)
    c = render(<ViewComposer />).container
    act(() => { useViewChat.setState({ text: 'Explain it in plain words, please' }) })
    await send(c)
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body).toEqual({ text: 'Explain it in plain words, please', op: expect.any(String) })
    expect(posts[1]!.body['op']).not.toBe(OP)
  })
})

describe('13a: "Asked with a method" reads core\'s chat[].ask', () => {
  it('ask challenge or method draws the chrome; ask message draws their words even where the draft entry says method; absent: the draft entry, as before', () => {
    on(fx)
    let c = conversation([row({ ask: 'method' })])
    expect(c.querySelector('[data-testid="view-chat-pressed"]')!.getAttribute('data-pressed')).toBe('method')
    cleanup()
    // The draft's own conversation entry for this turn says method (the page reads it from the View it is shown).
    const draft = { conversation: [{ seq: 1, kind: 'turn', by_id: 'p_1', proposal: fx.chat[0]!.id, ask: 'method' }] }
    on({ ...fx, draft } as unknown as View)
    c = conversation([row({ ask: 'message' })], [], draft)
    expect(c.querySelector('[data-testid="view-chat-pressed"]')).toBeNull()
    expect(c.textContent).toContain(PREFILL)
    cleanup()
    c = conversation([row()], [], draft)
    expect(c.querySelector('[data-testid="view-chat-pressed"]')!.getAttribute('data-pressed')).toBe('method')
  })
})
