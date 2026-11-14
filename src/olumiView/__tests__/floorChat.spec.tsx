/**
 * THE MODEL-LESS CONVERSATION (core `view.floor`, 14 Nov) and the composer while the first model builds. Real mounted ViewChat and
 * ViewComposer, the real stores, a scripted fetch. Rows bind by identity: the exact words of the person's message and Olumi's reply, the
 * route a Send goes to (a message to THIS scenario, never a new scenario), core's own refusal line, and DOM order against the saved turns.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { useMe } from '../../olumiCore/me'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { DraftingBoard } from '../DraftingBoard'
import { onFloor, floorOf, floorShown } from '../early'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const SID = 's_00000000000f', UUID = '00000000-0000-4000-8000-00000000000f'
const AT = '2026-11-14T08:00:00.000Z'
const BRIEF = 'Can we raise a seed round in a month?'
const EARLY = 'A month is tight for a raise.\n\nStart with the shortest route.'
const FLOOR_REPLY = 'Two weeks is tight.\n\nLenders usually want:\n- two years of accounts\n- a clear use of funds'
const SAID = 'What if an angel cheque comes first?'
const draft = (status: 'drafting' | 'failed', early?: string) => ({ status, reason: null, at: AT, job: 7, stage: 'building', started: AT, words: status === 'drafting' ? 'Building the model' : 'Olumi could not finish this turn.', ...(early ? { early: { text: early } } : {}) })
const noModel = (over: Record<string, unknown>): View => ({ ...golden('pricing'), id: SID, you_id: '7', you: 'Paul', brief: BRIEF, version: null, proposal: null, model: null, chat: [], ...over } as unknown as View)
const floorRow = { job: 9, at: '2026-11-14T08:05:00.000Z', by: 'Paul', by_id: '7', said: SAID, text: FLOOR_REPLY }

let posts: { url: string; body: unknown }[] = [], post: (url: string) => Response
const show = (view: View, ui: JSX.Element) => { useViewStore.setState({ uuid: UUID, sid: SID, view, status: 'ready', error: null, stale: false, at: null }); return render(ui).container }
beforeEach(() => {
  posts = []; post = () => new Response(JSON.stringify({ error: 'unscripted' }), { status: 500 })
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setPagePerson(null); useMe.setState({ me: { id: '7', name: 'Paul' } } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return post(url) }
    return new Response(JSON.stringify(useViewStore.getState().view), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); useMe.setState({ me: null } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
})
const type = (c: HTMLElement, text: string) => { fireEvent.change(c.querySelector('#view-chat-text')!, { target: { value: text } }) }
const send = async (c: HTMLElement) => { await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-composer-send"]')!) }) }

describe('view.floor is drawn as an ordinary conversation where the chat is', () => {
  it('after a failed build: the person\'s words and Olumi\'s reply, as paragraphs and list items, no label; the brief\'s own answer is not drawn twice', () => {
    const view = noModel({ draft: draft('failed', EARLY), floor: [{ job: 8, at: AT, by: 'Paul', by_id: '7', said: BRIEF, text: EARLY }, floorRow] })
    const c = show(view, <ViewChat />)
    const turns = [...c.querySelectorAll('[data-testid="view-floor-turn"]')]
    expect(turns).toHaveLength(1) // the brief's reply equals draft.early (the board draws it): once
    expect(turns[0]!.querySelector('[data-testid="view-floor-said"]')?.textContent).toBe(SAID)
    const reply = turns[0]!.querySelector('[data-testid="view-floor-reply-text"]')!
    expect([...reply.querySelectorAll('[data-reply-para]')].map((p) => p.textContent)).toEqual(['Two weeks is tight.', 'Lenders usually want:'])
    expect([...reply.querySelectorAll('[data-reply-list] li')].map((l) => l.textContent)).toEqual(['two years of accounts', 'a clear use of funds'])
    expect(c.querySelector('[data-testid="view-floor-reply-text-label"]')).toBeNull()
    expect(turns[0]!.getAttribute('data-floor-job')).toBe('9')
  })
  it('contrast: with no early on the board the brief\'s reply IS drawn, in order, before the later exchange; absent field = today\'s empty thread', () => {
    const first = { job: 8, at: AT, by: 'Paul', by_id: '7', said: BRIEF, text: EARLY }
    const c = show(noModel({ draft: draft('failed'), floor: [first, floorRow] }), <ViewChat />)
    expect([...c.querySelectorAll('[data-testid="view-floor-said"]')].map((p) => p.textContent)).toEqual([BRIEF, SAID])
    cleanup()
    const none = show(noModel({ draft: draft('failed') }), <ViewChat />)
    expect(none.querySelector('[data-testid="view-floor-turn"]')).toBeNull()
    expect(none.querySelector('[data-testid="view-chat-turns"]')).toBeNull()
  })
  it('ordering uses only what the service sends: `order` on every row places a floor reply among saved turns', () => {
    const g = golden('whatif')
    const base = { ...g, chat: g.chat.map((t, i) => ({ ...t, order: (i + 1) * 10 })) } as unknown as View
    const early = { ...floorRow, job: 1, order: 5, said: 'EARLIER' }, late = { ...floorRow, job: 2, order: (base.chat.length + 1) * 10, said: 'LATER' }
    const c = show({ ...base, floor: [late, early] } as unknown as View, <ViewChat />)
    const order = [...c.querySelectorAll('[data-view-turn], [data-testid="view-floor-turn"]')].map((e) => e.getAttribute('data-view-turn') ?? e.querySelector('[data-testid="view-floor-said"]')!.textContent)
    expect(order[0]).toBe('EARLIER')
    expect(order[order.length - 1]).toBe('LATER')
    expect(order.slice(1, -1)).toEqual(base.chat.map((_, i) => `chat.${i}`))
  })
  it('contrast: with no `order` (and a `chat[i].at` the service does not serve) the array order sent stands: turns, then the floor as sent; `at` is never read', () => {
    const g = golden('whatif'), T0 = Date.parse(AT)
    // a stray `at` on the turns, which would reorder them if read, is ignored
    const base = { ...g, chat: g.chat.map((t, i) => ({ ...t, at: new Date(T0 + (g.chat.length - i) * 60_000).toISOString() })) } as unknown as View
    const a = { ...floorRow, job: 1, said: 'FIRST SENT' }, b = { ...floorRow, job: 2, said: 'SECOND SENT' }
    const c = show({ ...base, floor: [a, b] } as unknown as View, <ViewChat />)
    const order = [...c.querySelectorAll('[data-view-turn], [data-testid="view-floor-turn"]')].map((e) => e.getAttribute('data-view-turn') ?? e.querySelector('[data-testid="view-floor-said"]')!.textContent)
    expect(order).toEqual([...base.chat.map((_, i) => `chat.${i}`), 'FIRST SENT', 'SECOND SENT'])
  })
  it('one row without `order` drops the whole thread back to the array order sent (no partial guess)', () => {
    const a = { ...floorRow, job: 1, order: 9, said: 'A SENT FIRST' }, b = { ...floorRow, job: 2, order: 1, said: 'B SENT SECOND' }, c2 = { ...floorRow, job: 3, said: 'C NO ORDER' }
    const c = show(noModel({ draft: draft('failed'), floor: [a, b, c2] }), <ViewChat />)
    expect([...c.querySelectorAll('[data-testid="view-floor-said"]')].map((p) => p.textContent)).toEqual(['A SENT FIRST', 'B SENT SECOND', 'C NO ORDER'])
    cleanup()
    const d = show(noModel({ draft: draft('failed'), floor: [a, b] }), <ViewChat />)
    expect([...d.querySelectorAll('[data-testid="view-floor-said"]')].map((p) => p.textContent)).toEqual(['B SENT SECOND', 'A SENT FIRST'])
  })
  it('readers: malformed floor entries are dropped, absent is none, onFloor needs no model and a build that is running or kept something', () => {
    expect(floorOf({ floor: [{ job: 1, at: AT, by: 'a', by_id: 'b', said: 's', text: 't' }, { job: 'x' }, null, { job: 2, at: AT, said: 's', text: ' ' }] })).toHaveLength(1)
    expect(floorOf({})).toEqual([])
    expect(onFloor(noModel({ draft: draft('drafting') }))).toBe(true)
    expect(onFloor(noModel({ draft: draft('failed', EARLY) }))).toBe(true)
    expect(onFloor(noModel({ draft: draft('failed') }))).toBe(true) // a saved brief, nothing kept: still this scenario
    expect(onFloor(noModel({ draft: draft('failed'), brief: '' }))).toBe(false) // no brief held: today's rule
    expect(onFloor(noModel({ draft: draft('failed'), floor: [floorRow] }))).toBe(true)
    expect(onFloor(golden('whatif'))).toBe(false)
    expect(floorShown(noModel({ draft: draft('failed'), floor: [floorRow] }))).toHaveLength(1)
  })
})

describe('the composer while the first model builds, and after a failed build', () => {
  it('while it builds: Send is enabled once something is typed, and goes to THIS scenario as a message, never as a new brief', async () => {
    const c = show(noModel({ draft: draft('drafting', EARLY) }), <ViewComposer />)
    const box = c.querySelector<HTMLTextAreaElement>('#view-chat-text')!
    expect(box.disabled).toBe(false)
    post = () => new Response(JSON.stringify({ scenario: SID, job: null, proposal: 4, discussion: true, status_url: null }), { status: 202 })
    type(c, SAID)
    expect(c.querySelector<HTMLButtonElement>('[data-testid="view-composer-send"]')!.disabled).toBe(false)
    await send(c)
    expect(posts.map((p) => p.url)).toEqual([`/api/scenarios/${SID}/messages`])
    expect((posts[0]!.body as { text: string }).text).toBe(SAID)
  })
  it('core still refuses a message while the model builds (409): its own line is shown, the words stay in the box, nothing crashes', async () => {
    const REFUSAL = 'this scenario has no model yet'
    const c = show(noModel({ draft: draft('drafting') }), <ViewComposer />)
    post = () => new Response(JSON.stringify({ error: REFUSAL }), { status: 409 })
    type(c, SAID)
    await send(c)
    expect(c.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe(REFUSAL)
    expect(c.querySelector<HTMLTextAreaElement>('#view-chat-text')!.value).toBe(SAID)
    expect(posts).toHaveLength(1)
  })
  it('after a failed build that kept Olumi\'s answer: the composer asks a follow-up of the same scenario (a message), not a new brief', async () => {
    const c = show(noModel({ draft: draft('failed', EARLY) }), <ViewComposer />)
    expect(c.querySelector('label[for="view-chat-text"]')?.textContent).toBe('Message Olumi')
    expect(c.querySelector('[data-testid="view-brief-intro"]')).toBeNull()
    post = () => new Response(JSON.stringify({ scenario: SID, job: null, proposal: 4, discussion: true, status_url: null }), { status: 202 })
    type(c, SAID)
    await send(c)
    expect(posts.map((p) => p.url)).toEqual([`/api/scenarios/${SID}/messages`])
  })
  it('a failed first draft with a saved brief and NO early answer: the next message posts to THIS scenario (a message), never a new scenario', async () => {
    const c = show(noModel({ draft: draft('failed') }), <ViewComposer />)
    expect(c.querySelector('label[for="view-chat-text"]')?.textContent).toBe('Message Olumi')
    post = () => new Response(JSON.stringify({ scenario: SID, job: null, proposal: 4, discussion: true, status_url: null }), { status: 202 })
    type(c, SAID)
    await send(c)
    expect(posts.map((p) => p.url)).toEqual([`/api/scenarios/${SID}/messages`])
    expect(posts.some((p) => p.url === '/api/scenarios')).toBe(false)
    expect((posts[0]!.body as { text: string }).text).toBe(SAID)
  })
  it('contrast: no scenario yet (nothing on screen) still takes a brief and starts one', () => {
    useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null })
    const c = render(<ViewComposer />).container
    expect(c.querySelector('label[for="view-chat-text"]')?.textContent).toBe('Your brief')
  })
  it('Try again after a failed first draft retries THE SAME scenario (its draft route, a new op), and the composer stays usable', async () => {
    const c = show(noModel({ draft: draft('failed') }), <div><DraftingBoard /><ViewComposer /></div>)
    expect(c.querySelector<HTMLTextAreaElement>('#view-chat-text')!.disabled).toBe(false)
    post = () => new Response(JSON.stringify({ scenario: SID, job: 8, status_url: null }), { status: 202 })
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-drafting-again"]')!) })
    expect(posts.map((p) => p.url)).toEqual([`/api/scenarios/${SID}/draft`])
    expect(typeof (posts[0]!.body as { op: unknown }).op).toBe('string')
  })
  it('the saved brief stays readable on the failed board (ported from the new-look line, a5ba906de): the exact words; absent brief draws nothing', () => {
    const c = show(noModel({ draft: draft('failed') }), <DraftingBoard />)
    expect(c.querySelector('[data-testid="view-draft-brief"] p')?.textContent).toBe(BRIEF)
    cleanup()
    const none = show(noModel({ draft: draft('failed'), brief: '' }), <DraftingBoard />)
    expect(none.querySelector('[data-testid="view-draft-brief"]')).toBeNull()
  })
  it('a Try again that does not go through leaves the same scenario on screen and the composer usable', async () => {
    const c = show(noModel({ draft: draft('failed') }), <div><DraftingBoard /><ViewComposer /></div>)
    post = () => new Response(JSON.stringify({ error: 'busy' }), { status: 409 })
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-drafting-again"]')!) })
    expect(useViewStore.getState().sid).toBe(SID)
    expect(c.querySelector<HTMLTextAreaElement>('#view-chat-text')!.disabled).toBe(false)
    expect(posts.every((p) => p.url !== '/api/scenarios')).toBe(true)
  })
})
