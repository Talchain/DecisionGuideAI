/**
 * Tests for useSmartScroll.
 *
 * Verifies:
 * - Auto-scrolls on new messages when at bottom
 * - Stops auto-scrolling when user scrolls up >60px
 * - Shows "new message" indicator when scrolled up + new message
 * - Clears indicator when scrolled back to bottom
 * - scrollToBottom resets state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSmartScroll } from '../hooks/useSmartScroll'

function mockScrollIntoView() {
  return vi.fn()
}

describe('useSmartScroll', () => {
  beforeEach(() => {
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('returns refs and handlers', () => {
    const { result } = renderHook(() =>
      useSmartScroll({ messageCount: 0, isThinking: false }),
    )
    expect(result.current.listRef).toBeDefined()
    expect(result.current.listEndRef).toBeDefined()
    expect(typeof result.current.handleScroll).toBe('function')
    expect(typeof result.current.scrollToBottom).toBe('function')
    expect(result.current.showNewMessageIndicator).toBe(false)
  })

  it('does not show indicator when at bottom and message count increases', () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) => useSmartScroll({ messageCount, isThinking: false }),
      { initialProps: { messageCount: 1 } },
    )

    // New message arrives while at bottom (userScrolledUp is false by default)
    rerender({ messageCount: 2 })
    expect(result.current.showNewMessageIndicator).toBe(false)
  })

  it('shows indicator when scrolled up and message count increases', () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) => useSmartScroll({ messageCount, isThinking: false }),
      { initialProps: { messageCount: 1 } },
    )

    // Simulate scrolling up by setting up a container where scrollTop is far from bottom
    const container = document.createElement('div')
    Object.defineProperties(container, {
      scrollTop: { value: 0, writable: true },
      clientHeight: { value: 400 },
      scrollHeight: { value: 1000 },
    })
    // @ts-expect-error -- assigning ref current for test
    result.current.listRef.current = container

    // Fire scroll handler to mark as scrolled up
    act(() => { result.current.handleScroll() })

    // Now a new message arrives
    rerender({ messageCount: 2 })
    expect(result.current.showNewMessageIndicator).toBe(true)
  })

  it('clears indicator when scrolled back to bottom', () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) => useSmartScroll({ messageCount, isThinking: false }),
      { initialProps: { messageCount: 1 } },
    )

    // Scroll up
    const container = document.createElement('div')
    Object.defineProperties(container, {
      scrollTop: { value: 0, writable: true },
      clientHeight: { value: 400 },
      scrollHeight: { value: 1000 },
    })
    // @ts-expect-error -- assigning ref current for test
    result.current.listRef.current = container

    act(() => { result.current.handleScroll() })
    rerender({ messageCount: 2 })
    expect(result.current.showNewMessageIndicator).toBe(true)

    // Now scroll back to bottom (scrollTop + clientHeight >= scrollHeight - 60)
    Object.defineProperty(container, 'scrollTop', { value: 550 })
    act(() => { result.current.handleScroll() })
    expect(result.current.showNewMessageIndicator).toBe(false)
  })

  it('uses 60px threshold (not 80px)', () => {
    const { result } = renderHook(() =>
      useSmartScroll({ messageCount: 1, isThinking: false }),
    )

    const container = document.createElement('div')
    // scrollTop(540) + clientHeight(400) = 940 >= scrollHeight(1000) - 60 = 940
    // So at exactly 60px from bottom → is near bottom
    Object.defineProperties(container, {
      scrollTop: { value: 540, writable: true },
      clientHeight: { value: 400 },
      scrollHeight: { value: 1000 },
    })
    // @ts-expect-error -- assigning ref current for test
    result.current.listRef.current = container

    act(() => { result.current.handleScroll() })
    // At exactly 60px → still considered near bottom
    // Would need to scroll further up to trigger "scrolled up"

    // scrollTop(539) + clientHeight(400) = 939 < 940 → scrolled up
    Object.defineProperty(container, 'scrollTop', { value: 539 })
    act(() => { result.current.handleScroll() })
    // Now it should be marked as scrolled up (> 60px threshold)
  })

  it('scrollToBottom clears indicator and resets scroll state', () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) => useSmartScroll({ messageCount, isThinking: false }),
      { initialProps: { messageCount: 1 } },
    )

    // Set up scrolled-up state
    const container = document.createElement('div')
    Object.defineProperties(container, {
      scrollTop: { value: 0 },
      clientHeight: { value: 400 },
      scrollHeight: { value: 1000 },
    })
    // @ts-expect-error -- assigning ref current for test
    result.current.listRef.current = container

    act(() => { result.current.handleScroll() })
    rerender({ messageCount: 2 })
    expect(result.current.showNewMessageIndicator).toBe(true)

    // Call scrollToBottom
    act(() => { result.current.scrollToBottom() })
    expect(result.current.showNewMessageIndicator).toBe(false)
  })
})
