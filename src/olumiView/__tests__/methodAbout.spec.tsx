/**
 * W2 (Paul 0950 point 5): a menu question is asked about the card the person has selected, and the chat shows the question itself.
 * - The press posts core's `POST …/method` body with the ONE selected card as `about` (core checks it against the model this reader sees); with none, the body is
 *   exactly as before.
 * - A turn core types `ask: 'method'` draws the question in core's own words (its `said`), as the press it is (data-pressed="method", never their typed words), then
 *   the heading of the card core says it was `about`, where the reader's model has it. A challenge keeps its chrome as before.
 * The Views are sessionMenu.spec.tsx's scripted core fixtures; zero AI calls.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat, ViewComposer, PRESSED_WORDS } from '../ViewChat'
import { useCanvasStore } from '../../canvas/store'

const DIR = path.resolve('src/olumiView/fixtures/session')
const fixture = (n: string): View => JSON.parse(readFileSync(path.join(DIR, `${n}.view3.json`), 'utf8'))
const SID = 's_cb215d057b96'
const UUID = '00000000-0000-4000-8000-cb215d057b96'
const OP = expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/)
let posts: { url: string; body: unknown }[] = []
const core = (next: () => View) => setTeamFetch((async (url: string, init?: RequestInit) => {
  if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ proposal: 6, discussion: true }), { status: 201 }) }
  return new Response(JSON.stringify(next()), { status: 200 })
}) as unknown as typeof fetch)
const show = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false, at: null })
const select = (ids: string[]) => useCanvasStore.setState({ selection: { nodeIds: new Set(ids), edgeIds: new Set(), anchorPosition: null } } as never)
const renderTab = () => {
  const c = render(<><ViewChat /><ViewComposer /></>).baseElement
  const b = c.querySelector('[data-testid="view-actions-button"]')
  if (b !== null && c.querySelector('[data-testid="view-actions-menu"]') === null) act(() => { fireEvent.click(b) })
  return c
}
const method = (c: HTMLElement, id: string) => [...c.querySelectorAll<HTMLButtonElement>('[data-testid="view-session-method"]')].find((b) => b.dataset['method'] === id)!
beforeEach(() => { posts = []; select([]) })
afterEach(() => { cleanup(); select([]) })

describe('a menu question asked about the selected card', () => {
  it('with one card selected, the press posts { method, op, about: that card } and nothing else; with none, exactly { method, op } as before', async () => {
    const before = fixture('goal-understand'), after = fixture('after-find-first'), card = before.model!.cards[0]!.id
    core(() => after); show(before); select([card])
    let c = renderTab()
    await act(async () => { fireEvent.click(method(c, 'find_first')) })
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/method`, body: { method: 'find_first', op: OP, about: card } })
    cleanup(); posts = []; select([])
    core(() => after); show(before)
    c = renderTab()
    await act(async () => { fireEvent.click(method(c, 'find_first')) })
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: `/api/scenarios/${SID}/method`, body: { method: 'find_first', op: OP } })
  })

  it('a method turn draws core\'s question and the heading of the card it was about, as the press; with no about only the question; a challenge keeps its chrome', () => {
    const base = fixture('goal-understand'), card = base.model!.cards[0]!
    const turn = (ask: string, about?: string | null) => ({ ...base.chat[0]!, said: 'What should we find out first?', ask, ...(about === undefined ? {} : { about }) })
    const drawn = (chat: unknown[]) => { show({ ...base, chat } as unknown as View); return render(<ViewChat />).baseElement.querySelector<HTMLElement>('[data-testid="view-chat-pressed"]')! }
    // What is seen: everything but the screen-reader cue, which says in words that this was a press (the mark is decorative).
    const seen = (p: HTMLElement) => [...p.childNodes].filter((n) => !(n instanceof HTMLElement && n.dataset['testid'] === 'view-chat-method-cue')).map((n) => n.textContent).join('')
    let p = drawn([turn('method', card.id)])
    expect([p.dataset['pressed'], seen(p), p.querySelector('[data-testid="view-chat-method-cue"]')?.textContent]).toEqual(['method', `What should we find out first? · ${card.heading}`, `${PRESSED_WORDS}: `])
    cleanup()
    p = drawn([turn('method')])
    expect([p.dataset['pressed'], seen(p), p.querySelector('[data-testid="view-chat-method-about"]')]).toEqual(['method', 'What should we find out first?', null])
    cleanup()
    // A card the reader's model does not hold names nothing (core nulls such a card; the page never invents a heading).
    p = drawn([turn('method', 'zz_not_in_this_model')])
    expect(seen(p)).toBe('What should we find out first?')
    cleanup()
    p = drawn([turn('challenge', card.id)])
    expect([p.dataset['pressed'], p.textContent]).toEqual(['challenge', PRESSED_WORDS])
  })
})
