/**
 * P1 fold (external review 2026-07-14): the debug-panel visibility gate lives in
 * this tiny EAGER module so ReactFlowGraph can gate the LazyDebugPanel MOUNT and
 * the ~250 KB chunk downloads only when ?diag is present. These tests pin the
 * gate that controls the mount (a false result means React.lazy never fetches
 * the chunk).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { shouldShowDebugPanel, useShouldShowDebugPanel } from '../debugPanelVisibility'

describe('shouldShowDebugPanel', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_ENV', 'development')
    window.history.replaceState({}, '', '/canvas')
    delete (window as { __OLUMI_DEBUG?: boolean }).__OLUMI_DEBUG
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { __OLUMI_DEBUG?: boolean }).__OLUMI_DEBUG
  })

  it('is FALSE for a normal visitor (allowed env, no ?diag, no flag) — the chunk stays unfetched', () => {
    expect(shouldShowDebugPanel()).toBe(false)
  })

  it('is true with ?diag in the search string', () => {
    window.history.replaceState({}, '', '/canvas?diag')
    expect(shouldShowDebugPanel()).toBe(true)
  })

  it('is true with ?diag in a HashRouter hash', () => {
    window.history.replaceState({}, '', '/#/canvas?diag=1')
    expect(shouldShowDebugPanel()).toBe(true)
  })

  it('is true with the window.__OLUMI_DEBUG console flag', () => {
    ;(window as { __OLUMI_DEBUG?: boolean }).__OLUMI_DEBUG = true
    expect(shouldShowDebugPanel()).toBe(true)
  })

  it('is FALSE in a disallowed env even with ?diag', () => {
    vi.stubEnv('VITE_APP_ENV', 'production')
    window.history.replaceState({}, '', '/canvas?diag')
    expect(shouldShowDebugPanel()).toBe(false)
  })
})

describe('useShouldShowDebugPanel', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_ENV', 'development')
    window.history.replaceState({}, '', '/canvas')
    delete (window as { __OLUMI_DEBUG?: boolean }).__OLUMI_DEBUG
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('starts false without ?diag and flips true on a popstate navigation to ?diag', () => {
    const { result } = renderHook(() => useShouldShowDebugPanel())
    expect(result.current).toBe(false)

    act(() => {
      window.history.replaceState({}, '', '/canvas?diag')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current).toBe(true)
  })
})
