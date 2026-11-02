/**
 * The Olumi tab on the core lane (View API design §2, §3): the conversation drawn exactly as the View holds it, bound by identity, and
 * the writes going straight to core's v1 routes with what core takes, then the View read again.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch, UNCERTAIN_WRITE } from '../../olumiCore/team/api'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat, ViewTurns } from '../ViewChat'

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const at = (v: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]), v)

describe('the conversation is drawn exactly as the View holds it', () => {
  const view = golden('s_ce285b3617bb')
  it('every drawn string is the View\'s own at its path, and every word of every turn is drawn', () => {
    const { container } = render(<ViewTurns chat={view.chat} />)
    for (const el of container.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(view, el.dataset['view']!))
    const strings = (x: unknown, p: string): string[] => typeof x === 'string' ? (x === '' ? [] : [p])
      : Array.isArray(x) ? x.flatMap((y, i) => strings(y, `${p}.${i}`))
      : x !== null && typeof x === 'object' ? Object.entries(x).flatMap(([k, y]) => (k === 'title' || k === 'about' || k === 'cite' ? [] : strings(y, `${p}.${k}`))) : []
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
  afterEach(() => { setTeamFetch(null); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }) })

  const type = (c: HTMLElement, text: string) => fireEvent.change(c.querySelector('#view-chat-text')!, { target: { value: text } })
  const send = (c: HTMLElement) => act(async () => { fireEvent.click([...c.querySelectorAll('button')].find((b) => b.textContent === 'Send')!) })

  it('a message is posted to the scenario\'s messages with an op id, the View is read again, and the box is cleared', async () => {
    answer(() => new Response(JSON.stringify({ proposal: 9 }), { status: 201 }))
    const { container } = render(<ViewChat />)
    type(container, 'Raise it by 30p instead')
    await send(container)
    await waitFor(() => expect(reads).toContain('/api/scenarios/s_000000000001/view'))
    expect(posts).toEqual([{ url: '/api/scenarios/s_000000000001/messages', body: { text: 'Raise it by 30p instead', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('')
  })

  it('a refused message keeps what was typed and says core\'s own words', async () => {
    answer(() => new Response(JSON.stringify({ error: 'text is too long (at most 4,000 characters)' }), { status: 413 }))
    const { container } = render(<ViewChat />)
    type(container, 'A long message')
    await send(container)
    await waitFor(() => expect(container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe('text is too long (at most 4,000 characters)'))
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('A long message')
  })

  it('a message whose answer never came may have been saved: it says so, and sending it again uses the same op id', async () => {
    let n = 0
    answer(() => { n++; if (n === 1) throw new TypeError('network'); return new Response(JSON.stringify({ proposal: 9 }), { status: 201 }) })
    const { container } = render(<ViewChat />)
    type(container, 'Raise it by 30p instead')
    await send(container)
    await waitFor(() => expect(container.querySelector('[data-testid="view-chat-said"]')?.textContent).toBe(UNCERTAIN_WRITE))
    await send(container)
    await waitFor(() => expect(posts).toHaveLength(2))
    expect((posts[1]!.body as { op: string }).op).toBe((posts[0]!.body as { op: string }).op)
  })

  it('the change card approves on its base and sets aside, each straight to core', async () => {
    useViewStore.setState({ view: { ...view, proposal: { id: 9, base: 3, heading: 'Olumi proposes 1 change', on: 'on version 3', removed: null, problem: null, marks: [] } } })
    answer(() => new Response(JSON.stringify({}), { status: 200 }))
    const { container } = render(<ViewChat />)
    expect(container.querySelector('[data-view="proposal.heading"]')!.textContent).toBe('Olumi proposes 1 change')
    await act(async () => { fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Approve')!) })
    await waitFor(() => expect(posts[0]).toEqual({ url: '/api/proposals/9/approve', body: { base: 3 } }))
    useViewStore.setState({ view: { ...view, proposal: { id: 9, base: 3, heading: 'Olumi proposes 1 change', on: 'on version 3', removed: null, problem: null, marks: [] } } })
    const { container: again } = render(<ViewChat />)
    await act(async () => { fireEvent.click([...again.querySelectorAll('button')].find((b) => b.textContent === 'Set aside')!) })
    await waitFor(() => expect(posts[1]).toEqual({ url: '/api/proposals/9/discard', body: {} }))
  })
})
