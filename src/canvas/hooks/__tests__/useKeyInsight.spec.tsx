/**
 * useKeyInsight Hook Unit Tests
 *
 * Audit F-38: httpV1Adapter.keyInsight() does not exist.
 * The hook now returns a stable disabled state (no API calls).
 * These tests verify the disabled behaviour.
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyInsight, clearInsightCache } from '../useKeyInsight'

describe('useKeyInsight (Audit F-38: disabled — endpoint not implemented)', () => {
  it('returns null insight regardless of responseHash', () => {
    const { result } = renderHook(() =>
      useKeyInsight({ responseHash: 'hash-123' })
    )

    expect(result.current.insight).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns null insight when responseHash is null', () => {
    const { result } = renderHook(() =>
      useKeyInsight({ responseHash: null })
    )

    expect(result.current.insight).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('refresh is a no-op', async () => {
    const { result } = renderHook(() =>
      useKeyInsight({ responseHash: 'hash-123' })
    )

    // Should not throw
    await result.current.refresh()
    expect(result.current.insight).toBeNull()
  })

  it('clearInsightCache does not throw', () => {
    expect(() => clearInsightCache()).not.toThrow()
  })
})
