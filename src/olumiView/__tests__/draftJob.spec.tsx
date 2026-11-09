/**
 * AI jobs, slice 1 (core API v1.26, 8 Nov 2026): a brief is accepted at once and drafted in the server; the View's `draft` carries the
 * job's state in core's words. One row per UI case: the board draws core's words verbatim; the one poller reads about every 1.5 s only while
 * the scenario on screen drafts, then the normal refresh; a failed read or a move to another scenario never mixes state, never marks the
 * draft failed and never sends the brief again; a reload resumes the same job; an acceptance answer lost on the way is asked again after a
 * reload by the SAME op, and only on Send. Real stores and poller, a scripted fetch, fake timers with bounded advances.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { useMe } from '../../olumiCore/me'
import type { View } from '../client'
import { useViewStore } from '../store'
import { DRAFT_POLL_MS, POLL_MS, useViewPoll } from '../poll'
import { useCanvasStore } from '../../canvas/store'
import { ViewComposer, isDrafting, pendingBrief, useViewChat } from '../ViewChat'
import { DraftingBoard, boardDraftOf } from '../DraftingBoard'

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const SID_A = 's_00000000000a', UUID_A = '00000000-0000-4000-8000-00000000000a'
const SID_B = 's_00000000000b', UUID_B = '00000000-0000-4000-8000-00000000000b'
const STARTED = '2026-11-08T15:00:00.000Z'
type Stage = 'reading' | 'building' | 'analysing'
const WORDS: Record<Stage, string> = { reading: 'Reading the brief', building: 'Building the model', analysing: 'Running the analysis and guidance' }
/** The View of a scenario whose first draft (job 7) is running at `stage`; `done` is its View once the proposal landed. */
const drafting = (sid: string, stage: Stage): View => ({ ...golden('pricing'), id: sid, you_id: '7', version: null, proposal: null, model: null, chat: [],
  draft: { status: 'drafting', reason: null, at: STARTED, job: 7, stage, words: WORDS[stage], started: STARTED } } as unknown as View)
const done = (sid: string): View => ({ ...golden('proposal'), id: sid, you_id: '7', draft: { status: 'done', reason: null, at: STARTED, job: 7, stage: 'analysing', words: null, started: STARTED } } as unknown as View)

