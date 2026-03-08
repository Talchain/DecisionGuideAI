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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useComposerState } from '../hooks/useComposerState'
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
