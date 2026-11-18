/**
 * DL journey (4), 14 Nov: after a figure is saved, the panel says which figure changed and whose, and which chances moved, in core's words
 * (the View's `model.run.since`, core's comparison of the new version with the one before), under the saved receipt, without opening a tab.
 * Real View: run 2's approved board (core f6447f70, s_e399f8a9d922), whose version 2 was Paul's figure edit. Bound by id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useModelNotice } from '../notice'
import { ViewChat } from '../ViewChat'
import { useUIStore } from '../../stores/uiStore'

const RUN2 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json'), 'utf8')) as View
const since = RUN2.model!.run!.since!
const show = (n: number) => {
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: RUN2, status: 'ready', error: null, stale: false } as never)
  useModelNotice.setState({ notice: { kind: 'saved', n, by: null, sid: RUN2.id } })
  return render(<ViewChat />).container
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); useModelNotice.setState({ notice: null }); useViewStore.setState({ view: null, status: 'none' } as never) })

describe('a saved figure says what it changed (journey 4)', () => {
  it('S1 under "Version 2 saved.": core\'s since lines, each chance that moved word for word, and the changed figure with whose it is', () => {
    expect([since.to.n, since.lines.length > 0, since.changed.length > 0], 'precondition').toEqual([2, true, true])
    const el = show(2)
    const block = el.querySelector('[data-testid="view-model-notice-block"]')!
    expect(block.querySelector('[data-testid="view-model-notice"]')?.textContent).toBe('Version 2 saved.')
    since.lines.forEach((l, i) => expect(block.querySelector(`[data-view="run.since.lines.${i}.line"]`)?.textContent).toBe(l.line))

    if (since.sole === null) since.changed.forEach((c) => expect(block.querySelector(`[data-since-changed="${c.id}"]`)?.getAttribute('data-since-whose')).toBe(c.whose ?? ''))
  })

  it('S1b the chance that moved is read first: as served after the j4 edit (v3), core lists an unchanged reading before the one that moved', () => {
    const [a, b] = since.lines
    const v3 = { ...RUN2, model: { ...RUN2.model!, run: { ...RUN2.model!.run!, since: { ...since, lines: [{ ...a!, from_text: 'never met in this model', to_text: 'never met in this model' }, b!] } } } } as View
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: v3, status: 'ready', error: null, stale: false } as never)
    useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: null, sid: RUN2.id } })
    const drawn = [...render(<ViewChat />).container.querySelectorAll('[data-testid="view-model-notice-block"] [data-view^="run.since.lines."]')].map((n) => n.getAttribute('data-view'))
    expect(drawn).toEqual(['run.since.lines.1.line', 'run.since.lines.0.line'])
    // in the meta size at the thread's foot (the Compare tab keeps the reading size)
    expect(document.querySelector('[data-testid="view-model-notice-block"] [data-since-line]')!.className).toContain('text-[12px]')
  })

  it('S2 CONTRAST: a receipt for another version draws no comparison (core\'s since is of version 2 only)', () => {
    const el = show(3)
    expect(el.querySelector('[data-testid="view-model-notice"]')?.textContent).toBe('Version 3 saved.')
    expect(el.querySelector('[data-testid="core-compare-since"]')).toBeNull()
  })

  it('S3 the receipt and its comparison follow the thread\'s newest line and are brought into view when they land: whole, or from their top when taller than the thread', () => {
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 900 : 600 })
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 400 : 0 })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: RUN2, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    act(() => { useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: null, sid: RUN2.id } }) })
    const block = el.querySelector('[data-testid="view-model-notice-block"]')!, turns = el.querySelector('[data-testid="view-chat-turns"]')!
    expect(turns.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING, 'after the thread').toBeTruthy()
    expect(scroll.scrollTop).toBe(884) // taller than the thread (400 > 300): its top, 16 px under the thread's top (900 - 16)
    top.mockRestore(); tall.mockRestore()
  })

  it('S3b the receipt never slices the newest reply: where it would land inside the reply, the reply opens on its first line (audit chat-1)', () => {
    const reply = (n: HTMLElement) => ['view-chat-answer', 'view-chat-latest', 'view-chat-early'].includes(n.dataset.testid ?? '') || n.hasAttribute('data-latest-floor')
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 1000 : 600 })
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 200 : reply(this) ? 500 : 0 })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: RUN2, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    act(() => { useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: null, sid: RUN2.id } }) })
    expect(scroll.scrollTop).toBe(584) // the reply's first line, 16 px under the top (600 - 16), not 916 (inside the reply: a sliced headline)
    top.mockRestore(); tall.mockRestore()
  })

  it('S4 with a Next step card below it (core asks to bring in a colleague after the save), the receipt still comes into view, not the step', () => {
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 700 : this.dataset.testid === 'view-next-step' ? 1300 : 600 })
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 200 : this.dataset.testid === 'view-next-step' ? 150 : 0 })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    // As served after the edit (j4 drive): the edit's own turn, its reply not given on the zero-call server, and core's invite step.
    // V12 (actions.ts teamActivity): the invite step is offered once a team activity has begun alone (a private view of their own), so the
    // fixture has begun one.
    const edited = { ...RUN2, collab: { ...RUN2.collab, alone: true, mine: [{ id: 1, figures: [], can_share: true, earlier: false }] }, chat: [...RUN2.chat, { ...RUN2.chat.at(-1)!, id: RUN2.chat.at(-1)!.id + 1, answer: null }] } as unknown as View
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: edited, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    expect(el.querySelector('[data-testid="view-next-step"]'), 'precondition: a Next step card below').not.toBeNull()
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    act(() => { useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: null, sid: RUN2.id } }) })
    expect(scroll.scrollTop).toBe(616) // the receipt whole: its foot 16 px above the thread's foot (700 + 200 + 16 - 300), not the step (1300)
    top.mockRestore(); tall.mockRestore()
  })

  it('S5 CATCH (contract 3, Codex 15 Nov round 2): someone who scrolled on near the foot, then saves, still gets the receipt in view', () => {
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 700 : this.dataset.testid === 'view-next-step' ? 1300 : 600 })
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 200 : this.dataset.testid === 'view-next-step' ? 150 : 0 })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    const edited = { ...RUN2, collab: { ...RUN2.collab, alone: true }, chat: [...RUN2.chat, { ...RUN2.chat.at(-1)!, id: RUN2.chat.at(-1)!.id + 1, answer: null }] } as View
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: edited, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    // They scroll on to 1650 themselves: 50 px from the foot, so the thread still follows (within 80 px), and 1650 is where they put it.
    scroll.scrollTop = 1650; fireEvent.scroll(scroll)
    act(() => { useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: null, sid: RUN2.id } }) })
    expect(scroll.scrollTop).toBe(616) // the receipt whole; held at where they scrolled: 1650, the receipt (700..900) out of view above
    top.mockRestore(); tall.mockRestore()
  })

  // Codex 15 Nov round 3: the reader near the foot (1650), the receipt at 700..900, a Next step at 1300.
  const nearFoot = (view: View) => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 700 : this.dataset.testid === 'view-next-step' ? 1300 : 600 })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 200 : this.dataset.testid === 'view-next-step' ? 150 : 0 })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    scroll.scrollTop = 1650; fireEvent.scroll(scroll)
    return scroll
  }
  const edited = () => ({ ...RUN2, collab: { ...RUN2.collab, alone: true }, chat: [...RUN2.chat, { ...RUN2.chat.at(-1)!, id: RUN2.chat.at(-1)!.id + 1, answer: null }] }) as View
  const saveOf = (n: number) => act(() => { useModelNotice.setState({ notice: { kind: 'saved', n, by: null, sid: RUN2.id } }) })

  it('S6 CATCH (round 3): a save while a reply is still arriving does not pull them back to the reply; the receipt comes into view when the reply lands', () => {
    const view = edited(), job: NonNullable<View['turn']> = { job: 9001, status: 'answering', said: view.chat.at(-1)!.said, ask: 'message', by: 'Paul', by_id: '1', words: 'Olumi is answering.', started: '2026-11-15T10:00:00Z', at: '2026-11-15T10:00:00Z' }
    const scroll = nearFoot({ ...view, turn: job })
    expect(scroll.querySelector('[data-testid="view-chat-turn-job"]:not([data-shown])'), 'precondition: a reply arriving').not.toBeNull()
    saveOf(2)
    expect(scroll.scrollTop).toBe(1650) // not 584 (the arriving reply): where they scrolled stands
    act(() => { useViewStore.setState({ view } as never) }) // the reply lands
    expect(scroll.scrollTop).toBe(616) // the receipt whole, once it is drawn
  })
  it('S7 CATCH (round 3): a second save of the same version brings its receipt into view again', () => {
    const scroll = nearFoot(edited())
    saveOf(2)
    expect(scroll.scrollTop).toBe(616)
    scroll.scrollTop = 1650; fireEvent.scroll(scroll) // they scroll on again
    saveOf(2) // the same version number, a new save
    expect(scroll.scrollTop).toBe(616)
  })
  it('S8 CATCH (round 3): a notice going away never pulls them back', () => {
    const scroll = nearFoot(edited())
    saveOf(2)
    scroll.scrollTop = 1650; fireEvent.scroll(scroll)
    act(() => { useModelNotice.setState({ notice: null }) })
    expect(scroll.scrollTop).toBe(1650)
  })
})
