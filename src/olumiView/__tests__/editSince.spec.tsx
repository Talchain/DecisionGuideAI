/**
 * DL journey (4), 14 Nov: after a figure is saved, the panel says which figure changed and whose, and which chances moved, in core's words
 * (the View's `model.run.since`, core's comparison of the new version with the one before), under the saved receipt, without opening a tab.
 * Real View: run 2's approved board (core f6447f70, s_e399f8a9d922), whose version 2 was Paul's figure edit. Bound by id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
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
afterEach(() => { cleanup(); useModelNotice.setState({ notice: null }); useViewStore.setState({ view: null, status: 'none' } as never) })

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

  it('S4 with a Next step card below it (core asks to bring in a colleague after the save), the receipt still comes into view, not the step', () => {
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 700 : this.dataset.testid === 'view-next-step' ? 1300 : 600 })
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-model-notice-block' ? 200 : this.dataset.testid === 'view-next-step' ? 150 : 0 })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    // As served after the edit (j4 drive): the edit's own turn, its reply not given on the zero-call server, and core's invite step.
    const edited = { ...RUN2, collab: { ...RUN2.collab, alone: true }, chat: [...RUN2.chat, { ...RUN2.chat.at(-1)!, id: RUN2.chat.at(-1)!.id + 1, answer: null }] } as View
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN2.id, view: edited, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    expect(el.querySelector('[data-testid="view-next-step"]'), 'precondition: a Next step card below').not.toBeNull()
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    act(() => { useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: null, sid: RUN2.id } }) })
    expect(scroll.scrollTop).toBe(616) // the receipt whole: its foot 16 px above the thread's foot (700 + 200 + 16 - 300), not the step (1300)
    top.mockRestore(); tall.mockRestore()
  })
})
