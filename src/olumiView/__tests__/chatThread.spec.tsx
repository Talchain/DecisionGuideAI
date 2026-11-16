import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { NEXT_STEP_WORDS, ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { useUIStore } from '../../stores/uiStore'
import { bodyOf, isOpen, rowOf, setOpen } from './reviewRow'

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

  it('CT3 (V12) the ⋯ menu is outside the scrolling thread, in the composer, closed at rest and bounded in height; "More ways" is gone', async () => {
    const { getByTestId, queryByTestId } = render(<><ViewChat /><ViewComposer /></>)
    expect(queryByTestId('view-more-ways')).toBeNull()
    expect(queryByTestId('view-actions-menu')).toBeNull()
    const scroll = getByTestId('view-chat-scroll'), button = getByTestId('view-actions-button')
    expect(scroll.contains(button)).toBe(false)
    expect(getByTestId('view-composer').contains(button)).toBe(true)
    await act(async () => { fireEvent.click(button) })
    const menu = getByTestId('view-actions-menu')
    expect(menu).toHaveClass('max-h-[60vh]', 'overflow-y-auto')
    expect(menu.contains(getByTestId('view-session-menu'))).toBe(true)
    expect(menu.contains(getByTestId('view-session-goal'))).toBe(true)
    expect(queryByTestId('v10-method-chips')).toBeNull()
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

  it('CT8f CATCH (contract 3, Codex 15 Nov): a long brief before Olumi\'s first reply: the thread rests on the REPLY\'s first line, and the floor marker is the reply container', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'view-floor-reply' ? 900 : this.dataset.testid === 'view-floor-turn' ? 600 : 0
    })
    show(fixture)
    const { getByTestId, container } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600 }, clientHeight: { value: 200 } })
    const brief = 'A long brief. '.repeat(60).trim()
    const floor = [{ job: 101, at: '2026-11-14T08:00:00Z', by: 'Alex', by_id: '101', said: brief, text: 'Here is a first reading of your situation.' }]
    act(() => show({ ...fixture, floor } as unknown as View))
    const marker = container.querySelector<HTMLElement>('[data-latest-floor]')!
    expect(marker.getAttribute('data-testid')).toBe('view-floor-reply')
    expect(marker.textContent).not.toContain('A long brief')
    expect(scroll.scrollTop).toBe(884) // 900 - 16; with the marker on the whole exchange it rested on the brief: 600 - 16 = 584
  })

  it('follows the newest floor reply while retaining actions on the most recent saved turn', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-latest-floor') ? 900 : 600
    })
    show(fixture)
    const { getByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600 }, clientHeight: { value: 200 } })
    const floor = [{ job: 101, at: '2026-11-14T08:00:00Z', by: 'Alex', by_id: '101', said: 'A correction', text: 'Understood.' }]
    act(() => show({ ...fixture, floor } as unknown as View))
    expect(getByTestId('view-chat-latest')).toBeTruthy()
    expect(scroll.scrollTop).toBe(884)
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

  // DL-538 (14 Nov, the target panel): Olumi's proposal with Approve / Set aside is pinned between the thread and the composer, never buried.
  // These two rows replaced CT8b "following brings the card whole into view" and CT8c "the block runs from the question's top": the card is
  // no longer in the thread to be scrolled to.
  it('CT8r CATCH (contract 3, Codex 15 Nov): the thread rests on the newest REPLY\'s first line, not on the person\'s message drawn above it in the same turn', () => {
    const bare = { ...proposal, model: { ...proposal.model!, coaching_questions: [] } } as View
    // The newest turn: the person's message from 600, Olumi's reply below it from 900 (a tall message).
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-chat-answer' ? 900 : this.dataset.testid === 'view-chat-latest' ? 600 : 0 })
    show({ ...bare, chat: bare.chat.slice(0, Math.max(0, bare.chat.length - 1)) })
    const { getByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 200, configurable: true } })
    act(() => show(bare))
    expect(getByTestId('view-chat-latest').querySelector('[data-testid="view-chat-answer"]'), 'precondition: the newest turn holds Olumi\'s reply').not.toBeNull()
    expect(scroll.scrollTop).toBe(884) // 900 - 16; before: the turn's own top, 600 - 16 = 584, with the reply below the clipped thread
  })

  it('CT8s CATCH (Codex 15 Nov, round 2): where the early reply and the answer are both drawn, the thread rests on the ANSWER\'s first line', () => {
    let resize: ResizeObserverCallback = () => undefined
    vi.stubGlobal('ResizeObserver', class { constructor(cb: ResizeObserverCallback) { resize = cb } observe = vi.fn(); disconnect = vi.fn() })
    const bare = { ...proposal, model: { ...proposal.model!, coaching_questions: [] } } as View
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-chat-answer' ? 1000 : this.dataset.testid === 'view-chat-early' ? 700 : this.dataset.testid === 'view-chat-latest' ? 600 : 0 })
    show({ ...bare, chat: bare.chat.slice(0, Math.max(0, bare.chat.length - 1)) })
    const { getByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 200, configurable: true } })
    const latest = () => getByTestId('view-chat-latest')
    act(() => show(bare))
    // An early reply drawn above the answer in the newest turn, as ViewChat draws one (the DOM order the old comma query took first).
    const early = document.createElement('div'); early.dataset.testid = 'view-chat-early'
    latest().insertBefore(early, latest().querySelector('[data-testid="view-chat-answer"]'))
    act(() => resize([], {} as ResizeObserver)) // the thread's content grew: the browser reports it, the thread rests again
    expect(scroll.scrollTop).toBe(984) // 1000 - 16; the comma query took the early reply: 700 - 16 = 684
  })
  it('CT8g CATCH (contract 3 on the redesign, 15 Nov): a figure step below a long newest reply does not carry the thread past the reply\'s first line', () => {
    // A View whose next step is a figure the person can type (core's bakery golden) with a conversation in it.
    const bakery: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8'))
    const asked = { ...bakery, chat: fixture.chat } as View
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-next-step' ? 900 : this.dataset.testid === 'view-chat-answer' ? 600 : 0 })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-next-step' ? 150 : 0 })
    show({ ...asked, chat: asked.chat.slice(0, 1) })
    const { getByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 200, configurable: true } })
    act(() => show(asked))
    expect(getByTestId('view-next-step').getAttribute('data-step'), 'precondition: the step is a figure, drawn in the thread').toBe('figure')
    expect(getByTestId('view-chat-latest').querySelector('[data-testid="view-chat-answer"]'), 'precondition: the newest turn holds Olumi\'s reply').not.toBeNull()
    // CATCH: the step rule alone brings the step whole into view (900 + 150 + 16 - 200 = 866), the reply's first line above the thread.
    expect(scroll.scrollTop).toBe(584) // 600 - 16
  })

  it('CT8b (DL-538): a held proposal\'s Next step card is pinned outside the thread\'s scroll, above the composer; the thread follows the newest reply\'s start', () => {
    const bare = { ...proposal, model: { ...proposal.model!, coaching_questions: [] } } as View
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-next-step' ? 700 : 600 })
    show({ ...bare, chat: bare.chat.slice(0, Math.max(0, bare.chat.length - 1)) })
    const { getByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 200, configurable: true } })
    act(() => show(bare))
    const step = getByTestId('view-next-step')
    expect(step.closest('[data-testid="view-chat-pinned"]'), 'pinned').not.toBeNull()
    expect(scroll.contains(step), 'not in the thread').toBe(false)
    // Contract 3: the proposal is one row, closed at rest; Approve is in its body. Open it (what the person does to reach Approve), then the
    // PL-1083 / DL-538 placement is bound as before: Approve on the pinned card, inside the review, which is inside the pinned box.
    const review = getByTestId('view-proposal-review')
    expect(isOpen(review), 'closed at rest').toBe(false)
    setOpen(review, true)
    const approve = step.querySelector('[data-testid="view-approve"]')
    expect(approve, 'Approve is on the pinned card').not.toBeNull()
    expect(review.contains(approve), 'Approve is in the opened review').toBe(true)
    expect(getByTestId('view-chat-pinned').contains(approve), 'and in the pinned box').toBe(true)
    expect(scroll.scrollTop).toBe(584) // the newest reply's start (600 - 16)
  })

  it('CT8c (DL-538): Olumi\'s question stays in the thread, above the pinned proposal', () => {
    const asked = { ...proposal, model: { ...proposal.model!, coaching_questions: ['What would success look like here?'] } } as View
    show(asked)
    const { getByTestId } = render(<ViewChat />)
    expect(getByTestId('view-chat-scroll').contains(getByTestId('view-model-question'))).toBe(true)
    follows(getByTestId('view-model-question'), getByTestId('view-chat-pinned'))
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
    // DL 15 Nov: "Latest" never covers the thread or the review's words at 1232: its own row under the thread, outside the scroller's box.
    expect(getByTestId('view-chat-to-latest').closest('[data-testid="view-chat-latest-row"]')).not.toBeNull()
    expect(scroll.parentElement!.contains(getByTestId('view-chat-to-latest')), 'not drawn over the thread').toBe(false)
    fireEvent.click(getByTestId('view-chat-to-latest'))
    expect(scroll.scrollTop).toBe(1400)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  // Closing the strip gives its space back after a press (pre-screen 4b92d394 row 16).
  it('CT10 (V12) the ⋯ menu closes after a question is pressed, which posts that question once; the four icons fill the box and send nothing', async () => {
    const { getByTestId, getAllByTestId, queryByTestId } = render(<><ViewChat /><ViewComposer /></>)
    await act(async () => { fireEvent.click(getByTestId('view-actions-button')) })
    expect(getByTestId('view-actions-button')).toHaveAttribute('aria-expanded', 'true')
    const first = getAllByTestId('view-session-method')[0]!
    const id = first.getAttribute('data-method')
    await act(async () => { fireEvent.click(first.querySelector('span')!) })
    expect(queryByTestId('view-actions-menu')).toBeNull()
    expect(posts).toEqual([{ url: `/api/scenarios/${fixture.id}/method`, body: { method: id, op: expect.any(String) } }])
    fireEvent.click(getByTestId('view-composer-method-assumption'))
    expect(useViewChat.getState().text).not.toBe('')
    expect(posts).toHaveLength(1)
  })

  // Distinguish another person's contribution before reading it (pre-screen 4b92d394 row 23); DL-538 (the target panel): every named
  // bubble carries its author inside it. This row replaced CT11 "an ink author line above the bubble; own and anonymous turns do not".
  it('CT11 (DL-538) each named turn\'s bubble opens with its author line at its path, another person\'s in ink and the viewer\'s quieter; an anonymous turn has none', () => {
    const other = failed.chat[0]!
    expect(other.by_id).toBeTruthy()
    const view = { ...fixture, you_id: 'viewer', chat: [other, { ...other, id: other.id + 1000, by_id: 'viewer' }, { ...other, id: other.id + 2000, by_id: null }] }
    show(view)
    const { getByTestId } = render(<ViewChat />)
    const turns = [...getByTestId('view-chat-turns').children]
    for (const turn of turns) expect(turn.firstElementChild).toHaveAttribute('data-testid', 'view-chat-said-bubble')
    const author = (i: number) => turns[i]!.firstElementChild!.querySelector(`[data-view="chat.${i}.by"]`)
    expect(author(0)?.textContent).toBe(other.by)
    expect(author(0)).toBe(turns[0]!.firstElementChild!.firstElementChild)
    expect(author(0)).toHaveClass('text-text-body')
    expect(author(0)).not.toHaveClass('text-info')
    expect(author(1)?.textContent).toBe(other.by)
    expect(author(1)).toHaveClass('text-text-light')
    expect(author(2), 'anonymous: no author').toBeNull()
  })
})