let served = new Map<string, View | 'fail'>(), reads: string[] = [], posts: { url: string; body: unknown }[] = [], post: (url: string, body: unknown) => Response | Promise<Response>
let hold: Promise<void> | null = null
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(Date.parse('2026-11-08T15:00:04.000Z'))
  served = new Map(); reads = []; posts = []; hold = null
  post = () => new Response(JSON.stringify({ error: 'unscripted' }), { status: 500 })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  try { sessionStorage.clear() } catch { /* none */ }
  setPagePerson(null)
  useMe.setState({ me: { id: '7', name: 'Paul' } } as never)
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (url === '/api/me') return new Response(JSON.stringify({ me: { id: '7', name: 'Paul' } }), { status: 200 })
    if (init?.method === 'POST') { const body = JSON.parse(String(init.body)); posts.push({ url, body }); return post(url, body) }
    reads.push(url)
    const sid = /\/api\/scenarios\/([^/]+)\/view/.exec(url)?.[1] ?? ''
    if (hold) await hold
    const v = served.get(sid)
    return v === undefined || v === 'fail' ? new Response(JSON.stringify({ error: 'Olumi could not do that this time.' }), { status: 500 }) : new Response(JSON.stringify(v), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => {
  cleanup(); vi.useRealTimers(); setTeamFetch(null); setPagePerson(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
  useMe.setState({ me: null } as never)
})
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const on = (sid: string, uuid: string, view: View) => useViewStore.setState({ uuid, sid, view, status: 'ready', error: null, stale: false, at: null })

describe('the drafting board', () => {
  it('U1 draws core\'s words verbatim as an accessible status, with the seconds since core accepted the brief, so a reload counts from the same moment', async () => {
    on(SID_A, UUID_A, drafting(SID_A, 'building'))
    const first = render(<DraftingBoard />).container
    const status = first.querySelector('[data-testid="view-drafting-board"] [role="status"]')!
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(first.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model')
    expect(first.querySelector('[data-testid="view-drafting-seconds"]')?.textContent).toBe('4 s')
    cleanup()
    vi.setSystemTime(Date.parse('2026-11-08T15:00:30.000Z')) // a reload later: the count is core's, not reset by the page
    const again = render(<DraftingBoard />).container
    expect(again.querySelector('[data-testid="view-drafting-seconds"]')?.textContent).toBe('30 s')
    // A failed draft shows its plain reason, verbatim, and Try again; a View with a model or a proposal shows no board.
    on(SID_A, UUID_A, { ...drafting(SID_A, 'building'), draft: { status: 'failed', reason: 'Olumi could not finish this turn. Please try again in a moment.', at: STARTED, job: 7, stage: 'building', words: 'Olumi could not finish this turn. Please try again in a moment.', started: STARTED } } as unknown as View)
    await tick(0)
    expect(again.querySelector('[data-view="draft.words"]')?.textContent).toBe('Olumi could not finish this turn. Please try again in a moment.')
    expect(again.querySelector('[data-testid="view-drafting-again"]')).not.toBeNull()
    expect(boardDraftOf(done(SID_A))).toBeNull()
  })

  it('U1b Try again sends a new attempt on the saved brief (POST …/draft with an op), never the brief again', async () => {
    on(SID_A, UUID_A, { ...drafting(SID_A, 'building'), draft: { status: 'lost', reason: 'The server restarted while Olumi was working on this, so it did not finish.', at: STARTED, job: 7, stage: 'building', words: 'The server restarted while Olumi was working on this, so it did not finish.', started: STARTED } } as unknown as View)
    served.set(SID_A, drafting(SID_A, 'reading'))
    post = () => new Response(JSON.stringify({ scenario: SID_A, job: { id: 9, status: 'running' }, proposal: null, status_url: `/api/scenarios/${SID_A}/jobs/9` }), { status: 202 })
    const c = render(<DraftingBoard />).container
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-drafting-again"]')!) })
    await tick(0)
    expect(posts).toEqual([{ url: `/api/scenarios/${SID_A}/draft`, body: { op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
  })

  // Stop (core c94d6bd5, API v1.34; DL 9 Nov): core's words, verbatim (src/words/draft.ts STOP_CONTROL and stoppedWords).
  const STOP = { label: 'Stop', title: 'Stop drafting this first model. Your brief is kept.' }
  const STOPPED = 'You stopped this draft, so Olumi will not finish it. Your brief is kept: Try again drafts it afresh.'
  it('U1c its author sees core\'s Stop while it drafts; pressing it posts …/jobs/7/stop with {} and reads the View again; anyone else sees none', async () => {
    on(SID_A, UUID_A, { ...drafting(SID_A, 'building'), draft: { ...drafting(SID_A, 'building').draft!, stop: STOP } } as unknown as View)
    const stopped = { ...drafting(SID_A, 'building'), draft: { status: 'stopped', reason: null, at: STARTED, job: 7, stage: 'building', words: STOPPED, started: STARTED, by: 'Paul', by_id: '7', stop: null } } as unknown as View
    served.set(SID_A, stopped)
    post = () => new Response(JSON.stringify({ id: 7, kind: 'draft', scenario: SID_A, status: 'stopped' }), { status: 200 })
    const c = render(<DraftingBoard />).container
    const stop = c.querySelector<HTMLButtonElement>('[data-testid="view-drafting-stop"]')!
    expect([stop.textContent, stop.getAttribute('title'), stop.getAttribute('data-view')]).toEqual([STOP.label, STOP.title, 'draft.stop.label'])
    await act(async () => { fireEvent.click(stop) })
    await tick(0)
    expect(posts).toEqual([{ url: `/api/scenarios/${SID_A}/jobs/7/stop`, body: {} }])
    expect(reads.some((u) => u.includes(`/api/scenarios/${SID_A}/view`))).toBe(true)
    // Stopped: core's sentence verbatim, Try again, no Stop and no running seconds.
    expect(c.querySelector('[data-testid="view-drafting-board"]')?.getAttribute('data-draft')).toBe('stopped')
    expect(c.querySelector('[data-view="draft.words"]')?.textContent).toBe(STOPPED)
    expect(c.querySelector('[data-testid="view-drafting-again"]')).not.toBeNull()
    expect(c.querySelector('[data-testid="view-drafting-stop"]')).toBeNull()
    expect(c.querySelector('[data-testid="view-drafting-seconds"]')).toBeNull()
    // Contrast: another member's View of the same running draft carries stop: null, so no Stop is drawn (and none on a core before v1.34).
    cleanup()
    on(SID_A, UUID_A, { ...drafting(SID_A, 'building'), draft: { ...drafting(SID_A, 'building').draft!, stop: null } } as unknown as View)
    const other = render(<DraftingBoard />).container
    expect(other.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model')
    expect(other.querySelector('[data-testid="view-drafting-stop"]')).toBeNull()
  })

  it('U1d Try again on a stopped draft sends a new attempt on the saved brief (POST …/draft with a new op)', async () => {
    on(SID_A, UUID_A, { ...drafting(SID_A, 'building'), draft: { status: 'stopped', reason: null, at: STARTED, job: 7, stage: 'building', words: STOPPED.replace(/^You/, 'Paul').replace('Your brief', 'The brief'), started: STARTED, by: 'Paul', by_id: '8', stop: null } } as unknown as View)
    served.set(SID_A, drafting(SID_A, 'reading'))
    post = () => new Response(JSON.stringify({ scenario: SID_A, job: { id: 9, status: 'running' }, proposal: null, status_url: `/api/scenarios/${SID_A}/jobs/9` }), { status: 202 })
    const c = render(<DraftingBoard />).container
    expect(c.querySelector('[data-view="draft.words"]')?.textContent).toBe('Paul stopped this draft, so Olumi will not finish it. The brief is kept: Try again drafts it afresh.')
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-drafting-again"]')!) })
    await tick(0)
    expect(posts).toEqual([{ url: `/api/scenarios/${SID_A}/draft`, body: { op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
  })
})

describe('the one poller while a draft runs', () => {
  it('U2 reads about every 1.5 s while the scenario on screen drafts, shows each stage, then goes back to the normal refresh once the model is in', async () => {
    on(SID_A, UUID_A, drafting(SID_A, 'reading'))
    served.set(SID_A, drafting(SID_A, 'building'))
    const board = render(<DraftingBoard />).container
    renderHook(() => useViewPoll(true))
    const viewReads = () => reads.filter((r) => r.includes('/view?')) // (a model that lands also reads its version history once: noteMoved)
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(1)
    expect(board.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model')
    served.set(SID_A, drafting(SID_A, 'analysing'))
    await tick(DRAFT_POLL_MS + 10)
    expect(board.querySelector('[data-view="draft.words"]')?.textContent).toBe('Running the analysis and guidance')
    served.set(SID_A, done(SID_A))
    await tick(DRAFT_POLL_MS + 10)
    expect(viewReads()).toHaveLength(3)
    expect(board.querySelector('[data-testid="view-drafting-board"]')).toBeNull() // the model takes the board
    await tick(POLL_MS - DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(3) // back to the normal refresh: nothing more until POLL_MS
    await tick(DRAFT_POLL_MS * 2)
    expect(viewReads()).toHaveLength(4)
    expect(posts).toEqual([]) // reading never writes, and never sends the brief again
  })

  it('U2b a draft that starts while a slow re-read is timed is read sooner', async () => {
    on(SID_B, UUID_B, golden('pricing'))
    served.set(SID_A, drafting(SID_A, 'building'))
    renderHook(() => useViewPoll(true))
    await tick(10)
    await act(async () => { on(SID_A, UUID_A, drafting(SID_A, 'reading')) }) // the page moved to the scenario its brief made
    await tick(DRAFT_POLL_MS + 10)
    expect(reads).toEqual([expect.stringContaining(`/api/scenarios/${SID_A}/view`)])
  })

  it('U3 a read that fails keeps the drafting View: the draft is never marked failed, and nothing is posted', async () => {
    on(SID_A, UUID_A, drafting(SID_A, 'building'))
    served.set(SID_A, 'fail')
    const board = render(<DraftingBoard />).container
    renderHook(() => useViewPoll(true))
    await tick(DRAFT_POLL_MS + 10)
    expect(reads).toHaveLength(1)
    expect(useViewStore.getState().view?.draft?.status).toBe('drafting')
    expect(board.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model')
    expect(board.querySelector('[data-testid="view-drafting-again"]')).toBeNull()
    await tick(DRAFT_POLL_MS + 10) // and it keeps reading at the drafting pace
    expect(reads).toHaveLength(2)
    expect(posts).toEqual([])
  })

  it('U4 navigation: a late answer for scenario A never replaces scenario B, and B (not drafting) is read at the normal pace', async () => {
    on(SID_A, UUID_A, drafting(SID_A, 'building'))
    served.set(SID_A, drafting(SID_A, 'analysing')); served.set(SID_B, { ...golden('pricing'), you_id: '7' } as unknown as View)
    renderHook(() => useViewPoll(true))
    let release!: () => void
    hold = new Promise((r) => { release = r })
    await tick(DRAFT_POLL_MS + 10) // A's read is out
    expect(reads).toHaveLength(1)
    hold = null
    await act(async () => { await useViewStore.getState().use(UUID_B) }) // the person opens B meanwhile
    release()
    await tick(10)
    expect(useViewStore.getState().sid).toBe(SID_B)
    expect(useViewStore.getState().view?.draft ?? null).toBeNull() // A's late drafting answer was dropped
    expect(isDrafting(useViewStore.getState().view)).toBe(false)
    const before = reads.length
    await tick(DRAFT_POLL_MS * 3)
    expect(reads.length).toBe(before) // not drafting: no fast reads for B
    expect(posts).toEqual([])
  })
})

describe('Codex r1 fixes', () => {
  it('U7 signed out while a drafting read is out: its late answer never puts the View back (no person\'s View survives a sign-out)', async () => {
    on(SID_A, UUID_A, drafting(SID_A, 'building'))
    served.set(SID_A, drafting(SID_A, 'analysing'))
    renderHook(() => useViewPoll(true))
    let release!: () => void
    hold = new Promise((r) => { release = r })
    await tick(DRAFT_POLL_MS + 10)
    expect(reads).toHaveLength(1)
    await act(async () => { useViewStore.setState(useViewStore.getInitialState(), true) }) // signout.ts resets the store
    release()
    await tick(10)
    expect(useViewStore.getState()).toMatchObject({ sid: null, view: null })
  })

  it('U8 the first read after acceptance fails: the scenario is read again at the drafting pace until its View arrives, and Send stays held meanwhile', async () => {
    useViewStore.setState({ uuid: UUID_A, sid: SID_A, view: null, error: 'Olumi could not be reached.', status: 'error', stale: false, at: null })
    served.set(SID_A, 'fail')
    const c = render(<><DraftingBoard /><ViewComposer /></>).container
    expect((c.querySelector('[data-testid="view-composer-send"]') as HTMLButtonElement).disabled).toBe(true)
    renderHook(() => useViewPoll(true))
    await tick(DRAFT_POLL_MS + 10)
    expect(reads).toHaveLength(1)
    served.set(SID_A, drafting(SID_A, 'building'))
    await tick(DRAFT_POLL_MS + 10)
    expect(reads).toHaveLength(2)
    expect(c.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model')
    expect((c.querySelector('[data-testid="view-composer-send"]') as HTMLButtonElement).disabled).toBe(true) // drafting: still held
    expect(posts).toEqual([])
  })
})

describe('reload and a lost acceptance answer', () => {
  it('U5 a reload mid-draft resumes the same job from the View: core\'s words for job 7, then its model; no brief is sent', async () => {
    served.set(SID_A, drafting(SID_A, 'analysing'))
    useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null }) // a fresh page
    const board = render(<DraftingBoard />).container
    renderHook(() => useViewPoll(true))
    await act(async () => { await useViewStore.getState().use(UUID_A) })
    expect(useViewStore.getState().view?.draft).toMatchObject({ job: 7, status: 'drafting', words: 'Running the analysis and guidance' })
    expect(board.querySelector('[data-view="draft.words"]')?.textContent).toBe('Running the analysis and guidance')
    served.set(SID_A, done(SID_A))
    await tick(DRAFT_POLL_MS + 10)
    expect(board.querySelector('[data-testid="view-drafting-board"]')).toBeNull()
    expect(useViewStore.getState().view?.proposal).not.toBeNull()
    expect(posts).toEqual([])
  })

  it('U6 an acceptance answer lost on the way: after a reload the brief is back in the box with the SAME op, nothing is sent until Send, and Send asks core by that op', async () => {
    const page = '1b4e28ba-2fa1-41d2-883f-0016d3cca427', brief = 'Should we raise the price of our pastries?'
    useCanvasStore.setState({ currentScenarioId: page } as never)
    useViewStore.setState({ uuid: page, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
    post = () => { throw new TypeError('the connection dropped') } // the 202 never reached the page
    const first = render(<ViewComposer />).container
    fireEvent.change(first.querySelector('#view-chat-text')!, { target: { value: brief } })
    await act(async () => { fireEvent.click(first.querySelector('[data-testid="view-composer-send"]')!) })
    await tick(0)
    expect(posts).toHaveLength(1)
    const op = (posts[0]!.body as { op: string }).op
    expect(pendingBrief('7')).toEqual({ brief, op })
    expect(pendingBrief('8')).toBeNull() // kept for this person only
    // The reload: this page's memory is gone; the tab's sessionStorage is not.
    cleanup()
    useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
    const again = render(<ViewComposer />).container
    await tick(0)
    expect((again.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe(brief)
    expect(posts).toHaveLength(1) // reloading sent nothing
    post = () => new Response(JSON.stringify({ scenario: SID_A, job: { id: 7, kind: 'draft', status: 'running' }, proposal: null, status_url: `/api/scenarios/${SID_A}/jobs/7` }), { status: 202 })
    served.set(SID_A, drafting(SID_A, 'building'))
    await act(async () => { fireEvent.click(again.querySelector('[data-testid="view-composer-send"]')!) })
    await tick(0)
    expect(posts.map((p) => [p.url, (p.body as { op: string }).op])).toEqual([['/api/scenarios', op], ['/api/scenarios', op]])
    expect(pendingBrief('7')).toBeNull() // core named the scenario: nothing is pending
    expect(useViewStore.getState().sid).toBe(SID_A)
  })
})
