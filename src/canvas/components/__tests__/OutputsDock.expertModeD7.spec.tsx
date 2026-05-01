/**
 * OutputsDock — Brief 5.8B D7 expert-mode persistence.
 *
 * The header toggle (`</>` button) reads the persisted value from
 * `localStorage.olumi.expertMode` on first render via a lazy initialiser
 * so the toggle never flickers false → true after an effect-based
 * hydration. Subsequent flips persist back through useEffect.
 *
 * Lazy initialiser source: OutputsDock.tsx — `useState(() => …)` reading
 * `window.localStorage.getItem('olumi.expertMode') === 'true'`.
 *
 * The spec exercises the persistence contract without rendering the full
 * OutputsDock (which has heavy canvas-store dependencies). It tests the
 * lazy initialiser + persistence effect in isolation as the
 * `useExpertMode` pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useState } from 'react'

const KEY = 'olumi.expertMode'

function useExpertMode() {
  const [expertMode, setExpertMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(KEY) === 'true'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(KEY, String(expertMode))
    } catch {
      /* swallow */
    }
  }, [expertMode])
  return [expertMode, setExpertMode] as const
}

describe('OutputsDock expertMode — Brief 5.8B D7', () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEY)
  })

  it('defaults to false when localStorage is empty', () => {
    const { result } = renderHook(() => useExpertMode())
    expect(result.current[0]).toBe(false)
  })

  it('hydrates to true when localStorage holds "true" (lazy initialiser, no false→true flicker)', () => {
    window.localStorage.setItem(KEY, 'true')
    const { result } = renderHook(() => useExpertMode())
    // First render reads localStorage directly — no useEffect race.
    expect(result.current[0]).toBe(true)
  })

  it('persists the new value to localStorage when toggled on', () => {
    const { result } = renderHook(() => useExpertMode())
    expect(window.localStorage.getItem(KEY)).toBe('false')
    act(() => {
      result.current[1](true)
    })
    expect(result.current[0]).toBe(true)
    expect(window.localStorage.getItem(KEY)).toBe('true')
  })

  it('persists the new value to localStorage when toggled off', () => {
    window.localStorage.setItem(KEY, 'true')
    const { result } = renderHook(() => useExpertMode())
    act(() => {
      result.current[1](false)
    })
    expect(result.current[0]).toBe(false)
    expect(window.localStorage.getItem(KEY)).toBe('false')
  })

  it('round-trips multiple flips without losing intermediate state', () => {
    const { result } = renderHook(() => useExpertMode())
    act(() => {
      result.current[1](true)
    })
    act(() => {
      result.current[1](false)
    })
    act(() => {
      result.current[1](true)
    })
    expect(result.current[0]).toBe(true)
    expect(window.localStorage.getItem(KEY)).toBe('true')
  })
})
