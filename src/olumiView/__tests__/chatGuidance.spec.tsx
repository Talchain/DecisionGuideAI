/**
 * What the Olumi tab did besides its own composer, kept on the core lane (review 00054): it answers the canvas's asks (the guidance
 * store's send, prefill, dispatch and busy, which the node coaching icons need), routes a challenge press on one card to core's own
 * challenge route, treats a create whose answer could not be read as maybe saved, and never reuses one scenario's op id for another.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, waitFor } from '@testing-library/react'
import { setTeamFetch, UNCERTAIN_WRITE } from '../../olumiCore/team/api'
import { coreScenarioIdOf } from '../../olumiCore/team/sid'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { canReceiveAsk } from '../../canvas/ui/inspector-v2/askSemantic'
import { useCanvasStore } from '../../canvas/store'
import type { View } from '../client'
import { useViewStore } from '../store'
import { STILL_ANSWERING, ViewChat, ViewComposer, useAnswersAsks, useViewChat } from '../ViewChat'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
const card = view.model!.cards.find((c) => c.family === 'quantity')!
const UUID = '00000000-0000-4000-8000-000000000001', SID = 's_000000000001'
let posts: { url: string; body: Record<string, unknown> }[] = []
const answer = (respond: (url: string) => Response | Promise<Response>) => setTeamFetch((async (url: string, init?: RequestInit) => {
  if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return respond(url) }
  return new Response(JSON.stringify(view), { status: 200 })
}) as unknown as typeof fetch)
const saved = () => answer(() => new Response(JSON.stringify({ proposal: null }), { status: 201 }))
const said = (c: HTMLElement) => c.querySelector('[data-testid="view-chat-said"]')?.textContent

beforeEach(() => {
  posts = []
  try { localStorage.clear() } catch { /* none */ }
  useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false })
  useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
})
afterEach(() => {
  setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null })
})

describe('the canvas\'s asks reach core through the Olumi tab (00054 #3)', () => {
  it('mounting the tab answers send, prefill, dispatch and busy, so the coaching icons can ask; leaving it lets them go', () => {
    const { unmount } = render(<ViewChat />)
    const g = useGuidanceStore.getState()
    expect([g._sendMessage, g._prefillChat, g._dispatchAction, g._isConversationBusy].every((f) => typeof f === 'function')).toBe(true)
    expect(canReceiveAsk(g)).toBe(true)
    unmount()
    expect(canReceiveAsk(useGuidanceStore.getState())).toBe(false)
  })

  it('the asks stay answered while any holder (the dock, the tab) is on the page, and go with the last (lane audit 24)', () => {
    function Holder() { useAnswersAsks(); return null }
    const dock = render(<Holder />), tab = render(<ViewChat />)
    tab.unmount()
    expect(canReceiveAsk(useGuidanceStore.getState())).toBe(true)
    dock.unmount()
    expect(canReceiveAsk(useGuidanceStore.getState())).toBe(false)
  })

  it('a prefill puts the words in the composer', () => {
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    act(() => { useGuidanceStore.getState()._prefillChat!('What drives the price?') })
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('What drives the price?')
  })

  it('a send is a message to core, with an op id', async () => {
    saved(); render(<ViewChat />)
    await act(async () => { useGuidanceStore.getState()._sendMessage!('What drives the price?') })
    await waitFor(() => expect(posts).toEqual([{ url: `/api/scenarios/${SID}/messages`, body: { text: 'What drives the price?', op: expect.any(String) } }]))
  })

  it('a challenge pressed on one card of the model goes to core\'s challenge route for that card', async () => {
    saved(); render(<ViewChat />)
    useCanvasStore.setState({ selection: { nodeIds: new Set([card.id]), edgeIds: new Set(), anchorPosition: null } })
    await act(async () => { useGuidanceStore.getState()._dispatchAction!({ id: 'ask:challenge', label: 'Challenge', message: 'Challenge this', source: 'chip' }) })
    await waitFor(() => expect(posts).toEqual([{ url: `/api/scenarios/${SID}/challenge`, body: { kind: 'assumption', record: card.id, op: expect.any(String) } }]))
  })

  it('any other press says its words to core as a message', async () => {
    saved(); render(<ViewChat />)
    await act(async () => { useGuidanceStore.getState()._dispatchAction!({ id: 'ask:challenge', label: 'Challenge', message: 'Challenge the brief', source: 'chip' }) })
    await waitFor(() => expect(posts).toEqual([{ url: `/api/scenarios/${SID}/messages`, body: { text: 'Challenge the brief', op: expect.any(String) } }]))
  })

  it('busy is true while a write is in flight', async () => {
    let done!: (r: Response) => void
    answer(() => new Promise<Response>((r) => { done = r })); render(<ViewChat />)
    act(() => { useGuidanceStore.getState()._sendMessage!('Hello') })
    await waitFor(() => expect(useGuidanceStore.getState()._isConversationBusy!()).toBe(true))
    await act(async () => { done(new Response('{}', { status: 201 })) })
    await waitFor(() => expect(useGuidanceStore.getState()._isConversationBusy!()).toBe(false))
  })
})

