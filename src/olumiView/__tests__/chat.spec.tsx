/**
 * The Olumi tab on the core lane (View API design §2, §3): the conversation drawn exactly as the View holds it, bound by identity, and
 * the writes going straight to core's v1 routes with what core takes, then the View read again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch, UNCERTAIN_WRITE } from '../../olumiCore/team/api'
import type { View } from '../client'
import { currentModel, useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { ViewChat, ViewComposer, ViewTurns, useViewChat, SAVED_NOT_SHOWN, BRIEF_INTRO, BRIEF_EXAMPLE, THINKING_WORDS } from '../ViewChat'
import { DraftingBoard } from '../DraftingBoard'
import { withheldWords, leadLineOf } from '../previous/CoreCard'
import { isOpen, setOpen } from './reviewRow'

/** What the one Tip says for an icon control: nothing at the instant the pointer arrives, then its words once the 150 ms delay has run. */
const hoverWords = async (el: HTMLElement): Promise<string | null> => {
  fireEvent.pointerEnter(el)
  expect(document.querySelector('[role="tooltip"]'), 'not at the instant of arrival').toBeNull()
  const tip = await waitFor(() => { const t = document.querySelector('[role="tooltip"]'); if (t === null) throw new Error('no tip yet'); return t })
  const words = tip.textContent
  fireEvent.pointerLeave(el)
  return words
}

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
/** Core's answer to an accepted brief (API v1.26): the job, running at its first stage. */
const accepted = (sid: string) => ({ scenario: sid, proposal: null, status_url: `/api/scenarios/${sid}/jobs/2`,
  job: { id: 2, kind: 'draft', scenario: sid, status: 'running', stage: 'reading', words: 'Reading the brief', reason: null, proposal: null, started: '2026-11-08T15:00:00.000Z', at: '2026-11-08T15:00:00.000Z' } })
const at = (v: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]), v)

describe.each(['s_ce285b3617bb', 'proposal'])('the conversation is drawn exactly as the View holds it (%s)', (name) => {
  const view = golden(name)
  it('every drawn string is the View\'s own at its path, and every word of every turn is drawn', async () => {
    const { container } = render(<ViewTurns chat={view.chat} />)
    // P4: the Why lines live in each reply's one facts disclosure, closed at rest; open every one so all of core's words can be read back.
    for (const b of container.querySelectorAll<HTMLElement>('[data-testid="view-reply-rests"]')) if (b.getAttribute('aria-expanded') !== 'true') fireEvent.click(b)
    for (const el of container.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(view, el.dataset['view']!))
    // Not words: hovers, the records a turn is about or cites, the one card it is beside (`at`) and the coach's move id (`move`, olumi.view/3).
    const strings = (x: unknown, p: string): string[] => typeof x === 'string' ? (x === '' ? [] : [p])
      : Array.isArray(x) ? x.flatMap((y, i) => strings(y, `${p}.${i}`))
      // `next.at` is the card id the step points at, `next.move` the coach's move id (olumi.view/3 e16a497): core's ids, never words.
      : x !== null && typeof x === 'object' ? Object.entries(x).flatMap(([k, y]) => (k === 'title' || k === 'about' || k === 'cite' || k === 'at' || k === 'move' ? [] : strings(y, `${p}.${k}`))) : []
    view.chat.forEach((t, i) => {
      for (const k of ['by', 'said', 'answer', 'broke', 'problem', 'marks'] as const) for (const p of strings(t[k], `chat.${i}.${k}`)) {
        expect(container.querySelector(`[data-view="${p}"]`), p).not.toBeNull()
      }
    })
    // P4 (system spec): core's version and status words are not drawn beside the reply's version icon; they are its name and its one Tip, verbatim (nothing dropped).
    const turns = [...container.querySelectorAll<HTMLElement>('[data-view-turn]')]
    expect(turns.length).toBe(view.chat.length)
    for (const [i, t] of view.chat.entries()) {
      const icon = turns[i]!.querySelector<HTMLElement>('[data-testid="view-chat-version"] [role="img"]')
      expect(icon, `chat.${i} version icon`).not.toBeNull()
      const words = t.status === null ? t.version : `${t.version} · ${t.status}`
      expect(icon!.getAttribute('aria-label'), `chat.${i}`).toBe(words)
    }
    expect(await hoverWords(turns[0]!.querySelector<HTMLElement>('[data-testid="view-chat-version"] [role="img"]')!)).toBe(view.chat[0]!.status === null ? view.chat[0]!.version : `${view.chat[0]!.version} · ${view.chat[0]!.status}`)
    expect(view.chat.length).toBeGreaterThan(1)
  })

  it('two turns swapped draw differently in each place (identity, not a value found somewhere)', () => {
    const swapped = [...view.chat].reverse()
    const first = (chat: View['chat']) => render(<ViewTurns chat={chat} />).container.querySelector('[data-view-turn="chat.0"]')!.textContent
    expect(first(swapped)).not.toBe(first(view.chat))
  })
})

