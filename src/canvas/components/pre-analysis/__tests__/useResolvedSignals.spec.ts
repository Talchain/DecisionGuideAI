import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResolvedSignals } from '../useResolvedSignals'

describe('useResolvedSignals', () => {
  it('starts empty', () => {
    const liveIds = new Set<string>()
    const { result } = renderHook(() => useResolvedSignals(liveIds))
    expect(result.current.resolved.size).toBe(0)
    expect(result.current.isResolved('sig1')).toBe(false)
  })

  it('markResolved adds an entry and isResolved returns true', () => {
    const liveIds = new Set<string>(['sig1'])
    const { result } = renderHook(() => useResolvedSignals(liveIds))
    act(() => {
      result.current.markResolved({
        signalId: 'sig1',
        label: 'Factor A',
        kind: 'confirm',
        undoSnapshot: { before: 'ai' },
      })
    })
    expect(result.current.isResolved('sig1')).toBe(true)
    expect(result.current.resolved.get('sig1')?.label).toBe('Factor A')
  })

  it('undo returns the undoSnapshot and removes the entry', () => {
    const liveIds = new Set<string>(['sig1'])
    const { result } = renderHook(() => useResolvedSignals(liveIds))
    act(() => {
      result.current.markResolved({
        signalId: 'sig1',
        label: 'Factor A',
        kind: 'confirm',
        undoSnapshot: { previous: 'state' },
      })
    })
    let payload: unknown
    act(() => {
      payload = result.current.undo('sig1')
    })
    expect(payload).toEqual({ previous: 'state' })
    expect(result.current.isResolved('sig1')).toBe(false)
  })

  it('undo returns null when no entry exists', () => {
    const liveIds = new Set<string>()
    const { result } = renderHook(() => useResolvedSignals(liveIds))
    let payload: unknown = 'sentinel'
    act(() => {
      payload = result.current.undo('missing')
    })
    expect(payload).toBeNull()
  })

  it('markResolved is idempotent on signalId', () => {
    const liveIds = new Set<string>(['sig1'])
    const { result } = renderHook(() => useResolvedSignals(liveIds))
    act(() => {
      result.current.markResolved({
        signalId: 'sig1',
        label: 'Factor A',
        kind: 'confirm',
        undoSnapshot: { v: 1 },
      })
      result.current.markResolved({
        signalId: 'sig1',
        label: 'Factor A (updated)',
        kind: 'confirm',
        undoSnapshot: { v: 2 },
      })
    })
    // First write wins — prevents the second call from overwriting the
    // original undoSnapshot after a re-render cycle.
    expect(result.current.resolved.get('sig1')?.label).toBe('Factor A')
    expect(result.current.resolved.get('sig1')?.undoSnapshot).toEqual({ v: 1 })
  })

  it('reaper removes resolved entries whose live signal has disappeared after a render cycle', () => {
    let liveIds = new Set<string>(['sig1'])
    const { result, rerender } = renderHook(
      ({ ids }) => useResolvedSignals(ids),
      { initialProps: { ids: liveIds } },
    )
    act(() => {
      result.current.markResolved({
        signalId: 'sig1',
        label: 'Factor A',
        kind: 'confirm',
        undoSnapshot: null,
      })
    })
    expect(result.current.isResolved('sig1')).toBe(true)

    // Signal disappears from live list — simulates the underlying triage
    // item being removed after the confirm propagates through the store.
    liveIds = new Set<string>()
    rerender({ ids: liveIds })
    // Trigger one more render to cross the "next render after state settles"
    // threshold.
    rerender({ ids: liveIds })
    expect(result.current.isResolved('sig1')).toBe(false)
  })
})
