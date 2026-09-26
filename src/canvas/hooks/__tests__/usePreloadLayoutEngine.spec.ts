/**
 * The layout engine is fetched when the canvas MOUNTS, at idle, once
 * (#70 5841781894). A page opened before a deploy and drafted after it could
 * not lay out its first model: the lazy chunk had been retired (404).
 *
 * The served proof is the probe that blocks the ELK chunk AFTER idle: before
 * this change the first draft sat on the pre-layout pile, and after it the
 * engine is already in memory. This pins the scheduling contract the probe
 * relies on.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreloadLayoutEngine } from '../usePreloadLayoutEngine'
import { loadLayoutEngine } from '../../utils/layout'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('usePreloadLayoutEngine', () => {
  it('preloads ONCE after mount (idle), never during render', async () => {
    let idle: (() => void) | null = null
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { idle = cb; return 7 })
    vi.stubGlobal('cancelIdleCallback', vi.fn())
    const preload = vi.fn(async () => {})
    const { rerender } = renderHook(() => usePreloadLayoutEngine(preload))
    expect(preload).not.toHaveBeenCalled()
    idle!()
    idle!()
    rerender()
    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('an unmount before idle cancels it', () => {
    let idle: (() => void) | null = null
    const cancel = vi.fn()
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { idle = cb; return 9 })
    vi.stubGlobal('cancelIdleCallback', cancel)
    const preload = vi.fn(async () => {})
    const { unmount } = renderHook(() => usePreloadLayoutEngine(preload))
    unmount()
    expect(cancel).toHaveBeenCalledWith(9)
    idle!()
    expect(preload).not.toHaveBeenCalled()
  })

  it('without requestIdleCallback (Safari), it falls back to a macrotask', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const preload = vi.fn(async () => {})
    renderHook(() => usePreloadLayoutEngine(preload))
    expect(preload).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('a failed preload is swallowed — the layout call reports it, not the mount', async () => {
    let idle: (() => void) | null = null
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { idle = cb; return 1 })
    const preload = vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
    renderHook(() => usePreloadLayoutEngine(preload))
    expect(() => idle!()).not.toThrow()
    await Promise.resolve()
    expect(preload).toHaveBeenCalledTimes(1)
  })
})

describe('loadLayoutEngine', () => {
  it('fetches ELK once and returns the SAME module to every caller', async () => {
    const a = loadLayoutEngine()
    const b = loadLayoutEngine()
    expect(a).toBe(b)
    const m = await a
    expect(typeof m.default).toBe('function')
  })
})
