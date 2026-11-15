/**
 * The canvas's own Fit button (W5 round 2, reviewer 14 Nov: "Fit should cancel a pending AI pan and pulse"). replyInView.spec.tsx drives the hooks with a
 * stand-in for what Fit does; this is the other half: the REAL canvas is mounted, the REAL "Fit to view" button is pressed, and what is asserted is what the
 * handler (ViewCanvas.tsx onFitView) does to the two refs the camera hooks read, and to the timers a new reply arms. The refs are read through a wrapper that
 * calls the real useReplyInView, so the canvas's own hook runs unchanged. jsdom measures no node, so the hooks never get as far as moving the camera here:
 * what they would move is replyInView.spec.tsx's to show; what is shown here is that Fit releases them.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { ViewCanvas } from '../ViewCanvas'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'

const refs = vi.hoisted(() => ({ moved: null as { current: number } | null, activity: null as { current: { at: number; active: boolean } } | null }))
vi.mock('../replyInView', async (orig) => {
  const real = await orig<typeof import('../replyInView')>()
  return { ...real, useReplyInView: (...a: Parameters<typeof real.useReplyInView>) => { refs.moved = a[0]; refs.activity = a[1]; return real.useReplyInView(...a) } }
})
// As in leftToolbar.spec: keep the mounted canvas; omit the dock and attention card, which need the whole app.
vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
const before: View = { ...golden, chat: golden.chat.slice(0, 1) } // turn 12 only: the reply already on screen
const after: View = golden // turn 14 arrives, naming cards that are on the board
const TICK = 250

type Spy = { mock: { calls: unknown[][]; results: Array<{ value: unknown }> }; mockRestore: () => void }
let setIntervalSpy: Spy, clearIntervalSpy: Spy
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'))
  setIntervalSpy = vi.spyOn(globalThis, 'setInterval'); clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
  refs.moved = null; refs.activity = null
  useViewStore.setState({ uuid: 'u', sid: before.id, view: before, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: before.you_id, name: before.you }, status: 'ready' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})
afterEach(() => {
  cleanup(); setIntervalSpy.mockRestore(); clearIntervalSpy.mockRestore(); vi.useRealTimers()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})

/** The 250 ms intervals the camera hooks arm, created after `from` calls of setInterval, and not yet cleared. */
const pendingSince = (from: number): unknown[] => setIntervalSpy.mock.calls.flatMap((c, i) => (i >= from && c[1] === TICK ? [setIntervalSpy.mock.results[i]!.value] : []))
  .filter((h) => !clearIntervalSpy.mock.calls.some((x) => x[0] === h))
const fitButton = () => screen.getByRole('button', { name: 'Fit to view' })
function mountThenReplyArrives() {
  render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)
  const from = setIntervalSpy.mock.calls.length // taken before the arrival: whatever the canvas armed on mounting is not the reply's
  act(() => { useViewStore.setState({ view: after }) })
  return from
}

describe('the canvas\'s own Fit button, pressed on the real canvas', () => {
  it('FH1 catch: it counts as the person\'s own move (movedAt rises by one) and stamps the activity as no drag, as the zoom buttons do', () => {
    render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)
    expect(refs.moved, 'the canvas mounted the reply hook with its refs').not.toBeNull()
    const moves = refs.moved!.current
    fireEvent.click(fitButton())
    expect(refs.moved!.current).toBe(moves + 1)
    expect(refs.activity!.current).toEqual({ at: Date.now(), active: false })
  })
  it('FH2 catch: a reply\'s settling timer, pending when Fit is pressed, is released on the next tick', () => {
    const from = mountThenReplyArrives()
    expect(pendingSince(from).length, 'precondition: the new reply armed a timer that is still pending').toBeGreaterThan(0)
    fireEvent.click(fitButton())
    act(() => { vi.advanceTimersByTime(TICK + 10) })
    expect(pendingSince(from), 'every timer the reply armed has been released').toEqual([])
  })
  it('FH2b control: with no Fit, the timers the reply armed are still pending a tick later (so FH2 releases something real)', () => {
    const from = mountThenReplyArrives()
    act(() => { vi.advanceTimersByTime(TICK + 10) })
    expect(pendingSince(from).length).toBeGreaterThan(0)
  })
})
