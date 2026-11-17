/**
 * Words-start (engine CONTRACT, overnight-20261117/words-start.md, 17 Nov): a person may start a scenario in words, with no model built, and keep
 * Olumi's ideas from that conversation. Real mounted ViewChat and ViewComposer, the real stores, a scripted fetch. Rows bind by identity: the
 * route and body each press sends (CONTRACT 1 and 2), the floor reply's `job`, and the View's `kept[].turn` (CONTRACT 3), each with a contrast.
 *
 * 1. ONE deliberate choice at the fresh composer; Send (build a model) stays the default and unchanged.
 * 2. A scenario started in words takes messages, never a second brief; the method icons wait for a model.
 * 3. Keep on a floor reply of a scenario core says was started in words; nothing on the first draft's reply or a running/failed job, and
 *    never a writer guessed from words (CONTRACT 4, revised 03:55Z).
 * All words are invented.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { useMe } from '../../../../olumiCore/me'
import { useCanvasStore } from '../../../../canvas/store'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { startedInWords, takesBrief, TALK_FIRST, ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { floorIdeaOf } from '../FloorKeep'
import { KEEP_IDEA, KEPT_IDEA } from '../../KeepIdea'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const SID = 's_00000000000e', UUID = '00000000-0000-4000-8000-00000000000e', MADE = 's_0000000000ab'
const BRIEF = 'Should the bike shop open a second workshop across town?'
const SAID = 'What would the second workshop need first?'
const OWN = 'A second workshop needs a mechanic before it needs a lease. Start by asking the two part-time mechanics about more hours.\n\nThen price a small unit near the station.'
const OWN_WORDS = 'A second workshop needs a mechanic before it needs a lease. Start by asking the two part-time mechanics about more hours. Then price a small unit near the station.'
const AT = '2026-11-17T04:00:00.000Z'
const row = (job: number, text = OWN) => ({ job, at: AT, by: 'Ada', by_id: '7', said: SAID, text })
/** A scenario core holds in words (CONTRACT 3): core's `start: "words"`, its brief, `draft: null`, no version, no proposal, no model. */
const inWords = (over: Record<string, unknown> = {}): View =>
  ({ ...golden('pricing'), id: SID, you_id: '7', you: 'Ada', brief: BRIEF, start: 'words', draft: null, version: null, proposal: null, model: null, chat: [], floor: [], ...over } as unknown as View)

let posts: { url: string; body: Record<string, unknown> }[] = [], answer: (url: string) => Response, served: (url: string) => View | null
const show = (view: View | null, sid: string | null = SID) => {
  useViewStore.setState({ uuid: sid === null ? UUID : UUID, sid, view, status: view === null ? 'none' : 'ready', error: null, stale: false, at: null })
  return render(<><ViewChat /><ViewComposer /></>).container
}
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const qa = (c: ParentNode, id: string) => [...c.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
const type = (c: HTMLElement, text: string) => fireEvent.change(c.querySelector('#view-chat-text')!, { target: { value: text } })
const press = async (el: HTMLElement | null) => { await act(async () => { fireEvent.click(el!) }) }
const floorTurn = (c: ParentNode, job: number) => c.querySelector<HTMLElement>(`[data-testid="view-floor-turn"][data-floor-job="${job}"]`)

beforeEach(() => {
  posts = []
  answer = () => new Response(JSON.stringify({ error: 'unscripted' }), { status: 500 })
  served = () => useViewStore.getState().view
  try { localStorage.clear(); sessionStorage.clear() } catch { /* none */ }
  window.history.replaceState(null, '', '/')
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setPagePerson(null); useMe.setState({ me: { id: '7', name: 'Ada' } } as never)
  useCanvasStore.setState({ currentScenarioId: UUID } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return answer(url) }
    const v = served(url)
    return v === null ? new Response(JSON.stringify({ error: 'not found' }), { status: 404 }) : new Response(JSON.stringify(v), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); useMe.setState({ me: null } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, wordsBrief: null })
})

