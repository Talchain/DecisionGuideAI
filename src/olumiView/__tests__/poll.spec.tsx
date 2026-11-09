/**
 * The View read again while the page is seen (R1 blocker, 4 Nov: Ada never saw the evidence Bea attached after Ada's last read). Another
 * member's input reaches this page with no press and no reload; never two reads at once; paused while hidden; a newer read always wins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import golden from '../golden/european.view.json'
import type { View } from '../client'
import { useViewStore } from '../store'
import { POLL_MS, useViewPoll } from '../poll'
import { setTeamFetch } from '../../olumiCore/team/api'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const at = (n: number): View => ({ ...base, id: SID, evidence: Array.from({ length: n }, (_, i) => ({ ...(base.evidence[0] ?? { id: 0, at: '2026-11-04T09:00:00Z', by: 'Bea', by_id: 'p_2', text: '', source: null, link: null, concerns: [], stance: 'unclear', version: 1 }), id: 100 + i, text: `evidence ${i}` })) } as View)

let served: View, reads = 0, others = 0, hold: Promise<void> | null = null
let vis: DocumentVisibilityState = 'visible'
beforeEach(() => {
  vi.useFakeTimers()
  reads = 0; others = 0; hold = null; served = at(0); vis = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis })
  setTeamFetch((async (url: unknown) => { if (/\/view(\?|$)/.test(String(url))) reads += 1; else others += 1; if (hold) await hold; return new Response(JSON.stringify(served), { status: 200 }) }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: at(0), status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { vi.useRealTimers(); setTeamFetch(null) })
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

describe('another member\'s input reaches this page on its own', () => {
  it('evidence written after this page\'s last read is on it within one re-read, with no press', async () => {
    renderHook(() => useViewPoll(true))
    served = at(1) // Bea attaches evidence after Ada's last read
    await tick(POLL_MS + 10)
    expect(useViewStore.getState().view?.evidence.map((e) => e.text)).toEqual(['evidence 0'])
  })
  it('off the lane it reads nothing', async () => {
    renderHook(() => useViewPoll(false))
    await tick(POLL_MS * 3)
    expect(reads).toBe(0)
  })
  it('paused while the page is hidden; on coming back into view it reads at once', async () => {
    renderHook(() => useViewPoll(true))
    vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))
    await tick(POLL_MS * 3)
    expect(reads).toBe(0)
    vis = 'visible'; document.dispatchEvent(new Event('visibilitychange'))
    await tick(10)
    expect(reads).toBe(1)
  })
  it('X2 (DL 9 Nov): back to this window, it reads at once, not after the rest of the poll; another member\'s approval is on it', async () => {
    renderHook(() => useViewPoll(true))
    await tick(1000)
    expect(reads).toBe(0)
    served = { ...at(0), version: { ...(at(0).version ?? { n: 1 }), n: (at(0).version?.n ?? 1) + 1 } } as View // Bea approved
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await tick(10)
    expect(reads).toBe(1)
    expect(useViewStore.getState().view?.version?.n).toBe((at(0).version?.n ?? 1) + 1)
    // Contrast: the next poll is timed afresh from that read, not stacked on the old one, and never two at once.
    await tick(POLL_MS - 100)
    expect(reads).toBe(1)
    await tick(200)
    expect(reads).toBe(2)
  })
  it('a focus while hidden reads nothing (paused while hidden)', async () => {
    renderHook(() => useViewPoll(true))
    vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await tick(POLL_MS * 2)
    expect(reads).toBe(0)
  })
  it('hidden while a re-read is on its way: once it answers, no further re-read is timed until the page is seen again', async () => {
    renderHook(() => useViewPoll(true))
    let release!: () => void
    hold = new Promise((r) => { release = r })
    await tick(POLL_MS + 10)
    expect(reads).toBe(1)
    vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))
    hold = null; release()
    await tick(POLL_MS * 3)
    expect(reads).toBe(1)
  })
  it('never two reads at once: none starts while another is on its way, its own or a write\'s', async () => {
    renderHook(() => useViewPoll(true))
    let release!: () => void
    hold = new Promise((r) => { release = r })
    void useViewStore.getState().refresh() // a write's own read, slow to answer
    await tick(POLL_MS * 3)
    expect(reads).toBe(1)
    hold = null; release()
    await tick(POLL_MS + 10)
    expect(reads).toBe(2)
  })
  it('a newer read wins: a re-read answered after a write\'s read began is dropped', async () => {
    renderHook(() => useViewPoll(true))
    let release!: () => void
    hold = new Promise((r) => { release = r })
    served = at(1)
    await tick(POLL_MS + 10) // the re-read is on its way, holding the old answer
    expect(reads).toBe(1)
    hold = null; served = at(2)
    const own = useViewStore.getState().refresh() // the write's own read starts after it, and answers first
    await act(async () => { await own })
    expect(useViewStore.getState().view?.evidence).toHaveLength(2)
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(10) })
    expect(useViewStore.getState().view?.evidence).toHaveLength(2) // the older answer did not land over it
  })
  it('a re-read that finds nothing new keeps the View held, so nothing draws again', async () => {
    renderHook(() => useViewPoll(true))
    const held = useViewStore.getState().view
    await tick(POLL_MS + 10)
    expect(reads).toBe(1)
    expect(useViewStore.getState().view).toBe(held)
  })
  it('a Draw on its way (an earlier version) is never overtaken by a re-read', async () => {
    renderHook(() => useViewPoll(true))
    let release!: () => void
    hold = new Promise((r) => { release = r })
    served = { ...at(0), version: { ...base.version!, id: 1, n: 1, label: 'version 1' } }
    const drawn = useViewStore.getState().look(1)
    await tick(POLL_MS * 2)
    expect(reads).toBe(1)
    hold = null; release()
    await act(async () => { await drawn })
    expect(useViewStore.getState().at).toBe(1)
  })
})