// CATCH (contract 3). Fails before: withheldWords did not exist and leadLineOf returned headline.text ("No chance yet") for a withheld option.
describe('a withheld chance says core\'s reason, picked by field (why, else title, else text)', () => {
  type H = NonNullable<import('../client').ViewCard['headline']>
  const none = (o: Partial<H>) => ({ state: 'none', text: 'T-text', title: '', why: null, add: null, ...o }) as unknown as H
  it('why first, then title, then text; null for any other state', () => {
    expect(withheldWords(none({ why: 'W-why', title: 'T-title' }))).toBe('W-why')
    expect(withheldWords(none({ why: '', title: 'T-title' }))).toBe('T-title')
    expect(withheldWords(none({ why: null, title: '' }))).toBe('T-text')
    // CONTRAST: a chance is never withheld words
    expect(withheldWords({ ...none({ why: 'W-why' }), state: 'chance' } as unknown as H)).toBeNull()
  })
  it('an option card\'s lead line is that reason, not the bare "No chance yet" text', () => {
    const card = (h: H) => ({ family: 'option', headline: h, rows: [] }) as unknown as Parameters<typeof leadLineOf>[0]
    expect(leadLineOf(card(none({ why: 'W-why' })))).toBe('W-why')
    expect(leadLineOf(card(none({ title: 'T-title' })))).toBe('T-title')
    expect(leadLineOf(card(none({})))).toBe('T-text')
  })
})

