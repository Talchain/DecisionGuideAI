/**
 * Words-start (engine CONTRACT, overnight-20261117/words-start.md, 17 Nov): a person may start a scenario in words, with no model built, and keep
 * Olumi's ideas from that conversation. Real mounted ViewChat and ViewComposer, the real stores, a scripted fetch. Rows bind by identity: the
 * route and body each press sends (CONTRACT 1 and 2), the floor reply's `job`, and the View's `kept[].turn` (CONTRACT 3), each with a contrast.
 *
 * 1. ONE deliberate choice at the fresh composer; Send (build a model) stays the default and unchanged.
 * 2. A scenario started in words takes messages, never a second brief; the method icons wait for a model.
 * 3. Keep from core's typed prose on the floor row (`floor[].prose`): each of Olumi's approaches on its own, never the host's lines; the
 *    paired row Codex names (menu press, floor reply, two individual ideas, Keep, develop, reopen with the source kept by `kept.from`).
 * 4. "Build a model from this", only where core offers it (`build_model`), in core's words.
 * 5. A saved message whose reply failed stays in the conversation (`floor[].unanswered`, sx-team 08:51Z; UI reviewer 08:43Z): their words under
 *    their name and core's own sentence, no reply, no Keep, no retry but the newest turn's, one bubble per job.
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
import { BUILD_FIELD, buildOfferOf, startedInWords, takesBrief, TALK_FIRST, ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { boardOfferOf, DraftingBoard } from '../../../DraftingBoard'
import { floorEntryOf, ideaMethodOf, keptIdeasOf } from '../../ideas'
import { floorOf, floorShown } from '../../../early'
import { ideaDetailOf, IdeaPanel } from '../../bands/IdeaPanel'
import { IDEA_PREFIX } from '../../bands/bands'
import { VIEW_IDEA } from '../../bands/BandNodes'
import { V10_METHODS } from '../../../../presentation/V10MethodChips'
import { sessionOf } from '../../../layout'
import { KEPT_IDEA } from '../../KeepIdea'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const SID = 's_00000000000e', UUID = '00000000-0000-4000-8000-00000000000e', MADE = 's_0000000000ab'
const BRIEF = 'Should the bike shop open a second workshop across town?'
const SAID = 'What would the second workshop need first?'
const OWN = 'A second workshop needs a mechanic before it needs a lease. Start by asking the two part-time mechanics about more hours.\n\nThen price a small unit near the station.'
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
  useCanvasStore.setState({ currentScenarioId: UUID, nodes: [] } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return answer(url) }
    if (url === '/api/me') return new Response(JSON.stringify({ me: { id: '7', name: 'Ada' } }), { status: 200 }) // core's answer to whose link this is (api.ts stillThisPerson)
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

  it('the first message\'s receipt is saved BEFORE the new scenario\'s View is read: a read that never answers leaves the brief to send by its op, and the brief\'s own receipt is gone', async () => {
    answer = () => new Response(JSON.stringify({ scenario: MADE, job: null, proposal: null, status_url: null }), { status: 200 })
    const hang = new Promise<Response>(() => {})
    setTeamFetch((async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return answer(url) }
      if (url === '/api/me') return new Response(JSON.stringify({ me: { id: '7', name: 'Ada' } }), { status: 200 })
      return url.startsWith(`/api/scenarios/${MADE}/view`) ? hang : new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    }) as unknown as typeof fetch)
    const c = show(null, null)
    type(c, BRIEF)
    await press(q(c, 'view-composer-talk-first'))
    await waitFor(() => expect(sessionStorage.getItem('olumi-pending-turn:7')).not.toBeNull())
    const op = posts[0]!.body['op'] as string
    expect(JSON.parse(sessionStorage.getItem('olumi-pending-turn:7')!)).toEqual({ sid: MADE, text: BRIEF, op: `${op}-m` })
    expect(sessionStorage.getItem('olumi-pending-brief:7')).toBeNull()
    expect(posts.map((p) => p.url)).toEqual(['/api/scenarios']) // nothing else sent while the read waits
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

  it('what the person sends there is a message to THIS scenario; the composer keeps its four method icons (they only fill the box) and offers no second choice', async () => {
    answer = () => new Response(JSON.stringify({ job: 42, status_url: null }), { status: 202 })
    const c = show(inWords({ floor: [row(9)] }))
    expect(qa(c, 'view-composer-talk-first')).toHaveLength(0)
    expect([...c.querySelectorAll('[data-testid^="view-composer-method-"]')].map((b) => b.getAttribute('data-testid'))).toEqual(V10_METHODS.map((m) => `view-composer-method-${m.key}`))
    type(c, SAID)
    await press(q(c, 'view-composer-send'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.url).toBe(`/api/scenarios/${SID}/messages`)
    expect(posts[0]!.body['text']).toBe(SAID)
  })
})

describe('3. Keep from core\'s typed prose on the floor row (CONTRACT 4; floor[].prose), never from its text', () => {
  // Core's own fixed accepting line (host text) followed by Olumi's two approaches, as core a641 serves it; only the approaches are prose.
  const HOST = 'There is no proposal waiting for your approval, so there is nothing to accept and no result changes.'
  const IDEA_A = 'Lend the second workshop’s tools to the first on quiet days.'
  const IDEA_B = 'Run a weekend repair stall at the station before signing a lease.'
  const METHOD = (v: View) => sessionOf(v)!.methods.find((m) => m.id === 'else_do')!
  const ideasRow = (job: number, said: string, prose: string[] | undefined) => ({ ...row(job), said, text: `${HOST}\n- ${IDEA_A}\n- ${IDEA_B}`, ...(prose === undefined ? {} : { prose }) })
  const keptRow = (id: number, job: number, text: string, from?: string) => ({ id, turn: job, text, by: 'olumi', kept_by: { id: '7', name: 'Ada' }, at: AT, concerns: [], ...(from ? { from } : {}) })
  const keepIn = (c: ParentNode, job: number) => [...floorTurn(c, job)!.querySelectorAll<HTMLElement>('[data-reply-list] li')]

  it('PAIRED: a menu press on a words scenario posts the existing method route; its floor reply offers each of Olumi\'s two approaches on its own, never the host line; each Keep posts { floor, text }', async () => {
    const said = METHOD(inWords()).text
    answer = (url) => (url.endsWith('/method') ? new Response(JSON.stringify({ proposal: null, discussion: true, job: 21 }), { status: 202 }) : new Response(JSON.stringify({ kept: 50 + posts.length }), { status: 201 }))
    const c = show(inWords())
    expect(q(c, 'view-actions-button')).not.toBeNull() // the thinking menu is offered with no model (Codex 04:27:24Z)
    await press(q(c, 'view-actions-button'))
    await press(c.querySelector<HTMLElement>('[data-testid="view-session-method"][data-method="else_do"]'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.url).toBe(`/api/scenarios/${SID}/method`)
    expect(posts[0]!.body['method']).toBe('else_do')
    cleanup(); posts = []
    const c2 = show(inWords({ floor: [ideasRow(21, said, [IDEA_A, IDEA_B])] }))
    const items = keepIn(c2, 21)
    expect(items.map((li) => li.textContent)).toEqual([IDEA_A, IDEA_B])
    expect(items.map((li) => li.querySelectorAll('[data-testid="view-keep-idea-button"]').length)).toEqual([1, 1])
    expect(floorTurn(c2, 21)!.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(2) // nothing on the host line
    await press(items[0]!.querySelector('[data-testid="view-keep-idea-button"]'))
    await press(items[1]!.querySelector('[data-testid="view-keep-idea-button"]'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts).toEqual([{ url: `/api/scenarios/${SID}/kept`, body: { floor: 21, text: IDEA_A } }, { url: `/api/scenarios/${SID}/kept`, body: { floor: 21, text: IDEA_B } }])
  })

  it('CONTRAST: the same reply WITHOUT prose (legacy, untyped, or a first draft\'s) offers no Keep at all', () => {
    const c = show(inWords({ floor: [ideasRow(21, SAID, undefined)] }))
    expect(keepIn(c, 21).map((li) => li.textContent)).toEqual([IDEA_A, IDEA_B])
    expect(floorTurn(c, 21)!.querySelectorAll('[data-testid="view-keep-idea"]')).toHaveLength(0)
  })

  it('a reply in paragraphs with the host\'s status line beside it: each prose entry is offered on its own line, as core serves it; nothing on the status line', async () => {
    const LINE_1 = 'A second workshop needs a mechanic before it needs a lease. Start by asking the two part-time mechanics about more hours.'
    const LINE_2 = 'Then price a small unit near the station.'
    const STATUS = 'The model Olumi is building will take this into account.'
    answer = () => new Response(JSON.stringify({ kept: 61 }), { status: 201 })
    const c = show(inWords({ floor: [{ ...row(9, `${OWN}\n\n${STATUS}`), prose: [LINE_1, LINE_2] }] }))
    const paras = [...floorTurn(c, 9)!.querySelectorAll<HTMLElement>('[data-reply-para]')]
    expect(paras.map((p) => p.textContent)).toEqual([LINE_1, LINE_2, STATUS])
    expect(paras.map((p) => p.querySelectorAll('[data-testid="view-keep-idea-button"]').length)).toEqual([1, 1, 0])
    await press(paras[1]!.querySelector('[data-testid="view-keep-idea-button"]'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/kept`, body: { floor: 9, text: LINE_2 } })
  })

  it('numbered lines and a long paragraph: each entry core serves (markers dropped) keeps its Keep and is sent VERBATIM, with no length cap; CONTRAST: a line that only ends with an entry after a word is not it', async () => {
    const LONG = Array.from({ length: 6 }, (_, k) => `Step ${k + 1} of the trial is to count the walk-in repairs on a different weekday and write down which jobs were turned away for lack of a bench.`).join(' ')
    expect([...LONG].length).toBeGreaterThan(400)
    answer = () => new Response(JSON.stringify({ kept: 70 + posts.length }), { status: 201 })
    const text = `1. ${IDEA_A}\n2) ${IDEA_B}\n\n${LONG}`
    const c = show(inWords({ floor: [{ ...row(31, text), prose: [IDEA_A, IDEA_B, LONG] }] }))
    const keeps = [...floorTurn(c, 31)!.querySelectorAll<HTMLElement>('[data-testid="view-keep-idea-button"]')]
    expect(keeps).toHaveLength(3)
    for (const k of keeps) await press(k)
    await waitFor(() => expect(posts).toHaveLength(3))
    expect(posts.map((p) => p.body['text'])).toEqual([IDEA_A, IDEA_B, LONG])
    expect(floorEntryOf([IDEA_A], `Never ${IDEA_A}`)).toBeNull()
    expect(floorEntryOf([IDEA_A], `• ${IDEA_A}`)).toBe(IDEA_A)
  })

  it('after the keeps and a COLD reopen: each approach reads "Kept", and each idea keeps its source and method from the floor (kept.from); CONTRAST: without `from` it is not looked up on the floor', () => {
    const said = METHOD(inWords()).text
    const view = inWords({ floor: [ideasRow(21, said, [IDEA_A, IDEA_B])], kept: [keptRow(50, 21, IDEA_A, 'floor'), keptRow(51, 21, IDEA_B, 'floor')] })
    useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null }) // a cold page
    const c = show(view)
    expect(keepIn(c, 21).map((li) => li.querySelector('[data-testid="view-keep-idea-kept"]')?.textContent)).toEqual([KEPT_IDEA, KEPT_IDEA])
    const ideas = keptIdeasOf(view)
    expect(ideas.map((i) => [i.text, i.fromFloor])).toEqual([[IDEA_A, true], [IDEA_B, true]])
    expect(ideaDetailOf(view, ideas[0]!).source).toBe(`From Olumi’s reply to “${said}”`)
    expect(ideaMethodOf(view, ideas[1]!)).toBe(said)
    const chatIdea = keptIdeasOf(inWords({ floor: [ideasRow(21, said, undefined)], kept: [keptRow(52, 21, IDEA_A)] }))[0]!
    expect(chatIdea.fromFloor).toBeUndefined()
    expect(ideaDetailOf(inWords({ floor: [ideasRow(21, said, undefined)] }), chatIdea).source).toBe('From a reply that is not in this conversation')
  })

  it('Develop and Challenge, pressed on the opened kept floor idea, put its exact words in the box; Send asks it on THIS scenario as a message (the floor path)', async () => {
    answer = () => new Response(JSON.stringify({ job: 43, status_url: null }), { status: 202 })
    const view = inWords({ floor: [ideasRow(21, SAID, [IDEA_A, IDEA_B])], kept: [keptRow(50, 21, IDEA_A, 'floor')] })
    const idea = keptIdeasOf(view)[0]!
    useCanvasStore.setState({ nodes: [{ id: IDEA_PREFIX + idea.id, type: VIEW_IDEA, selected: true, position: { x: 0, y: 0 }, data: {} }] } as never)
    useViewStore.setState({ uuid: UUID, sid: SID, view, status: 'ready', error: null, stale: false, at: null })
    const c = render(<><IdeaPanel /><ViewChat /><ViewComposer /></>).container
    expect(q(c, 'view-idea-panel-source')?.textContent).toBe(`From Olumi’s reply to “${SAID}”`)
    for (const button of ['view-idea-develop', 'view-idea-challenge']) {
      posts = []
      await press(q(c, button))
      const ask = useViewChat.getState().text
      expect(ask).toContain(`“${IDEA_A}”`)
      await press(q(c, 'view-composer-send'))
      await waitFor(() => expect(posts).toHaveLength(1))
      expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/messages`, body: { text: ask, op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
    }
    useCanvasStore.setState({ nodes: [] } as never)
  })

  it('a refusal is core\'s own words beside that Keep, and nothing is shown as kept', async () => {
    const REFUSED = 'Those words are not in Olumi\'s reply.'
    answer = () => new Response(JSON.stringify({ error: REFUSED }), { status: 400 })
    const c = show(inWords({ floor: [ideasRow(21, SAID, [IDEA_A, IDEA_B])] }))
    const first = keepIn(c, 21)[0]!
    await press(first.querySelector('[data-testid="view-keep-idea-button"]'))
    await waitFor(() => expect(first.querySelector('[data-testid="view-keep-idea-said"]')?.textContent).toBe(REFUSED))
    expect(floorTurn(c, 21)!.querySelector('[data-testid="view-keep-idea-kept"]')).toBeNull()
  })
})

describe('4. "Build a model from this": one plain item in the existing menu, only where core offers it, in core\'s words', () => {
  // Core's words for the offer (sx-team 06:11:29Z): top-level `build_model`, present only where a press would draft from the current reasoning.
  const OFFER = { label: 'Build a model from this', title: 'Olumi drafts a model from the conversation so far and the ideas kept, each under its author, for you to review.' }
  const withOffer = (over: Record<string, unknown> = {}) => inWords({ floor: [row(9)], [BUILD_FIELD]: OFFER, ...over })
  const openMenu = async (c: HTMLElement) => { await press(q(c, 'view-actions-button')) }

  it('drawn in the menu with core\'s label and core\'s title as its hover; a press posts the same write as Try again (POST …/draft with an op); CONTRAST: without core\'s field there is no such item', async () => {
    answer = () => new Response(JSON.stringify({ scenario: SID, job: { id: 30 }, proposal: null, status_url: null }), { status: 202 })
    const c = show(withOffer())
    await openMenu(c)
    const item = q(c, 'view-build-model')
    expect(item?.querySelector('[data-testid="view-build-model-label"]')?.textContent).toBe(OFFER.label) // the row's label (UI builder, 08:5xZ: the row also draws core's title)
    expect(item?.getAttribute('title')).toBe(OFFER.title)
    expect(q(c, 'view-actions-menu')!.querySelectorAll('[data-testid="view-build-model"]')).toHaveLength(1)
    await press(item)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/draft`, body: { op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
    expect(q(c, 'view-actions-menu')).toBeNull() // the menu closes on the press
    cleanup()
    const d = show(inWords({ floor: [row(9)] }))
    await openMenu(d)
    expect(q(d, 'view-actions-menu')).not.toBeNull()
    expect(q(d, 'view-build-model')).toBeNull()
    expect(buildOfferOf(inWords())).toBeNull()
  })

  it('an answer that does not come back keeps the op: the next press asks core again by the SAME op (one draft, never two)', async () => {
    let n = 0
    answer = () => ((n += 1) === 1 ? new Response(JSON.stringify({ error: 'Olumi could not do that this time. Try again in a moment.' }), { status: 503 }) : new Response(JSON.stringify({ scenario: SID, job: { id: 30 }, proposal: null, status_url: null }), { status: 202 }))
    const c = show(withOffer())
    await openMenu(c); await press(q(c, 'view-build-model'))
    await waitFor(() => expect(posts).toHaveLength(1))
    await openMenu(c); await press(q(c, 'view-build-model'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body['op']).toBe(posts[0]!.body['op'])
  })

  it('held while a past version is on the canvas (nothing is written there); CONTRAST: on the latest it can be pressed', async () => {
    const c = show(withOffer())
    useViewStore.setState({ at: 3 } as never)
    await openMenu(c)
    expect((q(c, 'view-build-model') as HTMLButtonElement | null)?.disabled).toBe(true)
    cleanup()
    const d = show(withOffer())
    await openMenu(d)
    expect((q(d, 'view-build-model') as HTMLButtonElement | null)?.disabled).toBe(false)
  })

  // 17 Nov (UI lead finding, DL GO 23:42:40Z): a words start left the canvas completely empty while the panel held the whole answer.
  const board = (view: View, at: number | null = null) => {
    cleanup(); useViewStore.setState({ uuid: UUID, sid: SID, view, status: 'ready', error: null, stale: false, at })
    return render(<DraftingBoard />).container
  }
  it('the EMPTY BOARD draws the same offer: core\'s label is its one press and core\'s line sits under it; the press posts the menu row\'s write (POST …/draft with an op)', async () => {
    answer = () => new Response(JSON.stringify({ scenario: SID, job: { id: 31 }, proposal: null, status_url: null }), { status: 202 })
    const c = board(withOffer()), go = q(c, 'view-build-board-go')
    expect([go?.tagName, go?.textContent, go?.getAttribute('data-view'), q(c, 'view-build-board-title')?.textContent]).toEqual(['BUTTON', OFFER.label, 'build_model.label', OFFER.title])
    expect(c.querySelectorAll('button'), 'one press, and no sentence of the page\'s').toHaveLength(1)
    expect(q(c, 'view-build-board')!.textContent).toBe(OFFER.label + OFFER.title)
    await press(go)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/draft`, body: { op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
  })
  it('CONTRAST: the board offers nothing without core\'s field, on a past version, once a draft is under way (the drafting state has the board), or where a version, proposal or model exists', () => {
    expect(q(board(inWords({ floor: [row(9)] })), 'view-build-board')).toBeNull()
    expect(q(board(withOffer(), 3), 'view-build-board')).toBeNull()
    const drafting = board(withOffer({ draft: { status: 'drafting', reason: null, at: AT, job: 5, stage: 'building', started: AT, words: 'Building the model' } }))
    expect([q(drafting, 'view-build-board'), q(drafting, 'view-drafting-board') !== null]).toEqual([null, true])
    expect([boardOfferOf(withOffer({ version: { n: 1 } })), boardOfferOf(withOffer({ proposal: { id: 1 } })), boardOfferOf(withOffer({ model: golden('pricing').model }))]).toEqual([null, null, null])
    expect([(golden('pricing').model?.cards.length ?? 0) > 0, boardOfferOf(withOffer())]).toEqual([true, OFFER])
  })
})

describe('5. A saved message whose reply failed stays in the conversation (floor[].unanswered), in core\'s words, with no reply, Keep or retry of its own', () => {
  const B_SAID = 'Could the second workshop share the van with the first?', C_SAID = 'How many repairs a week would it need to cover rent?'
  const FAILED = 'Olumi could not answer this time.', C_REPLY = 'About forty repairs a week would cover a small unit.', C_PROSE = ['About forty repairs a week would cover a small unit.']
  const bFailed = { job: 11, at: AT, by: 'Ben', by_id: '8', said: B_SAID, text: '', unanswered: { status: 'failed', words: FAILED } }
  const cAnswered = { job: 12, at: AT, by: 'Cleo', by_id: '9', said: C_SAID, text: C_REPLY, prose: C_PROSE }
  const bTurn = { job: 11, status: 'failed', said: B_SAID, ask: 'message', by: 'Ben', by_id: '8', words: FAILED, started: AT, at: AT }
  const bubblesOf = (c: ParentNode, said: string) => [...c.querySelectorAll('.ok-said')].filter((b) => b.textContent?.includes(said))

  it('PAIRED (B fails, C answers, cold read): B\'s words under Ben with core\'s failed sentence and no reply, Keep or Try again; C under Cleo with its reply and Keep; CONTRAST: the same empty row with no `unanswered` is not drawn', () => {
    const c = show(inWords({ floor: [bFailed, cAnswered] }))
    expect(qa(c, 'view-floor-turn').map((t) => t.getAttribute('data-floor-job'))).toEqual(['11', '12'])
    const b = floorTurn(c, 11)!, cc = floorTurn(c, 12)!
    expect(b.getAttribute('data-unanswered')).toBe('failed')
    expect(b.querySelector('[data-testid="view-floor-said"]')?.textContent).toBe(B_SAID)
    expect(b.querySelector('.ok-said-by')?.textContent).toBe('Ben')
    expect(b.querySelector('[data-testid="view-floor-unanswered"]')?.textContent).toBe(FAILED)
    expect(b.querySelector('[data-testid="view-floor-reply"]')).toBeNull()
    expect(b.querySelectorAll('[data-testid="view-keep-idea"]')).toHaveLength(0)
    expect(q(c, 'view-chat-turn-again')).toBeNull() // no historical retry
    expect(bubblesOf(c, B_SAID)).toHaveLength(1)
    expect(cc.querySelector('.ok-said-by')?.textContent).toBe('Cleo')
    expect(cc.querySelector('[data-testid="view-floor-reply-text"]')?.textContent).toContain(C_REPLY)
    expect(cc.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(1)
    expect(cc.getAttribute('data-unanswered')).toBeNull()
    cleanup()
    const { unanswered: _, ...bare } = bFailed
    const d = show(inWords({ floor: [bare, cAnswered] }))
    expect(qa(d, 'view-floor-turn').map((t) => t.getAttribute('data-floor-job'))).toEqual(['12'])
    expect(bubblesOf(d, B_SAID)).toHaveLength(0)
  })

  it('while B is still the newest turn it shows ONCE, with its one Try again, even if the floor also carried that job; CONTRAST: an earlier send of the same words (another job) stays its own row', () => {
    useMe.setState({ me: { id: '8', name: 'Ben' } } as never)
    const c = show(inWords({ you_id: '8', you: 'Ben', floor: [cAnswered, bFailed], turn: bTurn }))
    expect(bubblesOf(c, B_SAID)).toHaveLength(1)
    expect(floorTurn(c, 11)).toBeNull()
    expect(qa(c, 'view-chat-turn-again')).toHaveLength(1)
    expect(q(c, 'view-chat-turn-job')!.contains(q(c, 'view-chat-turn-again'))).toBe(true)
    expect(qa(c, 'view-chat-turn-words').map((w) => w.textContent)).toEqual([FAILED])
    cleanup()
    const d = show(inWords({ you_id: '8', you: 'Ben', floor: [{ ...bFailed, job: 10 }, cAnswered], turn: bTurn }))
    expect(bubblesOf(d, B_SAID)).toHaveLength(2) // two sends, two jobs: never merged by their words
    expect(floorTurn(d, 10)?.getAttribute('data-unanswered')).toBe('failed')
    expect(qa(d, 'view-chat-turn-again')).toHaveLength(1)
  })

  it('readers: only a well-typed `unanswered` on an empty reply keeps the row; a reply with text stays an ordinary reply; floorShown drops a floor copy of the newest turn by job alone', () => {
    const rows = (floor: unknown[]) => floorOf({ floor })
    expect(rows([bFailed])).toEqual([{ job: 11, at: AT, by: 'Ben', by_id: '8', said: B_SAID, text: '', unanswered: { status: 'failed', words: FAILED } }])
    expect(rows([{ ...bFailed, unanswered: { status: 'lost', words: null } }])[0]?.unanswered).toEqual({ status: 'lost', words: null })
    expect(rows([{ ...bFailed, unanswered: { status: 'stopped', words: FAILED } }])).toEqual([])
    expect(rows([{ ...bFailed, unanswered: { status: 'failed', words: 3 } }])).toEqual([])
    expect(rows([{ ...bFailed, said: ' ' }])).toEqual([])
    expect(rows([{ ...bFailed, prose: ['x'] }])[0]?.prose).toBeUndefined()
    expect(rows([{ ...cAnswered, unanswered: { status: 'failed', words: FAILED } }])[0]?.unanswered).toBeUndefined()
    expect(floorShown({ floor: [bFailed, cAnswered], turn: { job: 11 } } as never).map((f) => f.job)).toEqual([12])
    expect(floorShown({ floor: [bFailed, cAnswered], turn: { job: 13 } } as never).map((f) => f.job)).toEqual([11, 12])
    expect(floorShown({ floor: [cAnswered], turn: { job: 12 } } as never).map((f) => f.job)).toEqual([12]) // an answered row is never dropped
  })
})

describe('3b. Keep is reachable at rest beside the concise reply, not only inside "Full answer"', () => {
  const A = 'Lend the second workshop’s tools to the first on quiet days.'
  const B = 'Run a weekend repair stall at the station before signing a lease.'
  const C = 'Ask the part-time mechanics about more hours first.'
  const FULL = `A short opening.\n- ${A}\n- ${B}\n- ${C}`
  const withLead = (lead: { opening: string; points: string[] }, prose: string[] | undefined) =>
    inWords({ floor: [{ ...row(21, FULL), lead, ...(prose === undefined ? {} : { prose }) }] })
  const openFold = (c: ParentNode) => c.querySelector<HTMLDetailsElement>('[data-testid="view-reply-full"]')!
  it('RED/GREEN: a lead line carrying core\'s entry has its Keep outside the closed fold; pressing posts core\'s exact text with the floor job; the lead\'s other lines and the user\'s draft are untouched', async () => {
    answer = () => new Response(JSON.stringify({ kept: 80 }), { status: 201 })
    const c = show(withLead({ opening: 'A short opening.', points: [A, B] }, [A, B, C]))
    const t = floorTurn(c, 21)!
    const fold = openFold(t)
    expect(fold.open).toBe(false)
    const lead = t.querySelector('[data-testid="view-reply-lead"]')!
    const points = lead.querySelector('[data-testid="view-reply-lead-points"]')!
    const inLead = [...points.querySelectorAll<HTMLElement>('[data-testid="view-keep-idea-button"]')]
    expect(inLead.filter((b) => !fold.contains(b))).toHaveLength(2)
    expect([...points.querySelectorAll('li')].map((li) => li.querySelectorAll('[data-testid="view-keep-idea-button"]').length)).toEqual([1, 1])
    type(c, 'my draft')
    await press(inLead[0]!)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/kept`, body: { floor: 21, text: A } })
    expect((c.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('my draft')
  })
  it('ONE Keep per entry: an entry the lead carries is not offered again inside the fold; an entry no lead line carries keeps its Keep on its line inside the fold (no list of leftovers at rest)', async () => {
    answer = () => new Response(JSON.stringify({ kept: 81 }), { status: 201 })
    const c = show(withLead({ opening: 'A short opening.', points: [A, B] }, [A, B, C]))
    const t = floorTurn(c, 21)!, fold = openFold(t)
    const inFold = [...fold.querySelectorAll<HTMLElement>('[data-testid="view-keep-idea-button"]')]
    // A and B are offered in the lead only; C, which no lead line carries, is offered on its own line inside the fold.
    expect(inFold).toHaveLength(1)
    expect(inFold[0]!.closest('li')?.textContent).toContain(C)
    expect(qa(c, 'view-floor-keep-row')).toHaveLength(0)
    await press(inFold[0]!)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ floor: 21, text: C })
  })
  it('a line already kept shows kept in the lead; CONTRAST: no prose from core means no Keep anywhere, and no keep row', () => {
    const kept = { id: 50, turn: 21, text: A, by: 'olumi', kept_by: { id: '7', name: 'Ada' }, at: AT, concerns: [], from: 'floor' }
    const c = show({ ...withLead({ opening: 'A short opening.', points: [A, B] }, [A, B, C]), kept: [kept] } as unknown as View)
    const lead = c.querySelector('[data-testid="view-reply-lead-points"]')!
    expect([...lead.querySelectorAll('li')].map((li) => li.querySelector('[data-testid="view-keep-idea-kept"]') !== null)).toEqual([true, false])
    cleanup()
    const d = show(withLead({ opening: 'A short opening.', points: [A, B] }, undefined))
    expect([qa(d, 'view-keep-idea').length, qa(d, 'view-floor-keep-row').length]).toEqual([0, 0])
  })
})
