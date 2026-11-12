import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewChat, ViewComposer, ViewConversation, useViewChat } from '../ViewChat'

// Bind saved core turns, not invented replies (UI recovery witness row 11, DL 10 Nov).
const fixture: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const failed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'), 'utf8'))
const proposal: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/proposal.view.json'), 'utf8'))
const running: NonNullable<View['turn']> = { ...failed.turn!, status: 'answering', words: 'Olumi is answering.' }
const show = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-cb215d057b96', sid: view.id, view, error: null, status: 'ready', stale: false, at: null })
const follows = (first: Element, second: Element) => expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
let posts: { url: string; body: unknown }[] = []

beforeEach(() => {
  posts = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response('{}', { status: 201 }) }
    return new Response(JSON.stringify(fixture), { status: 200 })
  }) as unknown as typeof fetch)
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
  show(fixture)
})
afterEach(() => {
  cleanup()
  setTeamFetch(null)
  vi.unstubAllGlobals()
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
})

describe('chat as a thread (UI recovery witness row 11, DL 10 Nov)', () => {
  it('CT1 turns run oldest to newest, with each person bubble before its answer and receipt', () => {
    expect(fixture.chat.length).toBeGreaterThanOrEqual(2)
    const { getByTestId, queryByTestId, container } = render(<ViewChat />)
    const thread = getByTestId('view-chat-turns')
    expect(thread.tagName).toBe('OL')
    expect(container.querySelectorAll('[data-testid="view-chat-turns"]')).toHaveLength(1)
    const turns = [...thread.children]
    expect(turns.map((turn) => turn.getAttribute('data-view-turn'))).toEqual(fixture.chat.map((_, i) => `chat.${i}`))
    turns.forEach((turn, i) => {
      const said = turn.querySelector('[data-testid="view-chat-said-bubble"]')!
      const answer = turn.querySelector('[data-testid="view-chat-answer"]')!
      expect(said.querySelector(`[data-view="chat.${i}.said"]`)?.textContent).toBe(fixture.chat[i]!.said)
      const first = fixture.chat[i]!.answer!.answer[0]!
      expect(answer.querySelector(`[data-view="chat.${i}.answer.answer.0.text"]`)?.textContent).toBe('text' in first ? first.text : null)
      follows(said, answer)
      const receipt = turn.querySelector('[data-testid="view-chat-version"]')!
      expect(receipt.querySelector(`[data-view="chat.${i}.version"]`)?.textContent).toBe(fixture.chat[i]!.version)
      follows(answer, receipt)
    })
    expect(getByTestId('view-chat-latest')).toBe(turns.at(-1))
    expect(queryByTestId('view-chat-in-reply')).toBeNull()
    expect(thread.textContent).not.toContain('In reply to:')
  })

  it('CT2 earlier turns stay in the thread with no earlier-turn disclosure', () => {
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    expect(queryByTestId('view-chat-earlier')).toBeNull()
    for (const turn of getByTestId('view-chat-turns').children) expect(turn.closest('details')).toBeNull()
  })

  it('CT3 More ways is outside the scrolling thread and closed at rest, with bounded depth', () => {
    const { getByTestId } = render(<ViewChat />)
    const more = getByTestId('view-more-ways') as HTMLDetailsElement
    const scroll = getByTestId('view-chat-scroll')
    expect(scroll.contains(more)).toBe(false)
    expect(getByTestId('view-chat').contains(more)).toBe(true)
    follows(scroll, more)
    expect(more.open).toBe(false)
    const summary = more.querySelector('summary')!
    expect(summary).toHaveClass('text-text-body', 'underline', 'underline-offset-2')
    expect(summary).not.toHaveClass('text-info')
    const content = summary.nextElementSibling!
    // Re-pinned (pre-screen 4b92d394, DL 10 Nov): row 16 leaves more height for the thread.
    expect(content).toHaveClass('max-h-[25vh]', 'overflow-y-auto')
    expect(content.contains(getByTestId('view-session-menu'))).toBe(true)
    expect(content.contains(getByTestId('v10-method-chips'))).toBe(true)
  })

  it('CT4 a turn in flight follows the last saved turn, with thinking dots only while running', () => {
    show({ ...fixture, turn: running })
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    follows(getByTestId('view-chat-latest'), getByTestId('view-chat-turn-job'))
    expect(getByTestId('view-chat-turn-words').textContent).toBe(running.words)
    expect(getByTestId('view-chat-turn-seconds').textContent).toMatch(/\d+ s/)
    const dots = getByTestId('view-chat-dots')
    expect(dots.getAttribute('aria-hidden')).toBe('true')
    expect(dots).toHaveClass('motion-safe:animate-pulse')
    expect(dots.children).toHaveLength(3)
    expect(dots.textContent).toBe('')
    act(() => show({ ...fixture, turn: failed.turn }))
    expect(queryByTestId('view-chat-dots')).toBeNull()
    expect(queryByTestId('view-chat-turn-seconds')).toBeNull()
    expect(getByTestId('view-chat-turn-words').textContent).toBe(failed.turn!.words)
    follows(getByTestId('view-chat-latest'), getByTestId('view-chat-turn-job'))
  })

  it('CT5 scrolling back shows Latest, preserves the reading position, and resumes following on press', () => {
    // Re-pinned (pre-screen 4b92d394, DL 10 Nov): row 14 short turns still settle at the bottom.
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(1300)
    show({ ...fixture, chat: fixture.chat.slice(0, 1) })
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 200, configurable: true },
      scrollTop: { value: 200, writable: true, configurable: true },
    })
    fireEvent.scroll(scroll)
    const latest = getByTestId('view-chat-to-latest')
    expect(latest).toHaveAccessibleName('Go to the latest message')
    expect(latest.textContent).toBe('Latest')
    expect(latest).toHaveClass('min-h-[44px]', 'min-w-[44px]', 'text-text-body', 'border-panel-border', 'bg-panel')
    expect(latest).not.toHaveClass('text-info')
    expect(latest.querySelector('svg.lucide-arrow-down')).not.toBeNull()
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(200)
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(200)
    fireEvent.click(latest)
    expect(scroll.scrollTop).toBe(800)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    Object.defineProperty(scroll, 'scrollHeight', { value: 1200, configurable: true })
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(1000)
    scroll.scrollTop = 920
    fireEvent.scroll(scroll)
    Object.defineProperty(scroll, 'scrollHeight', { value: 1400, configurable: true })
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(1200)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    act(() => show({ ...fixture, chat: fixture.chat.slice(0, 1), turn: running }))
    expect(scroll.scrollTop).toBe(1200)
    scroll.scrollTop = 1119
    fireEvent.scroll(scroll)
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(1119)
    expect(getByTestId('view-chat-to-latest')).not.toBeNull()
  })

  // Keep keyboard sends on the button's write path (pre-screen 4b92d394 row 13).
  it('CT6 Enter sends once and clears; Shift+Enter, composition and empty text never send', async () => {
    const { getByRole, getByTestId } = render(<ViewComposer />)
    const box = getByRole('textbox') as HTMLTextAreaElement
    expect(box).toHaveAccessibleName('Message Olumi')
    fireEvent.change(box, { target: { value: fixture.chat[0]!.said } })
    expect(fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })).toBe(true)
    expect(fireEvent.keyDown(box, { key: 'Enter', isComposing: true })).toBe(true)
    expect(posts).toHaveLength(0)
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' })
      fireEvent.keyDown(box, { key: 'Enter' })
    })
    expect(posts).toEqual([{ url: `/api/scenarios/${fixture.id}/messages`, body: { text: fixture.chat[0]!.said, op: expect.any(String) } }])
    expect(box.value).toBe('')
    expect(getByTestId('view-composer-send')).toBeDisabled()
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(posts).toHaveLength(1)
  })

  it.each(['busy', 'past', 'drafting', 'unknown', 'answering'] as const)('CT6 Enter obeys the Send button while %s', (state) => {
    if (state === 'busy') useViewChat.setState({ busy: true })
    if (state === 'past') useViewStore.setState({ at: 1 })
    if (state === 'drafting') show({ ...fixture, draft: { ...failed.draft!, status: 'drafting' } })
    if (state === 'unknown') useViewStore.setState({ view: null, error: 'Read failed' })
    if (state === 'answering') show({ ...fixture, turn: running })
    const { getByRole, getByTestId } = render(<ViewComposer />)
    const box = getByRole('textbox')
    fireEvent.change(box, { target: { value: fixture.chat[0]!.said } })
    expect(getByTestId('view-composer-send')).toBeDisabled()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(posts).toHaveLength(0)
    expect(useViewChat.getState().text).toBe(fixture.chat[0]!.said)
  })

  it('CT7 the textarea grows to six lines, scrolls beyond the cap, shrinks and resets after Send', async () => {
    const { getByRole, getByTestId } = render(<ViewComposer />)
    const box = getByRole('textbox') as HTMLTextAreaElement
    box.style.lineHeight = '24px'; box.style.paddingTop = '4px'; box.style.paddingBottom = '4px'
    let height = 56
    Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => height })
    expect(box.rows).toBe(1)
    fireEvent.change(box, { target: { value: `${fixture.chat[0]!.said}\n${fixture.chat[1]!.said}` } })
    expect(box.style.height).toBe('56px')
    expect(box.style.overflowY).toBe('hidden')
    height = 1000
    fireEvent.change(box, { target: { value: fixture.chat.map((t) => t.said).join('\n').repeat(6) } })
    expect(box.style.height).toBe('152px')
    expect(box.style.overflowY).toBe('auto')
    height = 32
    fireEvent.change(box, { target: { value: fixture.chat[0]!.said } })
    expect(box.style.height).toBe('32px')
    expect(box.style.overflowY).toBe('hidden')
    height = 1000
    await act(async () => { fireEvent.click(getByTestId('view-composer-send')) })
    expect(box.value).toBe('')
    expect(box.rows).toBe(1)
    expect(box.style.height).toBe('')
    expect(box.style.overflowY).toBe('hidden')
    act(() => useViewStore.setState({ sid: null, view: null }))
    // No scenario yet: this is the brief box, and an empty brief box is three rows so its example shows whole
    // (DL 10 Nov, b1dBriefExample.spec). A thread's box, and a box that is busy or drafting, stay one row (asserted above).
    expect(box.rows).toBe(3)
  })

  // Geometry distinguishes the start of a long turn from the end (pre-screen 4b92d394 row 14).
  it('CT8 following brings a long new turn or job to its start minus 16px, and a short one to the bottom', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'view-chat-turn-job' ? 900 : 600
    })
    show({ ...fixture, chat: fixture.chat.slice(0, 1) })
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, {
      scrollHeight: { value: 1600, configurable: true },
      clientHeight: { value: 200, configurable: true },
    })
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(584)
    fireEvent.scroll(scroll)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(884)
    Object.defineProperty(scroll, 'scrollHeight', { value: 750, configurable: true })
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(550)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    scroll.scrollTop = 0; fireEvent.scroll(scroll)
    fireEvent.click(getByTestId('view-chat-to-latest'))
    expect(scroll.scrollTop).toBe(550)
  })

  it('CT8b (DL-183, Paul\'s 1.33 scale): with a Next step card below the newest reply, following brings the card whole into view, or its top when taller; CONTRAST: no card, the reply\'s start', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-next-step' ? 700 : 600 })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-next-step' ? 150 : 0 })
    show({ ...proposal, chat: proposal.chat.slice(0, Math.max(0, proposal.chat.length - 1)) })
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 200, configurable: true } })
    act(() => show(proposal))
    expect(queryByTestId('view-next-step'), 'precondition: core asks for a next step on a held proposal').not.toBeNull()
    expect(scroll.scrollTop).toBe(666) // 700 + 150 + 16 - 200: the card whole, its foot 16 px above the thread's
    cleanup()
    show({ ...proposal, chat: proposal.chat.slice(0, Math.max(0, proposal.chat.length - 1)) })
    const short = render(<ViewChat />).getByTestId('view-chat-scroll')
    Object.defineProperties(short, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 100, configurable: true } })
    act(() => show(proposal))
    expect(short.scrollTop).toBe(684) // taller than the thread: its top
  })

  // Growth can land on an existing turn, without a new job (pre-screen 4b92d394 row 15).
  it('CT9 observes content growth while following, preserves a scrolled-back position and disconnects', () => {
    let resize: ResizeObserverCallback = () => undefined
    const observe = vi.fn(), disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback }
      observe = observe
      disconnect = disconnect
    })
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(600)
    const edit = { ...fixture, chat: fixture.chat.map((t, i) => i === fixture.chat.length - 1 ? { ...t, answer: null } : t) }
    show(edit)
    const { getByTestId, queryByTestId, unmount } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    expect(observe).toHaveBeenCalledWith(scroll.firstElementChild)
    let height = 700
    Object.defineProperties(scroll, {
      scrollHeight: { configurable: true, get: () => height },
      clientHeight: { value: 200, configurable: true },
    })
    const grow = () => act(() => resize([], {} as ResizeObserver))
    grow()
    expect(scroll.scrollTop).toBe(500)
    const last = edit.chat[edit.chat.length - 1]!
    act(() => show({ ...edit, reply: { job: running.job, proposal: last.id, version: fixture.version!.id, status: 'running', words: running.words, by: running.by, by_id: running.by_id, started: running.started, at: running.at } as unknown as NonNullable<View['reply']> }))
    expect(getByTestId('view-chat-reply').textContent).toBe(running.words)
    height = 1200; grow()
    expect(scroll.scrollTop).toBe(584)
    fireEvent.scroll(scroll)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    act(() => show(fixture))
    height = 1400; grow()
    expect(scroll.scrollTop).toBe(584)
    scroll.scrollTop = 100; fireEvent.scroll(scroll)
    act(() => show({ ...fixture, proposal: proposal.proposal }))
    expect(getByTestId('view-chat-proposal')).not.toBeNull()
    height = 1600; grow()
    expect(scroll.scrollTop).toBe(100)
    expect(getByTestId('view-chat-to-latest').textContent).toBe('Latest')
    fireEvent.click(getByTestId('view-chat-to-latest'))
    expect(scroll.scrollTop).toBe(1400)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  // Closing the strip gives its space back after a press (pre-screen 4b92d394 row 16).
  it('CT10 More ways caps content at 25vh and closes after a method button is pressed', async () => {
    const { getByTestId, getAllByTestId } = render(<ViewChat />)
    const more = getByTestId('view-more-ways') as HTMLDetailsElement
    expect(more.querySelector('summary')!.nextElementSibling).toHaveClass('max-h-[25vh]', 'overflow-y-auto')
    fireEvent.click(more.querySelector('summary')!)
    await act(async () => { fireEvent(more, new Event('toggle')) })
    expect(more.open).toBe(true)
    await act(async () => { fireEvent.click(getAllByTestId('view-session-method')[0]!.querySelector('span')!) })
    expect(more.open).toBe(false)
    expect(posts).toEqual([{ url: `/api/scenarios/${fixture.id}/method`, body: { method: getAllByTestId('view-session-method')[0]!.getAttribute('data-method'), op: expect.any(String) } }])
    fireEvent.click(more.querySelector('summary')!)
    await act(async () => { fireEvent(more, new Event('toggle')) })
    fireEvent.click(getByTestId('v10-method-assumption'))
    expect(more.open).toBe(false)
    expect(useViewChat.getState().text).not.toBe('')
    expect(posts).toHaveLength(1)
  })

  // Distinguish another person's contribution before reading it (pre-screen 4b92d394 row 23).
  it('CT11 another person has an ink author line at their path above the bubble; own and anonymous turns do not', () => {
    const other = failed.chat[0]!
    expect(other.by_id).toBeTruthy()
    const view = { ...fixture, you_id: 'viewer', chat: [other, { ...other, id: other.id + 1000, by_id: 'viewer' }, { ...other, id: other.id + 2000, by_id: null }] }
    show(view)
    const { getByTestId, rerender } = render(<ViewChat />)
    const turns = getByTestId('view-chat-turns').children
    const author = turns[0]!.firstElementChild!
    expect(author.getAttribute('data-view')).toBe('chat.0.by')
    expect(author.textContent).toBe(other.by)
    expect(author).toHaveClass('text-[12px]', 'text-text-body')
    expect(author).not.toHaveClass('text-info')
    expect(author.nextElementSibling).toBe(turns[0]!.querySelector('[data-testid="view-chat-said-bubble"]'))
    expect(turns[1]!.firstElementChild).toHaveAttribute('data-testid', 'view-chat-said-bubble')
    expect(turns[2]!.firstElementChild).toHaveAttribute('data-testid', 'view-chat-said-bubble')
    rerender(<ViewConversation chat={view.chat} />)
    for (const turn of getByTestId('view-chat-turns').children) expect(turn.firstElementChild).toHaveAttribute('data-testid', 'view-chat-said-bubble')
  })
})
