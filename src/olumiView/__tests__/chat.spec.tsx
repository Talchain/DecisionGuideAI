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
import { ViewChat, ViewComposer, ViewTurns, useViewChat, SAVED_NOT_SHOWN, BRIEF_INTRO, BRIEF_EXAMPLE, DRAFTING_TITLE, DRAFTING_WORDS, THINKING_WORDS } from '../ViewChat'
import { DraftingBoard } from '../DraftingBoard'

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const at = (v: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]), v)

describe.each(['s_ce285b3617bb', 'proposal'])('the conversation is drawn exactly as the View holds it (%s)', (name) => {
  const view = golden(name)
  it('every drawn string is the View\'s own at its path, and every word of every turn is drawn', () => {
    const { container } = render(<ViewTurns chat={view.chat} />)
    for (const el of container.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(view, el.dataset['view']!))
    // Not words: hovers, the records a turn is about or cites, the one card it is beside (`at`) and the coach's move id (`move`, olumi.view/3).
    const strings = (x: unknown, p: string): string[] => typeof x === 'string' ? (x === '' ? [] : [p])
      : Array.isArray(x) ? x.flatMap((y, i) => strings(y, `${p}.${i}`))
      // `next.at` is the card id the step points at, `next.move` the coach's move id (olumi.view/3 e16a497): core's ids, never words.
      : x !== null && typeof x === 'object' ? Object.entries(x).flatMap(([k, y]) => (k === 'title' || k === 'about' || k === 'cite' || k === 'at' || k === 'move' ? [] : strings(y, `${p}.${k}`))) : []
    view.chat.forEach((t, i) => {
      for (const k of ['by', 'version', 'status', 'said', 'answer', 'broke', 'problem', 'marks'] as const) for (const p of strings(t[k], `chat.${i}.${k}`)) {
        expect(container.querySelector(`[data-view="${p}"]`), p).not.toBeNull()
      }
    })
    expect(view.chat.length).toBeGreaterThan(1)
  })

  it('two turns swapped draw differently in each place (identity, not a value found somewhere)', () => {
    const swapped = [...view.chat].reverse()
    const first = (chat: View['chat']) => render(<ViewTurns chat={chat} />).container.querySelector('[data-view-turn="chat.0"]')!.textContent
    expect(first(swapped)).not.toBe(first(view.chat))
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
  afterEach(() => { setTeamFetch(null); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null }) })

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
    for (const k of ['heading', 'on'] as const) expect(card.querySelector(`[data-view="proposal.${k}"]`)?.textContent).toBe(p[k])
    await act(async () => { fireEvent.click([...card.querySelectorAll('button')].find((b) => b.textContent === 'Approve')!) })
    await waitFor(() => expect(posts[0]).toEqual({ url: `/api/proposals/${p.id}/approve`, body: { base: p.base } }))
    useViewStore.setState({ view: held })
    const { container: again } = renderTab()
    await act(async () => { fireEvent.click([...again.querySelectorAll('button')].find((b) => b.textContent === 'Set aside')!) })
    await waitFor(() => expect(posts[1]).toEqual({ url: `/api/proposals/${p.id}/discard`, body: {} }))
  })

  it('a proposal made on considering evidence names who asked and the evidence in its member\'s words, never as its author (API v1.12)', () => {
    const held = golden('proposal')
    const ev = { id: 5, at: '2026-11-04T09:00:00Z', by: 'Bea', by_id: 'p_2', text: 'Churn in DACH was 2 in 100.', source: null, link: null, concerns: [], stance: 'challenges', version: 1, considered: { at: '2026-11-04T09:05:00Z', by: 'Ada', proposal: held.proposal!.id, why: null } }
    useViewStore.setState({ view: { ...held, evidence: [ev], proposal: { ...held.proposal!, from: { evidence: 5, asked_by: 'Ada' } } } })
    const { container } = renderTab()
    const from = container.querySelector('[data-testid="view-chat-proposal-from"]')!
    expect(from.querySelector('[data-view="proposal.from.asked_by"]')?.textContent).toBe('Ada')
    expect(from.querySelector('[data-testid="view-chat-proposal-from-evidence"]')?.textContent).toBe(ev.text)
    expect(from.textContent).toBe(`Asked by: AdaFrom evidence: “${ev.text}”`)
    expect(from.textContent).not.toContain('Bea')
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
    await act(async () => { fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Approve')!) })
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
      answer(() => new Response(JSON.stringify({ scenario: MADE, proposal: 1 }), { status: 201 }))
      const { container } = renderTab()
      type(container, 'Should we raise the price of our pastries?')
      await send(container)
      await waitFor(() => expect(reads).toContain(`/api/scenarios/${MADE}/view?schema=3`))
      expect(posts).toEqual([{ url: '/api/scenarios', body: { brief: 'Should we raise the price of our pastries?', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
      expect(useCanvasStore.getState().currentScenarioId).toBe('00000000-0000-4000-8000-0000000000ab')
      expect(window.location.hash).toBe('#/scenario/00000000-0000-4000-8000-0000000000ab')
      expect(localStorage.getItem(`olumi-core-sc:${uuid}`)).toBeNull()
    })

    it('while a brief drafts, the board says so once, a first model can take a few minutes, with the seconds; the composer holds the sent brief without its instructions; a message says Olumi is thinking in the composer (PL 4 Nov; plan v3 drafting state, 7 Nov)', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      try {
        useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
        useViewChat.setState({ busy: true })
        const c = render(<><DraftingBoard /><ViewComposer /></>).container
        const board = c.querySelector('[data-testid="view-drafting-board"] [role="status"]')!
        expect(board.textContent).toBe(`${DRAFTING_TITLE}${DRAFTING_WORDS}0 s`)
        await act(async () => { vi.advanceTimersByTime(3000) })
        expect(c.querySelector('[data-testid="view-drafting-seconds"]')?.textContent).toBe('3 s')
        expect(c.querySelector('[data-testid="view-chat-working"]')).toBeNull() // said once, on the board
        expect(c.querySelector('[data-testid="view-brief-intro"]')).toBeNull()
        expect(c.querySelector('#view-chat-text')?.hasAttribute('aria-describedby')).toBe(false)
        c.remove()
        useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view: golden('pricing'), error: null, status: 'ready' })
        const m = render(<><DraftingBoard /><ViewComposer /></>).container
        expect(m.querySelector('[data-testid="view-chat-working"]')?.textContent).toBe(`${THINKING_WORDS} 0 s`)
        expect(m.querySelector('[data-testid="view-drafting-board"]')).toBeNull()
      } finally { vi.useRealTimers(); useViewChat.setState({ busy: false }) }
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
      expect(later.querySelector('#view-chat-text')?.getAttribute('placeholder')).toBe('Ask about the latest analysis…')
    })

    it('a canvas with no scenario yet moves to core\'s id\'s own UUID', async () => {
      useCanvasStore.setState({ currentScenarioId: null } as never)
      useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
      answer(() => new Response(JSON.stringify({ scenario: MADE, proposal: 1 }), { status: 201 }))
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