describe('the shown model’s existing open question in the ordinary panel', () => {
  const question = 'What would success look like here? The brief does not yet say what is being aimed for.'
  it('draws the questions verbatim as Olumi’s, first first, above approval, without sending anything (ORDER-UI-5 (2): every one, not only the first)', () => {
    const view = structuredClone(proposal)
    view.model!.coaching_questions = [question, 'What evidence could change your view?']
    show(view)
    const { getByTestId } = render(<ViewChat />)
    expect(getByTestId('view-model-question').textContent).toContain('Olumi’s questions')
    expect(getByTestId('view-model-question-text').textContent).toBe(question)
    expect(getByTestId('view-model-question-text-1').textContent).toBe('What evidence could change your view?')
    follows(getByTestId('view-model-question-text'), getByTestId('view-model-question-text-1'))
    follows(getByTestId('view-model-question'), getByTestId('view-next-step'))
    expect(posts).toEqual([])
  })
  it('ORDER-UI-5 (2), real View (golden s_ce285b3617bb, core\'s funding draft with six open questions): the first three, in core\'s order, each painted whole and reachable in the panel\'s scroll; the fourth is not drawn', () => {
    const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
    const qs = real.model!.coaching_questions!
    expect(qs.length, 'precondition: core sends more than three').toBeGreaterThan(3)
    show(real)
    const { getByTestId, queryByTestId, queryByText } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    for (const at of [0, 1, 2]) {
      const el = getByTestId(at === 0 ? 'view-model-question-text' : `view-model-question-text-${at}`)
      expect([el.textContent, el.getAttribute('data-view')], `question ${at}`).toEqual([qs[at], `model.coaching_questions.${at}`])
      // painted: rendered in the open panel, not hidden or clipped by a class; reachable: inside the panel's own scroll
      expect(scroll.contains(el), `question ${at} is in the panel's scroll`).toBe(true)
      for (let e: HTMLElement | null = el; e !== null && e !== scroll; e = e.parentElement) expect(e.hidden || /\b(hidden|sr-only|truncate|line-clamp-\d)\b/.test(e.className), `question ${at}: ${e.tagName} hides it`).toBe(false)
    }
    expect(queryByTestId('view-model-question-text-3')).toBeNull()
    expect(queryByText(qs[3]!)).toBeNull()
    expect(posts).toEqual([])
  })
  it('ORDER-UI-5 (2), SEAM-13 c2 13bd106e: a question core gives with its figure (model.trial_questions) is painted first and opens THAT figure\'s editor; core\'s bare questions are words; three at most', () => {
    const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
    const card = real.model!.cards.find((c) => c.id === 'horizon')!
    // DERIVED: core's trial_questions item shape and words as core's own row serves them (rebuild-journey.test.ts:1571/1608 at 13bd106e),
    // on a figure of this real View with its own edit; the id is the figure's, the edit the one its card offers.
    const QN = 'How far along are your funding conversations: when would the first money arrive, as things stand?'
    const view = { ...real, model: { ...real.model!, trial_questions: [{ id: 'blank-row', text: '', title: '', answer: true, unknown: null, edit: null }, { id: card.id, text: `‘${card.heading}’`, title: QN, answer: true, unknown: null, edit: card.figure!.edit! }] } } as View
    show(view)
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    const first = getByTestId('view-model-question-text')
    expect([first.textContent, first.getAttribute('data-question-id'), first.getAttribute('data-view')]).toEqual([QN, card.id, 'model.trial_questions.1.title'])
    const link = getByTestId(`view-question-edit-${card.id}`)
    expect(link.tagName).toBe('BUTTON')
    fireEvent.click(link)
    // the figure's own editor, in core's words for THAT figure
    const typed = getByTestId(`view-question-typed-${card.id}`)
    expect(typed.ownerDocument.querySelector(`label[for="view-question-${card.id}"]`)?.textContent).toBe(card.figure!.edit!.prompt)
    // core's bare questions follow, as words with no control; three in all
    const second = getByTestId('view-model-question-text-1')
    expect([second.textContent, second.querySelector('button')]).toEqual([real.model!.coaching_questions![0], null])
    expect(getByTestId('view-model-question-text-2').textContent).toBe(real.model!.coaching_questions![1])
    expect(queryByTestId('view-model-question-text-3')).toBeNull()
    expect(posts).toEqual([])
  })
  it('SEAM-13 c2: a trial question with no edit (a proposal is held) is core\'s words, never dropped and never a control', () => {
    const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
    const QN = 'How far along are your funding conversations: when would the first money arrive, as things stand?'
    show({ ...real, model: { ...real.model!, trial_questions: [{ id: 'horizon', text: '‘Funding window’', title: QN, answer: true, unknown: null, edit: null }] } } as View)
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    expect(getByTestId('view-model-question-text').textContent).toBe(QN)
    expect(queryByTestId('view-question-edit-horizon')).toBeNull()
  })
  it('withdraws the question when the saved View no longer carries it; older payloads need no field', () => {
    const view = structuredClone(proposal)
    view.model!.coaching_questions = [question]
    show(view)
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    expect(getByTestId('view-model-question-text').textContent).toBe(question)
    act(() => show({ ...view, proposal: null, model: { ...view.model!, coaching_questions: [] } }))
    expect(queryByTestId('view-model-question')).toBeNull()
    const older = structuredClone(view)
    delete older.model!.coaching_questions
    act(() => show(older))
    expect(queryByTestId('view-model-question')).toBeNull()
    expect(posts).toEqual([])
  })
})

