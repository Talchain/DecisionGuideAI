/**
 * Tests for useAnalysisCompleteEvent — direct_analysis_run system event
 *
 * Verifies:
 * - Fires on transition from active run states (streaming → complete)
 * - Does NOT fire on hydration/restore (idle → complete)
 * - Does NOT fire on error/cancelled → complete
 * - No-op when flag is OFF
 * - Sends correct event payload
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalysisCompleteEvent } from '../useAnalysisCompleteEvent'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let flagValue = true
vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => flagValue,
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockSendSystemEvent = vi.fn().mockResolvedValue(undefined)

function setResultsStatus(status: string) {
  useCanvasStore.setState({
    results: { status } as any,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockSendSystemEvent.mockClear()
  flagValue = true
  setResultsStatus('idle')
})

afterEach(() => {
  vi.useRealTimers()
  setResultsStatus('idle')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnalysisCompleteEvent', () => {
  it('fires on streaming → complete transition', () => {
    setResultsStatus('streaming')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    // Advance past the 100ms debounce
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    expect(mockSendSystemEvent).toHaveBeenCalledWith({
      type: 'direct_analysis_run',
      payload: { trigger: 'play_button' },
    })
  })

  it('fires on preparing → complete transition', () => {
    setResultsStatus('preparing')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('fires on connecting → complete transition', () => {
    setResultsStatus('connecting')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire on idle → complete (hydration/restore)', () => {
    setResultsStatus('idle')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('does NOT fire on error → complete', () => {
    setResultsStatus('error')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('does NOT fire on cancelled → complete', () => {
    setResultsStatus('cancelled')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('is a no-op when flag is OFF', () => {
    flagValue = false
    setResultsStatus('streaming')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('does NOT fire on complete → complete (no-op)', () => {
    setResultsStatus('complete')

    renderHook(() => useAnalysisCompleteEvent(mockSendSystemEvent))

    // Trigger re-subscribe with same status
    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', data: 'updated' } as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })
})