describe('1. one deliberate choice at the fresh composer; Send stays the default', () => {
  it('"Talk it through first" creates the scenario in words (start: "words"), then sends the brief as its first message with an op derived from the brief\'s', async () => {
    answer = (url) => url === '/api/scenarios'
      ? new Response(JSON.stringify({ scenario: MADE, job: null, proposal: null, status_url: null }), { status: 200 })
      : new Response(JSON.stringify({ job: 41, status_url: null }), { status: 202 })
    served = (url) => (url.startsWith(`/api/scenarios/${MADE}/view`) ? inWords({ id: MADE }) : null)
    const c = show(null, null)
    expect(q(c, 'view-composer-talk-first')?.textContent).toBe(TALK_FIRST)
    type(c, BRIEF)
    await press(q(c, 'view-composer-talk-first'))
    await waitFor(() => expect(posts).toHaveLength(2))
    const op = posts[0]!.body['op'] as string
    expect(op).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(posts[0]).toEqual({ url: '/api/scenarios', body: { brief: BRIEF, op, start: 'words' } })
    expect(posts[1]).toEqual({ url: `/api/scenarios/${MADE}/messages`, body: { text: BRIEF, op: `${op}-m` } })
    expect(useCanvasStore.getState().currentScenarioId).toBe('00000000-0000-4000-8000-0000000000ab')
  })

  it('CONTRAST: Send on the same box posts the brief exactly as before (no `start`, no message): the default builds a model', async () => {
    answer = () => new Response(JSON.stringify({ scenario: MADE, job: { id: 5 }, proposal: null, status_url: null }), { status: 202 })
    served = (url) => (url.startsWith(`/api/scenarios/${MADE}/view`) ? inWords({ id: MADE, draft: { status: 'drafting', reason: null, at: AT, job: 5, stage: 'building', started: AT, words: 'Building the model' } }) : null)
    const c = show(null, null)
    type(c, BRIEF)
    await press(q(c, 'view-composer-send'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: '/api/scenarios', body: { brief: BRIEF, op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
  })

  it('a first message that does not go through: the brief is back in THIS scenario\'s box with core\'s words, and one Send asks again by the SAME op (never typed again)', async () => {
    const CAP = 'You have reached the number of Olumi answers for today.'
    let tries = 0
    answer = (url) => url === '/api/scenarios'
      ? new Response(JSON.stringify({ scenario: MADE, job: null, proposal: null, status_url: null }), { status: 200 })
      : (tries += 1) === 1 ? new Response(JSON.stringify({ error: CAP }), { status: 429 }) : new Response(JSON.stringify({ job: 41, status_url: null }), { status: 202 })
    served = (url) => (url.startsWith(`/api/scenarios/${MADE}/view`) ? inWords({ id: MADE }) : null)
    const c = show(null, null)
    type(c, BRIEF)
    await press(q(c, 'view-composer-talk-first'))
    await waitFor(() => expect(useViewChat.getState().said).toBe(CAP))
    expect(useViewChat.getState().text).toBe(BRIEF)
    expect(q(c, 'view-composer-talk-first')).toBeNull() // the scenario exists: a message now, not a second brief
    const op = posts[0]!.body['op'] as string
    await press(q(c, 'view-composer-send'))
    await waitFor(() => expect(posts).toHaveLength(3))
    expect(posts.map((p) => p.url)).toEqual(['/api/scenarios', `/api/scenarios/${MADE}/messages`, `/api/scenarios/${MADE}/messages`])
    expect(posts[2]!.body).toEqual({ text: BRIEF, op: `${op}-m` })
  })

  it('after a reload, a brief sent to start in words comes back with that choice and its op: Send replays the words start; CONTRAST: a model brief replays as a model brief', async () => {
    answer = () => new Response(JSON.stringify({ scenario: MADE, job: null, proposal: null, status_url: null }), { status: 200 })
    served = (url) => (url.startsWith(`/api/scenarios/${MADE}/view`) ? inWords({ id: MADE }) : null)
    const OP = 'aaaaaaaa-1111-4000-8000-000000000001'
    sessionStorage.setItem('olumi-pending-brief:7', JSON.stringify({ brief: BRIEF, op: OP, words: true }))
    const c = show(null, null)
    await waitFor(() => expect(useViewChat.getState().text).toBe(BRIEF))
    await press(q(c, 'view-composer-send'))
    await waitFor(() => expect(posts.length).toBeGreaterThanOrEqual(1))
    expect(posts[0]).toEqual({ url: '/api/scenarios', body: { brief: BRIEF, op: OP, start: 'words' } })
    cleanup(); posts = []
    useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, wordsBrief: null }); window.history.replaceState(null, '', '/')
    sessionStorage.setItem('olumi-pending-brief:7', JSON.stringify({ brief: BRIEF, op: OP }))
    const d = show(null, null)
    await waitFor(() => expect(useViewChat.getState().text).toBe(BRIEF))
    await press(q(d, 'view-composer-send'))
    await waitFor(() => expect(posts.length).toBeGreaterThanOrEqual(1))
    expect(posts[0]).toEqual({ url: '/api/scenarios', body: { brief: BRIEF, op: OP } })
  })

  it('the choice is offered only for a new brief: not on a scenario that holds a model (contrast: the fresh box above offers it)', () => {
    const c = show(golden('proposal'), golden('proposal').id)
    expect(q(c, 'view-composer-send')).not.toBeNull()
    expect(q(c, 'view-composer-talk-first')).toBeNull()
  })
})

describe('2. a scenario started in words takes messages, never a second brief', () => {
  it('read from core\'s `start: "words"`, never inferred: takesBrief is false for it; CONTRAST: the same nulls and brief WITHOUT `start` keep the old rule', () => {
    expect(startedInWords(inWords())).toBe(true)
    expect(takesBrief(SID, inWords())).toBe(false)
    expect(takesBrief(null, null)).toBe(true)
    expect(startedInWords(inWords({ start: undefined }))).toBe(false)
    expect(takesBrief(SID, inWords({ start: undefined }))).toBe(true)
  })

  it('what the person sends there is a message to THIS scenario, and the composer shows no method icons and no second choice', async () => {
    answer = () => new Response(JSON.stringify({ job: 42, status_url: null }), { status: 202 })
    const c = show(inWords({ floor: [row(9)] }))
    expect(qa(c, 'view-composer-talk-first')).toHaveLength(0)
    expect(c.querySelectorAll('[data-testid^="view-composer-method-"]')).toHaveLength(0)
    type(c, SAID)
    await press(q(c, 'view-composer-send'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.url).toBe(`/api/scenarios/${SID}/messages`)
    expect(posts[0]!.body['text']).toBe(SAID)
  })
})

describe('3. Keep on a floor reply that ended done, in Olumi\'s own words', () => {
  it('the reply offers the existing Keep; a press posts { floor: <job>, text } (no turn, no concerns) to core\'s kept route', async () => {
    answer = () => new Response(JSON.stringify({ kept: 77 }), { status: 201 })
    const c = show(inWords({ floor: [row(9)] }))
    const button = floorTurn(c, 9)!.querySelector<HTMLElement>('[data-testid="view-floor-keep-button"]')
    expect(button?.textContent).toBe(KEEP_IDEA)
    await press(button)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/kept`, body: { floor: 9, text: OWN_WORDS } })
  })

  it('"Kept" is read from the View: kept[].turn equals the floor job; CONTRAST: an idea kept from another job leaves Keep offered here', () => {
    const kept = (turn: number) => [{ id: 3, turn, text: OWN_WORDS, by: 'olumi', kept_by: { id: '7', name: 'Ada' }, at: AT, concerns: [], from: 'floor' }]
    const c = show(inWords({ floor: [row(9)], kept: kept(9) }))
    expect(floorTurn(c, 9)!.querySelector('[data-testid="view-floor-keep-kept"]')?.textContent).toBe(KEPT_IDEA)
    cleanup()
    const d = show(inWords({ floor: [row(9)], kept: kept(12) }))
    expect(floorTurn(d, 9)!.querySelector('[data-testid="view-floor-keep-button"]')).not.toBeNull()
  })

  it('nothing on the first draft\'s own reply (the brief\'s job); CONTRAST: the reply to a later message in the same thread offers Keep', () => {
    const failed = { status: 'failed', reason: null, at: AT, job: 7, stage: 'building', started: AT, words: 'Olumi could not finish this turn.' }
    const c = show(inWords({ draft: failed, floor: [row(7), row(9)] }))
    expect(floorTurn(c, 7)).not.toBeNull()
    expect(floorTurn(c, 7)!.querySelector('[data-testid="view-floor-keep"]')).toBeNull()
    expect(floorTurn(c, 9)!.querySelector('[data-testid="view-floor-keep-button"]')).not.toBeNull()
  })

  it('nothing on the job the View\'s turn still reports as failed; CONTRAST: a different job running leaves this reply\'s Keep', () => {
    const turn = (job: number, status: string) => ({ job, status, said: SAID, ask: 'message', by: 'Ada', by_id: '7', words: 'Olumi could not finish this turn.', started: AT, at: AT })
    const c = show(inWords({ floor: [row(9)], turn: turn(9, 'failed') }))
    expect(floorTurn(c, 9)!.querySelector('[data-testid="view-floor-keep"]')).toBeNull()
    cleanup()
    const d = show(inWords({ floor: [row(9)], turn: turn(10, 'answering') }))
    expect(floorTurn(d, 9)!.querySelector('[data-testid="view-floor-keep-button"]')).not.toBeNull()
  })

  it('offered only where core says the scenario was started in words; CONTRAST: the same floor reply on a scenario whose first model is building offers none', () => {
    const building = { status: 'drafting', reason: null, at: AT, job: 5, stage: 'building', started: AT, words: 'Building the model' }
    const c = show(inWords({ start: undefined, draft: building, floor: [row(9)] }))
    expect(floorTurn(c, 9)).not.toBeNull()
    expect(floorTurn(c, 9)!.querySelector('[data-testid="view-floor-keep"]')).toBeNull()
    cleanup()
    const d = show(inWords({ floor: [row(9)] }))
    expect(floorTurn(d, 9)!.querySelector('[data-testid="view-floor-keep-button"]')).not.toBeNull()
    expect(floorIdeaOf(OWN)).toBe(OWN_WORDS)
  })

  it('a refusal is core\'s own words beside the Keep, and nothing is shown as kept', async () => {
    const REFUSED = 'Those words are not in Olumi\'s reply.'
    answer = () => new Response(JSON.stringify({ error: REFUSED }), { status: 400 })
    const c = show(inWords({ floor: [row(9)] }))
    await press(floorTurn(c, 9)!.querySelector<HTMLElement>('[data-testid="view-floor-keep-button"]'))
    await waitFor(() => expect(floorTurn(c, 9)!.querySelector('[data-testid="view-floor-keep-said"]')?.textContent).toBe(REFUSED))
    expect(floorTurn(c, 9)!.querySelector('[data-testid="view-floor-keep-kept"]')).toBeNull()
  })
})