describe('DL-538: Olumi\'s reply carries Olumi\'s mark', () => {
  it('CT12 each reply opens with core\'s glyph for Olumi (model.key, by id), named in core\'s words; CONTRAST: a model with no Olumi key item draws none', () => {
    const k = fixture.model!.key.find((x) => x.id === 'olumi')!
    show(fixture)
    const first = render(<ViewChat />).getByTestId('view-chat-turns').children[0]!
    const mark = first.querySelector('[data-testid="view-chat-answer"] [data-view="chat.0.answer.mark"]')
    expect([mark?.textContent, mark?.getAttribute('aria-label')]).toEqual([k.glyph, k.text])
    cleanup()
    show({ ...fixture, model: { ...fixture.model!, key: fixture.model!.key.filter((x) => x.id !== 'olumi') } } as View)
    expect(render(<ViewChat />).container.querySelector('[data-view="chat.0.answer.mark"]')).toBeNull()
  })
})

describe('Contract 3 (15 Nov): the pinned proposal is ONE row, closed at rest; opened, it reads its step whole above its buttons (DL 06:57Z (2) still binds the open box)', () => {
  const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
  const rule = (sel: string) => [...css.matchAll(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join(';')
  const heldWords = () => proposal.proposal!
  // The held proposal, as the rows below read it (the NS rows read the CSS only).
  beforeEach(() => { show(proposal) })

  it('NS1 CATCH (contract 3, Codex 15 Nov, held 329 with nine changes): nothing in the open box shrinks, the list of changes included, so core\'s words and warnings above it can never squeeze it to 0 px; the pinned box is the one scroll body, the actions sticky at its foot', () => {
    expect(rule('.ok-pinned')).toMatch(/display: flex; flex-direction: column/)
    expect(rule(".ok-pinned [data-testid='view-next-step'] > *, .ok-pinned [data-testid='view-chat-proposal'] > *")).toMatch(/flex: none/)
    // Before: `flex: 0 1 auto; min-height: 0` made the list the only part that gave way (0 px at 1232x704 and 1.33 on held 329).
    expect(rule(".ok-pinned [data-testid='view-chat-proposal'] > [data-testid='view-changes']")).toMatch(/^\s*flex: none;\s*$/)
    expect(rule('.ok-pinned .ok-actions')).toMatch(/position: sticky; bottom: 0/)
    expect(document.querySelector('[data-testid="view-chat-pinned"]') ?? render(<ViewChat />).getByTestId('view-chat-pinned')).toHaveClass('overflow-y-auto')
  })

  // CATCH (fails on the old css: the three :has rules were `.ok-pinned [data-reading-row]` / `.ok-pinned:has([data-reading-row])`, so a CLOSED
  // review holding reading rows still hid More ways, clipped the thread and let the box shrink). CONTRAST: the old selectors now match nothing.
  it('NS1b the readings rules apply only while the review is OPEN: More ways hides, the thread yields and the box shrinks only while it is open', () => {
    expect(rule("[data-testid='view-chat']:has(.ok-pinned [data-review-body]:not([hidden]) [data-reading-row]) > [data-testid='view-more-ways']")).toMatch(/display: none/)
    expect(rule("[data-testid='view-chat']:has(.ok-pinned [data-review-body]:not([hidden]) [data-reading-row]) > [data-thread-wrap]")).toMatch(/min-height: 0; overflow: hidden/)
    expect(rule('.ok-pinned:has([data-review-body]:not([hidden]) [data-reading-row])')).toMatch(/flex-shrink: 1/)
    expect(rule("[data-testid='view-chat']:has(.ok-pinned [data-reading-row]) > [data-testid='view-more-ways']"), 'old rule gone').toBe('')
    expect(rule("[data-testid='view-chat']:has(.ok-pinned [data-reading-row]) > [data-thread-wrap]"), 'old rule gone').toBe('')
    expect(rule('.ok-pinned:has([data-reading-row])'), 'old rule gone').toBe('')
    expect(rule(".ok-pinned [data-testid='view-proposal-row']")).toMatch(/padding-bottom: 12px/)
    expect(rule(".ok-pinned [data-testid='view-proposal-review'], .ok-pinned [data-review-body]:not([hidden])")).toMatch(/display: contents/)
  })

  // CATCH (fails on the old NextStepCard, which drew a "Next step" header, no review and no row, the proposal's own heading in the open, and
  // a pinned box with min-h-[112px]).
  it('C3-1 at rest the pinned box is one closed row: core\'s heading · on, no "Next step" header, the proposal\'s heading not drawn again, no min height', () => {
    const p = heldWords()
    const { getByTestId } = render(<ViewChat />)
    const box = getByTestId('view-chat-pinned')
    expect(box).toHaveClass('ok-pinned', 'shrink-0', 'overflow-y-auto')
    expect(box.className).not.toContain('min-h-[112px]')
    const step = getByTestId('view-next-step')
    expect([step.tagName, step.getAttribute('data-step'), step.getAttribute('aria-label')]).toEqual(['SECTION', 'approve', 'Next step'])
    expect(step.className).not.toContain('border-info')
    expect([...step.querySelectorAll('p')].map((e) => e.textContent), 'no Next step header').not.toContain('Next step')
    const review = getByTestId('view-proposal-review')
    expect(rowOf(review).getAttribute('aria-expanded')).toBe('false')
    expect(review).toHaveClass('ok-row-review')
    expect(isOpen(review), 'closed at rest').toBe(false)
    expect(step.firstElementChild, 'the review is the step\'s only child').toBe(review)
    const row = getByTestId('view-proposal-row')
    expect(row.tagName).toBe('BUTTON')
    expect(review.firstElementChild).toBe(row)
    expect(row.textContent).toBe(`${p.heading} · ${p.on}`)
    expect(row.querySelector('[data-view="proposal.heading"]')?.textContent).toBe(p.heading)
    expect(row.querySelector('[data-view="proposal.on"]')?.textContent).toBe(p.on)
    // said once: the only heading in the whole step is the row's own
    expect(step.querySelectorAll('[data-view="proposal.heading"]')).toHaveLength(1)
    expect(step.querySelectorAll('[data-view="proposal.on"]')).toHaveLength(1)
  })

  it('C3-2 opened, the row\'s body holds core\'s step words for approval and every change with Approve and Set aside; nothing is sent by opening', () => {
    const { getByTestId } = render(<ViewChat />)
    const review = getByTestId('view-proposal-review')
    const body = bodyOf(review) as HTMLElement
    expect(body.querySelector('p')?.textContent).toBe(NEXT_STEP_WORDS.approve)
    expect(body.contains(getByTestId('view-chat-proposal'))).toBe(true)
    expect(body.contains(getByTestId('view-approve'))).toBe(true)
    expect(body.querySelector('[data-testid="view-proposal-actions"]'), 'the actions are in the body').not.toBeNull()
    const proposalPart = getByTestId('view-chat-proposal')
    expect(proposalPart.querySelectorAll('[data-view="proposal.heading"]'), 'the proposal does not draw its heading again').toHaveLength(0)
    fireEvent.click(rowOf(review))
    expect(isOpen(review), 'pressing the row opens it').toBe(true)
    expect(posts, 'opening sends nothing').toEqual([])
  })

  // CATCH (fails on the old `key`-less layout: a proposal always drew open). A NEW proposal starts closed; the same proposal re-shown stays as the person left it.
  it('C3-3 a new proposal starts closed; the same proposal shown again keeps what the person opened', () => {
    const { getByTestId } = render(<ViewChat />)
    const first = getByTestId('view-proposal-review')
    setOpen(first, true)
    act(() => show({ ...proposal, chat: [...proposal.chat] }))
    expect(first.isConnected, 'same proposal, same row').toBe(true)
    expect(isOpen(getByTestId('view-proposal-review'))).toBe(true)
    act(() => show({ ...proposal, proposal: { ...proposal.proposal!, id: proposal.proposal!.id + 1 } }))
    const next = getByTestId('view-proposal-review')
    expect(next).not.toBe(first)
    expect(isOpen(next), 'a new proposal is closed').toBe(false)
    expect(rowOf(next).textContent).toBe(`${proposal.proposal!.heading} · ${proposal.proposal!.on}`)
  })
})

// PL-1083 (1) under Contract 3: the reading rows are placed above the actions only while the review is OPEN. The layout is stubbed as in
// readingsPlace.spec.tsx (the 12:15Z measurement of 452caf7a's held cut13 proposal: the box 350 px at its cap, the actions 116 px, two
// reading rows 143 and 121 px at 300 and 451 down the box's scroll), so the opened row's numbers are that spec's: the box grown to 406px, scrolled to 292.
describe('Contract 3: the readings rest moves nothing while the review is closed, and places the rows when the person opens it', () => {
  type Mark = NonNullable<View['proposal']>['marks'][number]
  const held = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-452caf7a-cut13-held-marks.json'), 'utf8')) as Mark[]
  const BOX_TOP = 248, CAP = 350, SCROLL_H = 1043, FOOT = 116, ROWS: Record<string, [number, number]> = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 121] }
  const boxOf = () => document.querySelector<HTMLElement>('[data-testid="view-chat-pinned"]')!
  const boxH = (b: HTMLElement) => (b.style.maxHeight === '' ? CAP : Math.min(parseFloat(b.style.maxHeight), 620))
  const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
  const real = { rect: HTMLElement.prototype.getBoundingClientRect, ch: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'), sh: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'), ro: globalThis.ResizeObserver }
  let observers: Array<{ fire: () => void; seen: Element[] }> = []
  beforeEach(() => {
    observers = []
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const id = this.getAttribute('data-testid') ?? ''
      if (id === 'view-chat-pinned') return rect(BOX_TOP, boxH(this))
      if (id === 'view-proposal-actions') return rect(0, FOOT)
      if (ROWS[id] !== undefined) return rect(BOX_TOP + ROWS[id]![0] - boxOf().scrollTop, ROWS[id]![1])
      return rect(0, 0)
    }
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-pinned' ? boxH(this) - 2 : 0 } })
    Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-pinned' ? SCROLL_H : 0 } })
    globalThis.ResizeObserver = class { private o: { fire: () => void; seen: Element[] }; constructor(cb: ResizeObserverCallback) { this.o = { fire: () => cb([], this as unknown as ResizeObserver), seen: [] }; observers.push(this.o) } observe(e: Element) { this.o.seen.push(e) } unobserve() {} disconnect() { this.o.seen = [] } } as unknown as typeof ResizeObserver
    show({ ...proposal, you: 'Paul', proposal: { ...proposal.proposal!, marks: held } } as View)
  })
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = real.rect
    if (real.ch) Object.defineProperty(Element.prototype, 'clientHeight', real.ch)
    if (real.sh) Object.defineProperty(Element.prototype, 'scrollHeight', real.sh)
    globalThis.ResizeObserver = real.ro
  })
  const placer = () => observers.find((o) => o.seen.includes(boxOf()))!
  const wholeRow = (id: string) => { const b = boxOf(), foot = BOX_TOP + boxH(b) - FOOT, [y, h] = ROWS[id]!; return BOX_TOP + y - b.scrollTop >= BOX_TOP && BOX_TOP + y + h - b.scrollTop <= foot }

  // CATCH (fails on the old land(), which placed on arrival whether or not the rows were on screen: maxHeight '406px' and scrollTop 292 at mount).
  it('R1 closed at rest: the box keeps its own height and scroll, on arrival and when its parts change size', () => {
    const { getByTestId } = render(<ViewChat />)
    const review = getByTestId('view-proposal-review')
    expect(isOpen(review)).toBe(false)
    expect(review.querySelectorAll('[data-reading-row]').length, 'precondition: the held rows are in the proposal').toBe(2)
    const b = boxOf()
    expect([b.style.maxHeight, b.scrollTop], 'on arrival').toEqual(['', 0])
    expect(placer(), 'the box is still watched, so opening places the rows').toBeDefined()
    placer().fire()
    expect([b.style.maxHeight, b.scrollTop], 'a resize while closed').toEqual(['', 0])
  })

  // The old row's meaning, kept: with the review OPEN the box grows by what the rows lack and is scrolled so both rows rest whole above the actions.
  it('R2 opened, the box places the rows as PL-1083 (1) says (grown to 406px, scrolled to 292, both rows whole above the actions); closed again, the box lets go of its height', () => {
    const { getByTestId } = render(<ViewChat />)
    const review = getByTestId('view-proposal-review')
    const b = boxOf()
    setOpen(review, true)
    placer().fire() // the opened body changes the box's size; the browser's observer reports it
    expect(b.style.maxHeight).toBe('406px')
    expect(b.scrollTop).toBe(292)
    expect(Object.keys(ROWS).every(wholeRow)).toBe(true)
    setOpen(review, false)
    placer().fire()
    expect(b.style.maxHeight, 'closed again: the box keeps its own height').toBe('')
  })
})