describe('the writes go straight to core, and the View is read again', () => {
  const view = golden('pricing')
  let posts: { url: string; body: unknown }[] = [], reads: string[] = []
  const answer = (respond: (url: string, body: unknown) => Response | Promise<Response>) => setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { const body = JSON.parse(String(init.body)); posts.push({ url, body }); return respond(url, body) }
    reads.push(url); return new Response(JSON.stringify(view), { status: 200 })
  }) as unknown as typeof fetch)
  beforeEach(() => { posts = []; reads = []; useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view, error: null, status: 'ready' }) })
  // The address is reset too: the first-answer rows move it (`/#/scenario/<uuid>`), and a write for another scenario is refused under it (Codex 006 #1).
  afterEach(() => { window.history.replaceState(null, '', '/'); setTeamFetch(null); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null }) })

  // The tab draws the conversation; the dock's footer holds the composer (review 00052 #3). Both read one store.
  const renderTab = () => render(<><ViewChat /><ViewComposer /></>)
  const type = (c: HTMLElement, text: string) => fireEvent.change(c.querySelector('#view-chat-text')!, { target: { value: text } })
  const send = (c: HTMLElement) => act(async () => { fireEvent.click([...c.querySelectorAll('button')].find((b) => b.textContent === 'Send')!) })

  it('a message is posted to the scenario\'s messages with an op id, the View is read again, and the box is cleared', async () => {
    answer(() => new Response(JSON.stringify({ proposal: 9 }), { status: 201 }))
    const { container } = renderTab()
    type(container, 'Raise it by 30p instead')
    await send(container)
    await waitFor(() => expect(reads).toContain('/api/scenarios/s_000000000001/view?schema=3'))
    expect(posts).toEqual([{ url: '/api/scenarios/s_000000000001/messages', body: { text: 'Raise it by 30p instead', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('')
  })

  it('a refused message keeps what was typed and says core\'s own words', async () => {
    answer(() => new Response(JSON.stringify({ error: 'text is too long (at most 4,000 characters)' }), { status: 413 }))
    const { container } = renderTab()
    type(container, 'A long message')
    await send(container)
    await waitFor(() => expect(container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe('text is too long (at most 4,000 characters)'))
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('A long message')
  })

  it('a message whose answer never came may have been saved: it says so, and sending it again uses the same op id', async () => {
    let n = 0
    answer(() => { n++; if (n === 1) throw new TypeError('network'); return new Response(JSON.stringify({ proposal: 9 }), { status: 201 }) })
    const { container } = renderTab()
    type(container, 'Raise it by 30p instead')
    await send(container)
    await waitFor(() => expect(container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe(UNCERTAIN_WRITE))
    await send(container)
    await waitFor(() => expect(posts).toHaveLength(2))
    expect((posts[1]!.body as { op: string }).op).toBe((posts[0]!.body as { op: string }).op)
  })

  it('the change card draws core\'s proposal by identity, approves on its base and sets aside, each straight to core', async () => {
    const held = golden('proposal'), p = held.proposal!
    useViewStore.setState({ view: held })
    answer(() => new Response(JSON.stringify({}), { status: 200 }))
    const { container } = renderTab()
    const card = container.querySelector<HTMLElement>('[data-testid="view-chat-proposal"]')!
    for (const el of card.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(held, el.dataset['view']!))
    // Contract 3: core's heading and `on` are the one row's own line (its row, a button), drawn once. CHANGED BY DESIGN (17 Nov, the calm panel): that row is now
    // the first item of the card's actions line at the thread's foot, so it is inside the card, still exactly once; reverting moves it back above the body and fails this row.
    const review = container.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!
    const row = review.querySelector<HTMLElement>('[data-testid="view-proposal-row"]')!
    for (const k of ['heading', 'on'] as const) expect(row.querySelector(`[data-view="proposal.${k}"]`)?.textContent).toBe(p[k])
    expect(card.querySelectorAll('[data-view="proposal.heading"]')).toHaveLength(1)
    expect(card.querySelector('[data-testid="view-proposal-actions"]')!.contains(row)).toBe(true)
    expect(card.querySelectorAll('[data-view="proposal.on"]')).toHaveLength(1)
    // Opened, the review shows the same actions; Approve and Set aside post exactly as before.
    setOpen(review, true)
    await act(async () => { fireEvent.click([...card.querySelectorAll('button')].find((b) => b.dataset['testid'] === 'view-approve')!) })
    await waitFor(() => expect(posts[0]).toEqual({ url: `/api/proposals/${p.id}/approve`, body: { base: p.base } }))
    useViewStore.setState({ view: held })
    const { container: again } = renderTab()
    await act(async () => { fireEvent.click(again.querySelector('[data-testid="view-set-aside"]')!) })
    await waitFor(() => expect(posts[1]).toEqual({ url: `/api/proposals/${p.id}/discard`, body: {} }))
  })

  // CATCH (contract 3). Fails on the product before this change: ViewChat's NextStepCard drew <Proposal> open inside a "Next step" box, with
  // no <details data-testid="view-proposal-review">, so the query below was null and the "Next step" header was present.
  it('at rest the pending review is ONE closed row in core\'s words (heading · on), with no header; opening it shows the words and the actions', async () => {
    const held = golden('proposal'), p = held.proposal!
    useViewStore.setState({ view: held })
    const { container } = renderTab()
    const step = container.querySelector<HTMLElement>('[data-testid="view-next-step"][data-step="approve"]')!
    expect(step.getAttribute('aria-label')).toBe('Next step')
    const review = step.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!
    expect(isOpen(review)).toBe(false)
    expect(review.closest('[data-testid="view-chat-pinned"]')).not.toBeNull()
    const row = review.querySelector<HTMLElement>('button[data-testid="view-proposal-row"]')!
    expect(row.textContent).toBe(p.on === '' ? p.heading : `${p.heading} · ${p.on}`)
    // the heading line is drawn once, in the row, never again in the body
    expect(step.querySelectorAll('[data-view="proposal.heading"]')).toHaveLength(1)
    // CONTRAST: the old "Next step" header line is gone for this kind
    expect([...step.querySelectorAll('p')].some((el) => el.textContent === 'Next step')).toBe(false)
    setOpen(review, true)
    expect(review.querySelector('[data-testid="view-chat-proposal"]')).not.toBeNull()
    // CHANGED BY DESIGN (18 Nov, Paul: smallest possible buttons): Approve is a tick icon button, not words: its name and hover say Approve and what it approves;
    // Review, Approve and Set aside share one 28px height class (and the row's own button), so they sit on one centre line. The post is unchanged (row above).
    const approve = review.querySelector<HTMLElement>('[data-testid="view-approve"]')!
    expect([approve.getAttribute('aria-label'), approve.getAttribute('title'), approve.textContent]).toEqual(['Approve these changes', null, ''])
    expect(await hoverWords(approve), 'its hover is the one Tip, after 150 ms').toBe('Approve these changes')
    expect(approve.querySelector('svg.lucide-check'), 'a tick from the registry').not.toBeNull()
    const row28 = ['view-proposal-row', 'view-proposal-review-toggle', 'view-approve', 'view-set-aside'].map((t) => review.querySelector<HTMLElement>(`[data-testid="${t}"]`)!.className.split(/\s+/).filter((c) => /^(min-)?h-/.test(c)))
    expect(row28).toEqual([['min-h-7'], ['min-h-7'], ['min-h-7'], ['min-h-7']])
    // CHANGED BY DESIGN (19 Nov, Paul: "Olumi proposes 13 chan…" was cut): the summary wraps, never cut with an ellipsis.
    const words = review.querySelector<HTMLElement>('[data-testid="view-proposal-row"] [data-testid="view-proposal-words"]')!
    expect([review.querySelector('[data-testid="view-proposal-row"] .truncate'), words.className.split(/\s+/).includes('break-words')], 'the summary wraps and is never cut').toEqual([null, true])
    expect(row.hasAttribute('title'), 'no native title').toBe(false)
    expect(await hoverWords(row), 'the whole sentence on hover, through the one Tip').toBe(row.textContent)
    expect(review.querySelector('[data-testid="view-set-aside"]')!.getAttribute('aria-label')).toBe('Set aside')
  })

  // 18 Nov, Paul's pictures of the compact controls: Approve was a CIRCLE (rounded-md is 12px here, so a 28px square drew round), the bar took two lines,
  // and Set aside's archive-with-cross was ambiguous. Bound to the lane's real card (identity: the testids), at rest (closed) and open.
  it('the proposal bar is ONE 28px row: heading, Review, Approve and Set aside are siblings that do not wrap; Approve is a 6px-radius square; Set aside is the registry\'s archive box', async () => {
    const held = golden('proposal')
    useViewStore.setState({ view: held })
    const { container } = renderTab()
    const review = container.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!
    const bar = review.querySelector<HTMLElement>('[data-testid="view-proposal-actions"]')!
    expect(bar.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'flex-nowrap']))
    expect(bar.className.split(/\s+/)).not.toContain('flex-wrap')
    const kids = [...bar.children].map((c) => (c as HTMLElement).dataset['testid'])
    expect(kids.filter((t) => t !== undefined && t !== '')).toEqual(['view-proposal-row', 'view-proposal-review-toggle', 'view-approve', 'view-set-aside'])
    expect(bar.querySelector('[data-testid="view-change-mix"]'), 'the change mix is not in the one-row bar').toBeNull()
    const approve = bar.querySelector<HTMLElement>('[data-testid="view-approve"]')!
    expect(approve.className.split(/\s+/)).toContain('rounded-control')
    expect(approve.className).not.toMatch(/rounded-(md|full|pill|lg)/)
    const aside = bar.querySelector<HTMLElement>('[data-testid="view-set-aside"]')!
    expect([aside.getAttribute('aria-label'), aside.getAttribute('title')]).toEqual(['Set aside', null])
    expect(await hoverWords(aside), 'its hover is the one Tip, after 150 ms').toBe('Set aside')
    expect(aside.querySelector('svg.lucide-ban'), "the registry's set-aside (a plain not-applied ban): the cross means Close, and the tray (archive) looked like the composer's floating-window icon").not.toBeNull()
    expect(aside.querySelector('svg.lucide-x')).toBeNull()
    expect(aside.querySelector('svg.lucide-archive')).toBeNull()
    expect(aside.querySelector('svg.lucide-archive-x')).toBeNull()
  })

  // CATCH (contract 3). Fails before: land() had no closed-details early return, so a closed review's box was given a maxHeight from the rows.
  it('the readings rest places nothing while the review is closed: the box keeps its own height', () => {
    const held = golden('proposal')
    useViewStore.setState({ view: held })
    const { container } = renderTab()
    const box = container.querySelector<HTMLElement>('[data-testid="view-chat-pinned"]')!
    expect(isOpen(box.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!)).toBe(false)
    expect(box.style.maxHeight).toBe('')
    // CONTRAST: the box no longer carries the 112px floor that held the old open proposal
    expect(box.className).not.toContain('min-h-[112px]')
  })

  it('a proposal made on considering evidence names who asked and the evidence in its member\'s words, never as its author (API v1.12)', () => {
    const held = golden('proposal')
    const ev = { id: 5, at: '2026-11-04T09:00:00Z', by: 'Bea', by_id: 'p_2', text: 'Churn in DACH was 2 in 100.', source: null, link: null, concerns: [], stance: 'challenges', version: 1, considered: { at: '2026-11-04T09:05:00Z', by: 'Ada', proposal: held.proposal!.id, why: null },
      stance_text: 'Bea: Challenges it', switch_text: 'Bea’s evidence', mark_label: 'Bea · Churn in DACH was 2 in 100.', mark_title: 'Bea · Churn in DACH was 2 in 100.', bears_on_text: null }
    // Core v3 (80bcc0b): `asked_by` is the asker's member id; `by` is core's words for them. The card names them by `by`, never the id.
    useViewStore.setState({ view: { ...held, evidence: [ev], proposal: { ...held.proposal!, from: { evidence: 5, asked_by: 'p_3', by: 'Ada' } } } })
    const { container } = renderTab()
    const from = container.querySelector('[data-testid="view-chat-proposal-from"]')!
    expect(from.querySelector('[data-view="proposal.from.by"]')?.textContent).toBe('Ada')
    expect(from.querySelector('[data-testid="view-chat-proposal-from-evidence"]')?.textContent).toBe(ev.text)
    expect(from.textContent).toBe(`Asked by: AdaFrom evidence: “${ev.text}”`)
    expect(from.textContent).not.toContain('Bea')
    expect(container.textContent).not.toContain('p_3')
    // CONTRAST: a core that sends no words for the asker names no one, and still never the id
    cleanup()
    useViewStore.setState({ view: { ...held, evidence: [ev], proposal: { ...held.proposal!, from: { evidence: 5, asked_by: 'p_3' } as NonNullable<View['proposal']>['from'] } } })
    const older = renderTab().container
    expect(older.querySelector('[data-testid="view-chat-proposal-from"]')!.textContent).toBe(`From evidence: “${ev.text}”`)
    expect(older.textContent).not.toContain('p_3')
    // CONTRAST: a proposal not made from evidence says nothing of it
    cleanup()
    useViewStore.setState({ view: { ...held, evidence: [ev], proposal: { ...held.proposal!, from: null } } })
    expect(renderTab().container.querySelector('[data-testid="view-chat-proposal-from"]')).toBeNull()
  })

  it('after an approval no chance from before it is current until the new View lands', async () => {
    useViewStore.setState({ view: golden('proposal') })
    let answer!: (r: Response) => void
    setTeamFetch((async (url: string, init?: RequestInit) => {
      if (String(url) === '/api/me') return new Response(JSON.stringify({ me: null }), { status: 200 })
      if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response('{}', { status: 200 }) }
      if (url.includes('/view?schema=3')) return new Promise<Response>((done) => { answer = done })
      return new Response(JSON.stringify({ error: 'no team here' }), { status: 404 })
    }) as unknown as typeof fetch)
    const { container } = renderTab()
    await act(async () => { fireEvent.click([...container.querySelectorAll('button')].find((b) => b.dataset['testid'] === 'view-approve')!) })
    await waitFor(() => expect(posts[0]?.url).toBe(`/api/proposals/${golden('proposal').proposal!.id}/approve`))
    await waitFor(() => expect(useViewStore.getState().stale).toBe(true))
    expect(currentModel(useViewStore.getState())).toBeNull()
    await act(async () => { answer(new Response(JSON.stringify(view), { status: 200 })) })
    await waitFor(() => expect(currentModel(useViewStore.getState())).not.toBeNull())
  })

  describe('review 00052', () => {
    beforeEach(() => { try { localStorage.clear() } catch { /* none */ } })

    it('#4 what was typed, and its op id, outlive the dock closing: a resend after an uncertain write uses the same op', async () => {
      let n = 0
      answer(() => { n++; if (n === 1) throw new TypeError('network'); return new Response(JSON.stringify({ proposal: 9 }), { status: 201 }) })
      const first = renderTab()
      type(first.container, 'Raise it by 30p instead')
      await send(first.container)
      await waitFor(() => expect(first.container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe(UNCERTAIN_WRITE))
      first.unmount()
      const again = renderTab()
      expect((again.container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('Raise it by 30p instead')
      await send(again.container)
      await waitFor(() => expect(posts).toHaveLength(2))
      expect((posts[1]!.body as { op: string }).op).toBe((posts[0]!.body as { op: string }).op)
    })

    it('#5 a brief answered after the page moved to another scenario moves nothing: the page stays on the scenario it is on', async () => {
      const A = '1b4e28ba-2fa1-41d2-883f-0016d3cca427', B = '00000000-0000-4000-8000-0000000000bb'
      useCanvasStore.setState({ currentScenarioId: A } as never)
      useViewStore.setState({ uuid: A, sid: null, view: null, error: null, status: 'none' })
      let made!: (r: Response) => void
      answer(() => new Promise<Response>((done) => { made = done }))
      const { container } = renderTab()
      type(container, 'Should we raise the price of our pastries?')
      await send(container)
      useCanvasStore.setState({ currentScenarioId: B } as never)
      useViewStore.setState({ uuid: B, sid: 's_0000000000bb' })
      await act(async () => { made(new Response(JSON.stringify({ scenario: 's_0000000000aa', proposal: 1 }), { status: 201 })) })
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      expect(useCanvasStore.getState().currentScenarioId).toBe(B)
      expect(useViewStore.getState().sid).toBe('s_0000000000bb')
      expect(reads).not.toContain('/api/scenarios/s_0000000000aa/view?schema=3')
    })

    it('a brief answered after the page went to another scenario and came back (A → B → A) moves nothing (review 00002)', async () => {
      const A = '1b4e28ba-2fa1-41d2-883f-0016d3cca427', B = '00000000-0000-4000-8000-0000000000bb'
      useCanvasStore.setState({ currentScenarioId: A } as never)
      useViewStore.setState({ uuid: A, sid: null, view: null, error: null, status: 'none' })
      let made!: (r: Response) => void
      answer(() => new Promise<Response>((done) => { made = done }))
      const { container } = renderTab()
      type(container, 'Should we raise the price of our pastries?')
      await send(container)
      useCanvasStore.setState({ currentScenarioId: B } as never)
      useCanvasStore.setState({ currentScenarioId: A } as never)
      await act(async () => { made(new Response(JSON.stringify({ scenario: 's_0000000000aa', proposal: 1 }), { status: 201 })) })
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      expect(useCanvasStore.getState().currentScenarioId).toBe(A)
      expect(reads).not.toContain('/api/scenarios/s_0000000000aa/view?schema=3')
    })

    it('#6 a scenario whose first draft was set aside (no version, nothing held) starts again from the brief, at the new scenario\'s address', async () => {
      const uuid = '00000000-0000-4000-8000-0000000000aa'
      useCanvasStore.setState({ currentScenarioId: uuid } as never)
      useViewStore.setState({ uuid, sid: 's_0000000000aa', view: { ...view, version: null, proposal: null }, error: null, status: 'ready' })
      answer(() => new Response(JSON.stringify({ scenario: 's_0000000000cc', proposal: 1 }), { status: 201 }))
      const { container } = renderTab()
      type(container, 'Should we raise the price of our pastries by 20p?')
      await send(container)
      await waitFor(() => expect(posts[0]?.url).toBe('/api/scenarios'))
      expect(posts[0]!.body).toEqual({ brief: 'Should we raise the price of our pastries by 20p?', op: expect.any(String) })
      await waitFor(() => expect(reads).toContain('/api/scenarios/s_0000000000cc/view?schema=3'))
      expect(useCanvasStore.getState().currentScenarioId).toBe('00000000-0000-4000-8000-0000000000cc')
    })

    it('#7 a message saved whose View could not be read says so, rather than looking sent and shown', async () => {
      setTeamFetch((async (url: string, init?: RequestInit) => {
        if (String(url) === '/api/me') return new Response(JSON.stringify({ me: null }), { status: 200 })
        if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ proposal: 9 }), { status: 201 }) }
        return new Response(JSON.stringify({ error: 'the server is busy' }), { status: 503 })
      }) as unknown as typeof fetch)
      const { container } = renderTab()
      type(container, 'Raise it by 30p instead')
      await send(container)
      await waitFor(() => expect(container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe(SAVED_NOT_SHOWN))
      expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('')
    })
  })

  describe('a brief starts the scenario in core', () => {
    const MADE = 's_0000000000ab'
    beforeEach(() => { try { localStorage.clear() } catch { /* none */ } })

    it('posts the brief, moves the page to the new scenario\'s one address (any member\'s browser opens it there), and reads its View', async () => {
      const uuid = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
      useCanvasStore.setState({ currentScenarioId: uuid } as never)
      useViewStore.setState({ uuid, sid: null, view: null, error: null, status: 'none' })
      // AI jobs (core API v1.26): core accepts the brief at once and drafts it in the server: 202 with the job.
      answer(() => new Response(JSON.stringify(accepted(MADE)), { status: 202 }))
      const { container } = renderTab()
      type(container, 'Should we raise the price of our pastries?')
      await send(container)
      await waitFor(() => expect(reads).toContain(`/api/scenarios/${MADE}/view?schema=3`))
      expect(posts).toEqual([{ url: '/api/scenarios', body: { brief: 'Should we raise the price of our pastries?', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
      expect(useCanvasStore.getState().currentScenarioId).toBe('00000000-0000-4000-8000-0000000000ab')
      expect(window.location.hash).toBe('#/scenario/00000000-0000-4000-8000-0000000000ab')
      expect(localStorage.getItem(`olumi-core-sc:${uuid}`)).toBeNull()
    })

    it('while a brief drafts (core API v1.26), the board says so once in core\'s words with the seconds since core accepted it; the composer holds the sent brief without its instructions and stays usable (a Send is a message, not a second scenario); a message says Olumi is thinking in the composer (PL 4 Nov; Paul 7 Nov)', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      vi.setSystemTime(Date.parse('2026-11-08T15:00:05.000Z'))
      try {
        const drafting = { ...golden('pricing'), version: null, proposal: null, model: null, chat: [],
          draft: { status: 'drafting', reason: null, at: '2026-11-08T15:00:00.000Z', job: 2, stage: 'building', words: 'Building the model', started: '2026-11-08T15:00:00.000Z' } } as unknown as View
        useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000002', sid: 's_000000000002', view: drafting, error: null, status: 'ready' })
        useViewChat.setState({ text: 'Should we raise the price of our pastries?' })
        const c = render(<><DraftingBoard /><ViewComposer /></>).container
        const board = c.querySelector('[data-testid="view-drafting-board"] [role="status"]')!
        expect(board.getAttribute('aria-live')).toBe('polite')
        expect(c.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model') // core's words, verbatim
        // P1 (system spec): the brand loader stands above core's words (it replaced the pulsing dot); the seconds are counted from core's `started`, not from this page.
        expect(board.querySelector('[data-testid="view-drafting-loader"] [data-testid="thinking-indicator"]')).not.toBeNull()
        expect([c.querySelector('[data-testid="view-drafting-words"]')?.textContent, c.querySelector('[data-testid="view-drafting-seconds"]')?.textContent]).toEqual(['Building the model', '5 s'])
        await act(async () => { vi.advanceTimersByTime(3000) })
        expect(c.querySelector('[data-testid="view-drafting-seconds"]')?.textContent).toBe('8 s')
        expect(c.querySelector('[data-testid="view-chat-turn-wait"]')).toBeNull() // said once, on the board
        expect(c.querySelector('[data-testid="view-brief-intro"]')).toBeNull()
        expect(c.querySelector('#view-chat-text')?.hasAttribute('aria-describedby')).toBe(false)
        // 14 Nov (supersedes "takes no second Send"): the composer stays usable while the first model builds; a Send is a message to THIS scenario, never a second one (floorChat.spec).
        expect((c.querySelector('#view-chat-text') as HTMLTextAreaElement).disabled).toBe(false)
        expect((c.querySelector('[data-testid="view-composer-send"]') as HTMLButtonElement).disabled).toBe(false)
        c.remove()
        useViewChat.setState({ text: '', busy: true })
        useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view: golden('pricing'), error: null, status: 'ready' })
        const m = render(<><DraftingBoard /><ViewChat /><ViewComposer /></>).container
        // P1: a write in flight with no brief is said by the thread's one waiting line: the loader, the words and the seconds, side by side.
        expect(m.querySelector('[data-testid="view-chat-turn-wait"] [role="status"]')?.textContent).toBe(`${THINKING_WORDS} 0 s`) // the words and seconds; the wrap also holds the loader's own keyframes
        expect(m.querySelectorAll('[data-testid="thinking-indicator"]')).toHaveLength(1)
        expect(m.querySelector('[data-testid="view-composer"] [data-testid="thinking-indicator"]')).toBeNull() // not a second one in the composer
        expect(m.querySelector('[data-testid="view-drafting-board"]')).toBeNull()
      } finally { vi.useRealTimers(); useViewChat.setState({ busy: false, text: '' }) }
    })

    it('lane C: a first scenario says what to write and what happens, once; a scenario with a model says neither', () => {
      useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
      const first = render(<ViewComposer />).container
      expect(first.querySelector('[data-testid="view-brief-intro"]')?.textContent).toBe(BRIEF_INTRO)
      expect(first.querySelector('#view-chat-text')?.getAttribute('placeholder')).toBe(BRIEF_EXAMPLE)
      expect(first.querySelector('#view-chat-text')?.getAttribute('aria-describedby')).toBe('view-brief-intro')
      first.remove()
      useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view: golden('pricing'), error: null, status: 'ready' })
      const later = render(<ViewComposer />).container
      expect(later.querySelector('[data-testid="view-brief-intro"]')).toBeNull()
      // Never the brief's example: DGAI's own placeholder for a model with a run (the panel's original look, DL 4 Nov).
      expect(later.querySelector('#view-chat-text')?.getAttribute('placeholder')).toBe('Ask about your thinking…')
    })

    it('a canvas with no scenario yet moves to core\'s id\'s own UUID', async () => {
      useCanvasStore.setState({ currentScenarioId: null } as never)
      useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
      // AI jobs (core API v1.26): core accepts the brief at once and drafts it in the server: 202 with the job.
      answer(() => new Response(JSON.stringify(accepted(MADE)), { status: 202 }))
      const { container } = renderTab()
      type(container, 'Should we raise the price of our pastries?')
      await send(container)
      await waitFor(() => expect(useCanvasStore.getState().currentScenarioId).toBe('00000000-0000-4000-8000-0000000000ab'))
      await waitFor(() => expect(reads).toContain(`/api/scenarios/${MADE}/view?schema=3`))
    })

    it('a refused brief keeps what was typed and says core\'s own words', async () => {
      useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
      answer(() => new Response(JSON.stringify({ error: 'brief is too long (at most 12,000 characters)' }), { status: 413 }))
      const { container } = renderTab()
      type(container, 'A brief')
      await send(container)
      await waitFor(() => expect(container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe('brief is too long (at most 12,000 characters)'))
      expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('A brief')
    })
  })
})

describe('honest degradation (core chat[].degraded, turn policy 18 Nov; chat[].status is the existing stamp string)', () => {
  it('a turn core marks as degraded says so in one quiet line in its reply, verbatim, its short form on hover; CONTRAST: a turn without status draws none', async () => {
    const view = structuredClone(golden('s_ce285b3617bb'))
    const i = view.chat.findIndex((t) => t.answer !== null)
    expect(i, 'precondition: an answered turn').toBeGreaterThanOrEqual(0)
    const words = 'Olumi answered without the team views this time, so this reply does not weigh them.'
    ;(view.chat[i] as { degraded?: unknown }).degraded = { text: words, title: 'Team views not read' }
    const { container } = render(<ViewTurns chat={view.chat} />)
    const line = container.querySelectorAll<HTMLElement>('[data-testid="view-chat-turn-degraded"]')
    expect(line).toHaveLength(1)
    expect(line[0]!.textContent).toBe(words)
    expect(line[0]!.hasAttribute('title'), 'no native title').toBe(false)
    expect(await hoverWords(line[0]!), 'its short form is the one Tip').toBe('Team views not read')
    expect(line[0]!.dataset['view']).toBe(`chat.${i}.degraded.text`)
  })
})

describe('honest degradation on a model-less floor reply (core floor[].degraded)', () => {
  it('the floor reader keeps core\'s degraded note (Codex 12:24:49Z: floorOf dropped it)', async () => {
    const { floorOf } = await import('../early')
    const d = { text: 'Olumi answered this before it could finish its work, so it may be incomplete.', title: 'Answered on less than usual' }
    const rows = floorOf({ floor: [{ job: 3, at: '2026-11-18T12:00:00Z', said: 'Hi', text: 'A reply.', degraded: d }, { job: 4, at: '2026-11-18T12:01:00Z', said: 'Hi again', text: 'Another.' }] })
    expect(rows[0]!.degraded).toEqual(d)
    expect(rows[1]!.degraded).toBeUndefined()
  })
  it('a floor reply core marks degraded says so verbatim; CONTRAST the same reply without it says nothing', async () => {
    const { ViewConversation } = await import('../ViewChat')
    const floor = [{ job: 7, said: 'Should we hire?', by: '', by_id: '', text: 'Here is a first answer.', degraded: { text: 'Olumi answered this without the team’s shared context, so it may leave out something it would usually take into account.', title: 'Answered on less than usual' } }]
    const r = render(<ViewConversation chat={[]} floor={floor as never} draft={null} me={null} />)
    const l = r.container.querySelector<HTMLElement>('[data-testid="view-chat-turn-degraded"]')
    expect(l?.textContent).toBe(floor[0]!.degraded.text)
    expect(l!.hasAttribute('title'), 'no native title').toBe(false)
    expect(await hoverWords(l!)).toBe('Answered on less than usual')
    expect(l?.dataset['view']).toBe('floor.7.degraded.text')
    r.unmount()
    const r2 = render(<ViewConversation chat={[]} floor={[{ ...floor[0], degraded: undefined }] as never} draft={null} me={null} />)
    expect(r2.container.querySelector('[data-testid="view-chat-turn-degraded"]')).toBeNull()
  })
})
