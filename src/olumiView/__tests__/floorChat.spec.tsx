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
    const view = noModel({ draft: draft('failed', EARLY), floor: [{ job: 7, at: AT, by: 'Paul', by_id: '7', said: BRIEF, text: EARLY }, floorRow] })
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
    const first = { job: 7, at: AT, by: 'Paul', by_id: '7', said: BRIEF, text: EARLY }
    const c = show(noModel({ draft: draft('failed'), floor: [first, floorRow] }), <ViewChat />)
    expect([...c.querySelectorAll('[data-testid="view-floor-said"]')].map((p) => p.textContent)).toEqual([BRIEF, SAID])
    cleanup()
    const none = show(noModel({ draft: draft('failed') }), <ViewChat />)
    expect(none.querySelector('[data-testid="view-floor-turn"]')).toBeNull()
    expect(none.querySelector('[data-testid="view-chat-turns"]')).toBeNull()
  })
  it('groups the projected brief, correction and authoritative reply by identity, including after reopening', () => {
    // Projected field names and accepted row ids from the Nov 14 preview. The second member is the same-words control.
    const g = golden('whatif'), saved = g.chat.find(t => t.answer !== null)!
    const other = { job: 47, at: AT, by: 'Jordan', by_id: '50', said: SAID, text: FLOOR_REPLY }
    const accepted = { seq: 28, kind: 'turn', job: 28, by_id: '7', ask: 'message', proposal: 41, discussion: false, state: 'applied' }
    const projection = { ...g, you_id: '7', draft: { ...draft('drafting'), status: 'done', job: 13, early: null, conversation: [
      { seq: 11, kind: 'brief', job: 13, by_id: '7', ask: null, proposal: 40, discussion: null, state: null },
      accepted,
      { ...accepted, seq: 47, job: 47, by_id: '50', proposal: null, discussion: null, state: null },
    ] }, floor: [other, { ...floorRow, job: 28 }], chat: [
      { ...saved, id: 40, by: 'Paul', by_id: '7', said: BRIEF, early: { text: EARLY } },
      { ...saved, id: 41, by: 'Paul', by_id: '7', said: SAID },
      { ...saved, id: 46, by: 'Paul', by_id: '7', said: 'Renamed the aim on the canvas' },
    ] } as unknown as View
    for (const view of [projection, JSON.parse(JSON.stringify(projection)) as View]) {
      const c = show(view, <ViewChat />)
      const rows = [...c.querySelectorAll('[data-testid="view-chat-turns"] > li')]
      expect(rows.map(r => r.querySelector('[data-view$=".said"],[data-testid="view-floor-said"]')?.textContent)).toEqual([BRIEF, SAID, 'Renamed the aim on the canvas', SAID])
      expect(rows[0]!.querySelectorAll('[data-testid="view-chat-early"]')).toHaveLength(1)
      expect(rows[1]!.querySelector('[data-floor-job="28"] [data-testid="view-floor-reply-text"]')).not.toBeNull()
      expect(rows[1]!.querySelector('[data-testid="view-chat-answer"]')).not.toBeNull()
      expect(rows[1]!.querySelector('[data-view$=".by"]')?.textContent).toBe('Paul')
      expect(rows[3]!.querySelector('[data-testid="view-floor-said-bubble"]')?.textContent).toContain('Jordan')
      // Contract 3: the newest floor exchange's marker is Olumi's reply in it, not the whole exchange.
      expect(rows[3]!.querySelector('[data-latest-floor]')?.getAttribute('data-testid')).toBe('view-floor-reply')
      cleanup()
    }
  })
  it('keeps the latest saved turn available when a newer floor reply follows', () => {
    const g = golden('whatif'), turn = g.chat.find(t => t.answer !== null)!
    const c = show({ ...g, chat: [turn], floor: [{ ...floorRow, job: turn.id + 8 }] } as unknown as View, <ViewChat />)
    expect(c.querySelector('[data-testid="view-chat-latest"]')?.getAttribute('data-view-turn')).toBe('chat.0')
    expect(c.querySelector('[data-latest-floor]')?.closest('[data-testid="view-floor-turn"]')?.textContent).toContain(SAID)
    expect(c.querySelector('[data-latest-floor]')?.getAttribute('data-testid')).toBe('view-floor-reply')
  })
  it('keeps a floor reply ahead of a later chat, including with an unfamiliar entry or an absent optional id', () => {
    const g = golden('whatif'), turn = { ...g.chat[0]!, by_id: '7', id: 90 }
    const conversation = [
      { seq: 10, kind: 'brief', job: 9, by_id: '7' },
      { seq: 15, kind: 'future-kind' },
      { seq: 20, kind: 'turn', by_id: '7', proposal: 90 },
    ]
    const c = show({ ...g, chat: [turn], floor: [floorRow], draft: { ...draft('failed'), conversation } } as unknown as View, <ViewChat />)
    const rows = c.querySelectorAll('[data-testid="view-chat-turns"] > li')
    expect(rows[0]?.getAttribute('data-floor-job')).toBe('9')
    expect(rows[1]?.getAttribute('data-view-turn')).toBe('chat.0')
  })
  it('collapses a failed retry with accepted IDs while retaining distinct earlier replies', () => {
    const g = golden('whatif'), ok = { ...g.chat.find(t => t.answer !== null)!, by_id: '7', said: SAID, id: 50 }
    const failed = { ...ok, id: 40, answer: null, problem: 'The reply failed.' }
    const conversation = [ { seq: 15, kind: 'turn', job: 15, proposal: 40, by_id: '7' },
      { seq: 20, kind: 'turn', job: 20, proposal: 50, by_id: '7' } ]
    const view = { ...g, chat: [failed, ok], draft: { ...draft('failed'), conversation }, floor: [] }
    const c = show(view as unknown as View, <ViewChat />)
    expect(c.querySelector('[data-view-turn="chat.0"]')).toBeNull()
    expect(c.querySelector('[data-view-turn="chat.1"]')).not.toBeNull()
    cleanup()
    const other = { ...floorRow, job: 15, by_id: '8', by: 'Another person' }
    const mismatch = show({ ...view, floor: [other] } as unknown as View, <ViewChat />)
    expect(mismatch.querySelector('[data-testid="view-floor-turn"]')?.textContent).toContain('Another person')
    expect(mismatch.querySelector('[data-view-turn="chat.1"] [data-floor-job="15"]')).toBeNull()
    cleanup()
    const distinct = show({ ...view, floor: [{ ...floorRow, job: 15 }] } as unknown as View, <ViewChat />)
    expect(distinct.querySelector('[data-view-turn="chat.0"] [data-floor-job="15"]')).not.toBeNull()
  })
  it('orders a newer kind by acceptance and groups its two replies only by their matching ids and author', () => {
    const g = golden('whatif'), saved = g.chat.find(t => t.answer !== null)!
    const chat = [
      { ...saved, id: 35, by_id: '8', said: SAID },
      { ...saved, id: 90, by_id: '7', said: SAID, early: { text: EARLY },
        answer: { ...saved.answer!, next: { ...saved.answer!.next, newest: true, move: 'ask:challenge' } } },
    ]
    // The second proposal was accepted first. Its two equally worded replies may only be coalesced for a known brief.
    const conversation = [
      { seq: 10, kind: 'future-kind', job: 50, proposal: 90, by_id: '7' },
      { seq: 20, kind: 'turn', job: 31, proposal: 35, by_id: '8' },
    ]
    const view = { ...g, chat, floor: [{ ...floorRow, job: 50, text: EARLY }], draft: { ...draft('failed'), conversation } }
    const c = show(view as unknown as View, <ViewChat />)
    const rows = c.querySelectorAll('[data-testid="view-chat-turns"] > li')
    expect([...rows].map(r => r.getAttribute('data-view-turn'))).toEqual(['chat.1', 'chat.0'])
    expect(rows[0]!.querySelector('[data-testid="view-chat-early"]')?.textContent).toContain('Start with the shortest route.')
    expect(rows[0]!.querySelector('[data-floor-job="50"]')?.textContent).toContain('Start with the shortest route.')
    expect(rows[0]!.querySelectorAll('[data-testid="view-chat-said-bubble"]')).toHaveLength(1)
    expect(rows[1]!.getAttribute('data-testid')).toBe('view-chat-latest')
    expect(rows[0]!.querySelector('button[data-move="ask:challenge"]')).not.toBeNull()
    expect(rows[1]!.querySelector('button[data-move]')).toBeNull()
  })
  it('keeps a failed attempt with its early answer and preserves two legacy contributions whose author is unknown', () => {
    const g = golden('whatif'), ok = { ...g.chat.find(t => t.answer !== null)!, by_id: '7', said: SAID }
    const failed = { ...ok, id: 40, answer: null, problem: 'The reply failed.' }
    const view = { ...g, chat: [{ ...failed, early: { text: EARLY } }, { ...ok, id: 50 }] }
    const c = show(view as unknown as View, <ViewChat />)
    expect(c.querySelector('[data-view-turn="chat.0"] [data-testid="view-chat-early"]')?.textContent).toContain('Start with the shortest route.')
    expect(c.querySelector('[data-view-turn="chat.1"] [data-testid="view-chat-answer"]')).not.toBeNull()
    cleanup()
    const legacy = show({ ...g, chat: [{ ...failed, by_id: null }, { ...ok, id: 50, by_id: null }] }, <ViewChat />)
    expect(legacy.querySelectorAll('[data-testid="view-chat-said-bubble"]')).toHaveLength(2)
  })
  it('merges unpaired floor jobs in acceptance order when their outcomes completed in reverse', () => {
    const g = golden('whatif'), saved = { ...g.chat[0]!, id: 90, by_id: '7' }
    const conversation = [{ seq: 20, kind: 'turn', job: 20, proposal: 90, by_id: '7' }]
    const late = { ...floorRow, job: 30, text: 'A. Completed first.' }
    const early = { ...floorRow, job: 10, text: 'Z. Completed last.' }
    const c = show({ ...g, chat: [saved], floor: [late, early], draft: { ...draft('failed'), conversation } } as unknown as View, <ViewChat />)
    const rows = c.querySelectorAll('[data-testid="view-chat-turns"] > li')
    expect([...rows].map(r => r.getAttribute('data-floor-job') ?? r.getAttribute('data-view-turn'))).toEqual(['10', 'chat.0', '30'])
  })
  it('without accepted ids, keeps saved chat and floor order and never swallows a separate job with the same words', () => {
    const g = golden('whatif')
    const a = { ...floorRow, job: 18, said: 'FIRST SENT' }, b = { ...floorRow, job: 6, said: 'SECOND SENT' }
    const c = show({ ...g, floor: [a, b] } as unknown as View, <ViewChat />)
    const order = [...c.querySelectorAll('[data-view-turn], [data-testid="view-floor-turn"]')].map(e => e.getAttribute('data-view-turn') ?? e.querySelector('[data-testid="view-floor-said"]')!.textContent)
    expect(order).toEqual([...g.chat.map((_, i) => `chat.${i}`), 'FIRST SENT', 'SECOND SENT'])
    cleanup()
    const later = { ...floorRow, job: 10, said: BRIEF, text: EARLY }
    const same = show(noModel({ draft: draft('failed', EARLY), floor: [later] }), <ViewChat />)
    expect(same.querySelector('[data-testid="view-floor-said"]')?.textContent).toBe(BRIEF)
  })
  it('retains distinct answers across draft retries, including a brief floor that disagrees with the answer on the board', () => {
    const original = { ...floorRow, job: 7, said: BRIEF, text: EARLY }
    const retryAnswer = 'A later draft attempt found a different issue.'
    const sameJobDifferentReply = show(noModel({ draft: draft('failed', retryAnswer), floor: [original] }), <ViewChat />)
    expect(sameJobDifferentReply.querySelector('[data-testid="view-floor-reply"]')?.textContent).toContain('A month is tight')
    cleanup()
    const first = { seq: 2, kind: 'brief', job: 7, by_id: '7', proposal: 40, ask: null, discussion: null, state: null }
    const saved = { ...golden('whatif').chat[0]!, id: 40, by: 'Paul', by_id: '7', said: BRIEF, early: { text: retryAnswer } }
    const newerDraft = { ...draft('failed'), job: 19, conversation: [first] }
    const v = { ...golden('whatif'), chat: [saved], floor: [original], draft: newerDraft } as unknown as View
    const c = show(v, <ViewChat />)
    const row = c.querySelector('[data-testid="view-chat-turns"] > li')!
    expect(row.querySelector('[data-testid="view-chat-early"]')?.textContent).toContain(retryAnswer)
    expect(row.querySelector('[data-testid="view-floor-reply-text"]')?.textContent).toContain('A month is tight')
    expect(row.querySelectorAll('[data-testid="view-chat-said-bubble"]')).toHaveLength(1)
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
