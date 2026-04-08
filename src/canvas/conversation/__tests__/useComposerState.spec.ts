/**
 * Tests for useComposerState.
 *
 * Verifies:
 * - Enter sends when content is present
 * - Enter does nothing when empty or disabled
 * - Shift+Enter does not send
 * - Escape calls onCollapse
 * - replaceText updates value
 * - canSend reflects value + disabled
 * - reset clears value
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useComposerState } from '../hooks/useComposerState'
import { useCanvasStore } from '../../store'
import type React from 'react'

function makeKeyEvent(key: string, overrides: Partial<React.KeyboardEvent<HTMLTextAreaElement>> = {}) {
  return {
    key,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>
}

function makeChangeEvent(value: string) {
  return { target: { value } } as React.ChangeEvent<HTMLTextAreaElement>
}

describe('useComposerState', () => {
  it('canSend is false when value is empty', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    expect(result.current.canSend).toBe(false)
  })

  it('canSend is true when value has content', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    act(() => { result.current.handleChange(makeChangeEvent('hello')) })
    expect(result.current.canSend).toBe(true)
  })

  it('canSend is false when disabled even with content', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn(), disabled: true }),
    )
    act(() => { result.current.handleChange(makeChangeEvent('hello')) })
    expect(result.current.canSend).toBe(false)
  })

  it('Enter sends trimmed text and resets value', () => {
    const onSend = vi.fn()
    const { result } = renderHook(() =>
      useComposerState({ onSend, onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('  hello world  ')) })
    const event = makeKeyEvent('Enter')
    act(() => { result.current.handleKeyDown(event) })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledWith('hello world')
    expect(result.current.value).toBe('')
  })

  it('Enter does nothing when value is empty', () => {
    const onSend = vi.fn()
    const { result } = renderHook(() =>
      useComposerState({ onSend, onCollapse: vi.fn() }),
    )

    const event = makeKeyEvent('Enter')
    act(() => { result.current.handleKeyDown(event) })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('Shift+Enter does not send', () => {
    const onSend = vi.fn()
    const { result } = renderHook(() =>
      useComposerState({ onSend, onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('hello')) })
    const event = makeKeyEvent('Enter', { shiftKey: true })
    act(() => { result.current.handleKeyDown(event) })

    expect(onSend).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('Escape calls onCollapse', () => {
    const onCollapse = vi.fn()
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse }),
    )

    const event = makeKeyEvent('Escape')
    act(() => { result.current.handleKeyDown(event) })
    expect(onCollapse).toHaveBeenCalledOnce()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('reset clears value', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('hello')) })
    expect(result.current.value).toBe('hello')

    act(() => { result.current.reset() })
    expect(result.current.value).toBe('')
  })

  it('replaceText sets value', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )

    act(() => { result.current.replaceText('scaffold text') })
    expect(result.current.value).toBe('scaffold text')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Draft persistence (Task 4)
// ─────────────────────────────────────────────────────────────────────────

describe('useComposerState — draft persistence to canvas store', () => {
  beforeEach(() => {
    // Reset persisted draft before each test so cases are independent.
    useCanvasStore.setState({ draftComposerText: null })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initialises empty when the store has no draft', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    expect(result.current.value).toBe('')
  })

  it('initialises from store on mount when a draft is persisted', () => {
    useCanvasStore.setState({ draftComposerText: 'previously typed text' })

    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    expect(result.current.value).toBe('previously typed text')
  })

  it('writes to the store after the debounce window', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('drafting…')) })

    // Before the debounce fires, the store has not been written to.
    expect(useCanvasStore.getState().draftComposerText).toBeNull()

    act(() => { vi.advanceTimersByTime(300) })
    expect(useCanvasStore.getState().draftComposerText).toBe('drafting…')
  })

  it('flushes pending value to the store on unmount (panel collapse case)', () => {
    const { result, unmount } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('mid-typed')) })
    // Unmount immediately — debounce hasn't fired yet.
    unmount()

    expect(useCanvasStore.getState().draftComposerText).toBe('mid-typed')
  })

  it('survives unmount/remount round-trip (the bug being fixed)', () => {
    const { result: r1, unmount } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    act(() => { r1.current.handleChange(makeChangeEvent('persistent text')) })
    unmount()

    const { result: r2 } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    expect(r2.current.value).toBe('persistent text')
  })

  it('clears the store synchronously on send so the next mount is empty', () => {
    useCanvasStore.setState({ draftComposerText: 'hello' })
    const onSend = vi.fn()
    const { result } = renderHook(() =>
      useComposerState({ onSend, onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('hello')) })
    act(() => { result.current.handleKeyDown(makeKeyEvent('Enter')) })

    expect(onSend).toHaveBeenCalledWith('hello')
    expect(useCanvasStore.getState().draftComposerText).toBeNull()
  })

  it('clears the store synchronously on reset()', () => {
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )

    act(() => { result.current.handleChange(makeChangeEvent('typing')) })
    act(() => { vi.advanceTimersByTime(300) })
    expect(useCanvasStore.getState().draftComposerText).toBe('typing')

    act(() => { result.current.reset() })
    expect(useCanvasStore.getState().draftComposerText).toBeNull()
  })

  it('persists replaceText through the same pipeline (Guide-dropdown case)', () => {
    const { result, unmount } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )

    act(() => { result.current.replaceText('from guide dropdown') })
    unmount()

    const { result: r2 } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    expect(r2.current.value).toBe('from guide dropdown')
  })

  it('clears local value (does not show the literal "null") when store entry is null', () => {
    useCanvasStore.setState({ draftComposerText: null })
    const { result } = renderHook(() =>
      useComposerState({ onSend: vi.fn(), onCollapse: vi.fn() }),
    )
    expect(result.current.value).toBe('')
    expect(result.current.value).not.toBe('null')
  })
})