describe('Contract 3: a card with no result shows core\'s own reason, never "No chance yet" (leadLineOf / withheldWords; the pill itself is bound in coreFarChance.spec and olumiLook.spec)', () => {
  const card = (file: string, id: string) => (JSON.parse(readFileSync(path.resolve(file), 'utf8')) as View).model!.cards.find((c) => c.id === id)!
  // The mock keeps CoreCard's import chain off the real supabase client, as coreFarChance.spec does.
  afterEach(() => { vi.doUnmock('../../lib/supabase') })
  const load = async () => { vi.doMock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} })); return import('../previous/CoreCard') }

  // CATCH (fails on the old leadLineOf, which returned card.headline.text for every option card: "No chance yet" / "...: no chance yet").
  it('P1 core\'s why where it sends one; else its title; else the bare text; the empty string is not a reason; null for a chance', async () => {
    const { leadLineOf, withheldWords } = await load()
    const withWhy = card('src/olumiView/fixtures/ed12/app-launch.view3.json', 'option_scheduled')
    const withTitle = card('src/olumiView/golden/app-launch.view.json', 'option_scheduled')
    const hw = withWhy.headline!, ht = withTitle.headline!
    expect([hw.state, ht.state], 'preconditions: both withheld').toEqual(['none', 'none'])
    expect([hw.why, hw.text === hw.why], 'precondition: core sends a reason apart from the bare words').toEqual([expect.stringContaining('cannot be worked out yet'), false])
    expect([ht.why ?? null, ht.title === ht.text], 'precondition: core sends a title and no why').toEqual([null, false])
    expect(withheldWords(hw)).toBe(hw.why)
    expect(leadLineOf(withWhy)).toBe(hw.why)
    expect(withheldWords(ht)).toBe(ht.title)
    expect(leadLineOf(withTitle)).toBe(ht.title)
    // why wins over title where both differ (derived from the two real headlines)
    expect(withheldWords({ ...hw, title: ht.title } as typeof hw)).toBe(hw.why)
    expect(withheldWords({ ...hw, why: '' } as typeof hw)).toBe(hw.title)
    expect(withheldWords({ ...ht, title: '' } as typeof ht)).toBe(ht.text)
    expect(leadLineOf({ ...withTitle, headline: { ...ht, title: '' } as typeof ht })).toBe(ht.text)
    // CONTRAST: a chance is not a withheld card
    expect(withheldWords({ ...hw, state: 'chance' } as unknown as typeof hw)).toBeNull()
  })
})
