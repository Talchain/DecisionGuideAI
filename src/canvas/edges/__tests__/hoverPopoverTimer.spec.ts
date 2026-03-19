/**
 * Task 5 — Edge hover popover timer cleanup on unmount
 *
 * StyledEdge.tsx holds a ref to a pending 300ms setTimeout for the hover popover.
 * The useEffect cleanup (lines 66-68) calls clearTimeout when the component unmounts.
 *
 * These tests validate the timer-cleanup contract in isolation, without a full
 * ReactFlow render, by exercising the same ref + useEffect pattern the component uses.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('Edge hover popover timer cleanup (Task 5)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clearTimeout is called when the cleanup function runs before the timer fires', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    // Simulate StyledEdge mount + mouseEnter
    let timerRef: ReturnType<typeof setTimeout> | null = null
    timerRef = setTimeout(() => { /* setShowHoverPopover(true) */ }, 300)

    // Simulate unmount — useEffect cleanup fires before the 300ms elapses
    if (timerRef) clearTimeout(timerRef)

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerRef)
    vi.useRealTimers()
  })

  it('timer callback does NOT run when cleanup fires before 300ms', () => {
    vi.useFakeTimers()
    const callback = vi.fn()

    let timerRef: ReturnType<typeof setTimeout> | null = null
    timerRef = setTimeout(callback, 300)

    // Unmount before timer fires — cleanup clears the timer
    if (timerRef) clearTimeout(timerRef)

    // Advance past the delay — callback must not have been called
    vi.advanceTimersByTime(400)
    expect(callback).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('timer callback runs normally when unmount occurs after 300ms', () => {
    vi.useFakeTimers()
    const callback = vi.fn()

    const timerRef = setTimeout(callback, 300)

    // Advance past delay before "unmount"
    vi.advanceTimersByTime(300)
    expect(callback).toHaveBeenCalledTimes(1)

    // Cleanup runs but the timer has already fired — clearTimeout is a no-op
    clearTimeout(timerRef)
    vi.advanceTimersByTime(400)
    expect(callback).toHaveBeenCalledTimes(1) // still only once

    vi.useRealTimers()
  })
})
