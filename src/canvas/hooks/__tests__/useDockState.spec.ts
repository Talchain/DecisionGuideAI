import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDockState } from '../useDockState'

interface DockState {
  isOpen: boolean
  activeTab: string
}

describe('useDockState', () => {
  const STORAGE_KEY = 'test.dockState.v1'
  const defaultValue: DockState = { isOpen: true, activeTab: 'documents' }

  beforeEach(() => {
    try {
      sessionStorage.clear()
    } catch {
      // ignore
    }
  })

  it('persists state to sessionStorage and rehydrates on new mount', () => {
    const { result, unmount } = renderHook(() => useDockState<DockState>(STORAGE_KEY, defaultValue))

    act(() => {
      const [, setState] = result.current
      setState(prev => ({ ...prev, isOpen: false, activeTab: 'limits' }))
    })

    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw as string)
    expect(stored).toMatchObject({ isOpen: false, activeTab: 'limits' })

    unmount()

    const { result: result2 } = renderHook(() => useDockState<DockState>(STORAGE_KEY, defaultValue))
    const [rehydrated] = result2.current
    expect(rehydrated).toEqual({ isOpen: false, activeTab: 'limits' })
  })

  it('merges partial stored object with default value', () => {
    // Stored value only overrides isOpen; activeTab should come from default
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: false }))

    const { result } = renderHook(() => useDockState<DockState>(STORAGE_KEY, defaultValue))
    const [state] = result.current

    expect(state.isOpen).toBe(false)
    expect(state.activeTab).toBe('documents')
  })

  it('falls back to default when sessionStorage getItem throws', () => {
    const spy = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => useDockState<DockState>(STORAGE_KEY, defaultValue))
    const [state] = result.current

    expect(state).toEqual(defaultValue)

    spy.mockRestore()
  })
})
