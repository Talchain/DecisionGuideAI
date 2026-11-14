/**
 * DL 1128 fault (3), 14 Nov: on the served pending first model (run 1, s_a30668165d74: a failed reply saved and its job, a proposal pinned),
 * the thread followed the job's Try again and scrolled his own message out of view above the pinned proposal. The job the saved row already
 * draws is not the newest message: the thread follows his message. Real View fixture; offsets as the browser lays them out are stubbed.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat, turnAlreadyShown } from '../ViewChat'
import { useUIStore } from '../../stores/uiStore'

const RUN1 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run1-pending.view.json'), 'utf8')) as View
afterEach(() => { cleanup(); vi.restoreAllMocks(); useViewStore.setState({ view: null, status: 'none' } as never) })

describe('the thread follows his message, not a job the saved row already draws (DL 1128 fault 3)', () => {
  it('F1 precondition: the served pending model holds a failed reply saved and its job; the thread starts at his message', () => {
    expect(turnAlreadyShown(RUN1), 'precondition').toBe(true)
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.testid === 'view-chat-turn-job' ? 900 : this.dataset.testid === 'view-chat-latest' ? 600 : 100 })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => 0)
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    const first = { ...RUN1, chat: RUN1.chat.slice(0, -1), turn: null } as View
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: RUN1.id, view: first, status: 'ready', error: null, stale: false } as never)
    const el = render(<ViewChat />).container
    const scroll = el.querySelector('[data-testid="view-chat-scroll"]') as HTMLElement
    Object.defineProperties(scroll, { scrollHeight: { value: 3000, configurable: true }, clientHeight: { value: 300, configurable: true } })
    act(() => { useViewStore.setState({ view: RUN1 } as never) })
    expect(el.querySelector('[data-testid="view-chat-turn-job"]')).toHaveAttribute('data-shown')
    expect(scroll.scrollTop).toBe(584) // his message (600 - 16), not the job's Try again (900 - 16)
  })
})