describe('an ask made while Olumi is still answering is kept, never lost (00055)', () => {
  it('the words wait in the composer, each kept after the last (00056 #1), which says so, and nothing is sent twice', async () => {
    let done!: (r: Response) => void
    answer(() => new Promise<Response>((r) => { done = r }))
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    act(() => { useGuidanceStore.getState()._sendMessage!('Hello') })
    await waitFor(() => expect(useGuidanceStore.getState()._isConversationBusy!()).toBe(true))
    act(() => { useGuidanceStore.getState()._sendMessage!('Set rent to £7,500') })
    act(() => { useGuidanceStore.getState()._dispatchAction!({ id: 'ask:challenge', label: 'Challenge', message: 'Challenge this', source: 'chip' }) })
    expect(posts).toHaveLength(1)
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('Set rent to £7,500\nChallenge this')
    expect(said(container)).toBe(STILL_ANSWERING)
    await act(async () => { done(new Response('{}', { status: 201 })) })
    expect(posts).toHaveLength(1)
  })
})

describe('core\'s own sentence for a failed send reaches the person, and the words stay to send again (coreFailureWords.spec, on the View lane)', () => {
  const said401 = 'Open your private link again to keep working.'
  for (const [status, words] of [
    [401, said401],
    [409, 'The model moved while you were typing. Nothing was saved.'],
    [429, 'Too many requests. Try again in 30 seconds.'],
    [502, 'Olumi could not finish that. Nothing was saved.'],
  ] as const) {
    it(`${status}: core's words, verbatim, and the message kept in the composer`, async () => {
      answer(() => new Response(JSON.stringify({ error: words }), { status }))
      const { container } = render(<><ViewChat /><ViewComposer /></>)
      act(() => { useViewChat.setState({ text: 'What matters most here?' }) })
      await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click() })
      await waitFor(() => expect(said(container)).toBe(words))
      expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('What matters most here?')
    })
  }
})

describe('a send from the canvas that core refuses keeps its words (00056 #2)', () => {
  it('the words go to the composer with core\'s own sentence, so the person can send them again', async () => {
    answer(() => new Response(JSON.stringify({ error: 'text is too long (at most 4,000 characters)' }), { status: 413 }))
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    act(() => { useViewChat.setState({ text: 'My draft' }) })
    await act(async () => { useGuidanceStore.getState()._sendMessage!('Set rent to £7,500') })
    await waitFor(() => expect(said(container)).toBe('text is too long (at most 4,000 characters)'))
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('My draft\nSet rent to £7,500')
  })

  it('a press whose answer never came keeps its words too', async () => {
    answer(() => { throw new TypeError('network') })
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    await act(async () => { useGuidanceStore.getState()._dispatchAction!({ id: 'ask:challenge', label: 'Challenge', message: 'Challenge the brief', source: 'chip' }) })
    await waitFor(() => expect(said(container)).toBe(UNCERTAIN_WRITE))
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('Challenge the brief')
  })
})

describe('a brief whose answer could not be read may have been saved (00054 #4)', () => {
  it('it says so, keeps the brief and its op id, and pairs nothing', async () => {
    const fresh = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
    useViewStore.setState({ uuid: fresh, sid: null, view: null, error: null, status: 'none' })
    answer(() => new Response('{"scen', { status: 201 }))
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    act(() => { useViewChat.setState({ text: 'Should we raise the price?' }) })
    await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click() })
    await waitFor(() => expect(said(container)).toBe(UNCERTAIN_WRITE))
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('Should we raise the price?')
    expect(coreScenarioIdOf(fresh)).toBeNull()
    await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click() })
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body['op']).toBe(posts[0]!.body['op'])
  })
})

describe('a brief answered with JSON null may have been saved (00055/00056 ledger)', () => {
  it('it says so and keeps the brief, never "Nothing was saved"', async () => {
    const fresh = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
    useViewStore.setState({ uuid: fresh, sid: null, view: null, error: null, status: 'none' })
    answer(() => new Response('null', { status: 201 }))
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    act(() => { useViewChat.setState({ text: 'Should we raise the price?' }) })
    await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click() })
    await waitFor(() => expect(said(container)).toBe(UNCERTAIN_WRITE))
    expect((container.querySelector('#view-chat-text') as HTMLTextAreaElement).value).toBe('Should we raise the price?')
    expect(coreScenarioIdOf(fresh)).toBeNull()
  })
})

describe('an op id belongs to one scenario and one kind of write (00054 #5)', () => {
  it('the same brief sent from another new scenario after a lost answer is a new write', async () => {
    const A = '1b4e28ba-2fa1-41d2-883f-0016d3cca427', B = '2c5f39cb-3ab2-42e3-994f-1127e4ddb538'
    useViewStore.setState({ uuid: A, sid: null, view: null, error: null, status: 'none' })
    answer(() => { throw new TypeError('network') })
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    act(() => { useViewChat.setState({ text: 'Should we raise the price?' }) })
    await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click() })
    await waitFor(() => expect(said(container)).toBe(UNCERTAIN_WRITE))
    act(() => { useViewStore.setState({ uuid: B, sid: null }) })
    await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click() })
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body['op']).not.toBe(posts[0]!.body['op'])
  })
})
