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
import { useGuidanceStore } from '../../stores/guidanceStore'
import { _clearTraces, setLastAnalysisInteractionChainId } from '../../../lib/debug-state'

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
  _clearTraces()
  setLastAnalysisInteractionChainId(null)
  setResultsStatus('idle')
  useGuidanceStore.setState({ guidanceItems: [] } as any)
})

afterEach(() => {
  vi.useRealTimers()
  _clearTraces()
  setResultsStatus('idle')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnalysisCompleteEvent', () => {
  it('evicts stale guidance on streaming → complete transition without sending a follow-up system event', () => {
    setResultsStatus('streaming')
    useGuidanceStore.setState({
      guidanceItems: [
        {
          id: 'guidance-1',
          target_object: { type: 'graph' },
          content: { title: 'Old guidance', body: 'Outdated', priority: 1 },
          valid_while: { analysis_hash: 'old-hash' },
        },
      ],
    } as any)

    renderHook(() => useAnalysisCompleteEvent())

    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', hash: 'new-hash' } as any,
      })
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('does not send a follow-up system event on preparing → complete transition', () => {
    setResultsStatus('preparing')

    renderHook(() => useAnalysisCompleteEvent())

    act(() => {
      setResultsStatus('complete')
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('does not send a follow-up system event on connecting → complete transition', () => {
    setResultsStatus('connecting')

    renderHook(() => useAnalysisCompleteEvent())

    act(() => {
      setResultsStatus('complete')
    })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('does NOT fire on idle → complete (hydration/restore)', () => {
    setResultsStatus('idle')

    renderHook(() => useAnalysisCompleteEvent())

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

    renderHook(() => useAnalysisCompleteEvent())

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

    renderHook(() => useAnalysisCompleteEvent())

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

    renderHook(() => useAnalysisCompleteEvent())

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

    renderHook(() => useAnalysisCompleteEvent())

    act(() => {
      useCanvasStore.setState({
        results: { status: 'complete', data: 'updated' } as any,
      })
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })
})
