/**
 * useStreamConnection - Test suite
 *
 * Tests for:
 * - Start/stop/reset lifecycle
 * - Error handling and reconnection logic
 * - RAF buffering behavior
 * - Diagnostics tracking (TTFB, token count, resume count)
 * - Teardown and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStreamConnection } from '../useStreamConnection'
import type { StreamConfig } from '../useStreamConnection'
import * as sseClient from '../../lib/sseClient'
import * as session from '../../lib/session'
import * as telemetry from '../../lib/telemetry'
import * as history from '../../lib/history'
import * as runReport from '../../lib/runReport'

// Mock dependencies
vi.mock('../../lib/sseClient')
vi.mock('../../lib/session')
vi.mock('../../lib/telemetry')
vi.mock('../../lib/history')
vi.mock('../../lib/runReport')
vi.mock('../../lib/markdown', () => ({
  renderMarkdownSafe: vi.fn((text: string) => `<p>${text}</p>`),
}))

describe('useStreamConnection', () => {
  let mockStreamHandle: any

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock stream handle
    mockStreamHandle = {
      close: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
    }

    // Mock dependencies
    vi.mocked(session.getDefaults).mockReturnValue({
      sessionId: 'test-session',
      org: 'test-org',
    })
    vi.mocked(telemetry.track).mockImplementation(() => {})
    vi.mocked(history.record).mockImplementation(() => {})
    vi.mocked(runReport.fetchRunReport).mockResolvedValue({} as any)
    vi.mocked(sseClient.openStream).mockReturnValue(mockStreamHandle)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  const defaultConfig: StreamConfig = {
    historyEnabled: false,
    chipsEnabled: false,
    paramsEnabled: false,
    mdEnabled: false,
    bufferEnabled: false,
  }

  describe('Initial State', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      expect(result.current.state.status).toBe('idle')
      expect(result.current.state.output).toBe('')
      expect(result.current.state.started).toBe(false)
      expect(result.current.state.reconnecting).toBe(false)
      expect(result.current.state.resumedOnce).toBe(false)
    })

    it('should initialize with zero metrics', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      expect(result.current.state.metrics.cost).toBeUndefined()
      expect(result.current.state.metrics.tokenCount).toBe(0)
      expect(result.current.state.metrics.ttfbMs).toBeUndefined()
      expect(result.current.state.metrics.resumeCount).toBe(0)
      expect(result.current.state.metrics.lastSseId).toBeUndefined()
    })
  })

  describe('Start/Stop Lifecycle', () => {
    it('should start stream and update status', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      expect(result.current.state.status).toBe('streaming')
      expect(result.current.state.started).toBe(true)
      expect(sseClient.openStream).toHaveBeenCalledTimes(1)
      expect(telemetry.track).toHaveBeenCalledWith('edge.stream.start')
    })

    it('should not start if already started', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const callCountAfterFirst = vi.mocked(sseClient.openStream).mock.calls.length

      act(() => {
        result.current.actions.start()
      })

      expect(vi.mocked(sseClient.openStream).mock.calls.length).toBe(callCountAfterFirst)
    })

    it('should stop stream and update status', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      act(() => {
        result.current.actions.stop()
      })

      expect(result.current.state.status).toBe('cancelled')
      expect(result.current.state.started).toBe(false)
      expect(mockStreamHandle.cancel).toHaveBeenCalledTimes(1)
    })

    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      // Start and get some output
      act(() => {
        result.current.actions.start()
      })

      // Simulate receiving tokens
      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]
      act(() => {
        openStreamCall.onToken?.('test ')
        openStreamCall.onToken?.('output')
      })

      // Reset
      act(() => {
        result.current.actions.reset()
      })

      expect(result.current.state.status).toBe('idle')
      expect(result.current.state.output).toBe('')
      expect(result.current.state.started).toBe(false)
      expect(result.current.state.metrics.tokenCount).toBe(0)
    })
  })

  describe('Event Handlers', () => {
    it('should handle onToken events without buffering', () => {
      const config: StreamConfig = {
        ...defaultConfig,
        bufferEnabled: false,
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onToken?.('Hello ')
        openStreamCall.onToken?.('World')
      })

      expect(result.current.state.output).toBe('Hello World')
      expect(result.current.state.metrics.tokenCount).toBe(2)
    })

    it('should buffer tokens with RAF when enabled', async () => {
      const config: StreamConfig = {
        ...defaultConfig,
        bufferEnabled: true,
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onToken?.('Buffered ')
        openStreamCall.onToken?.('tokens')
      })

      // Output should be empty before flush
      expect(result.current.state.output).toBe('')

      // Advance timers to trigger RAF flush
      await act(async () => {
        vi.runAllTimers()
        await vi.runAllTicks()
      })

      // Output should be flushed now
      expect(result.current.state.output).toBe('Buffered tokens')
    })

    it('should handle onDone event', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onDone?.()
      })

      expect(result.current.state.status).toBe('done')
      expect(result.current.state.started).toBe(false)
      expect(telemetry.track).toHaveBeenCalledWith('edge.stream.done')
    })

    it('should handle onCancelled event', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onCancelled?.()
      })

      expect(result.current.state.status).toBe('cancelled')
      expect(result.current.state.started).toBe(false)
      expect(telemetry.track).toHaveBeenCalledWith('edge.stream.cancelled')
    })

    it('should handle onError with retry', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onError?.({ willRetry: true })
      })

      expect(result.current.state.reconnecting).toBe(true)
      expect(result.current.state.status).toBe('streaming')
    })

    it('should handle terminal onError', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onError?.({ willRetry: false })
      })

      expect(result.current.state.status).toBe('error')
      expect(result.current.state.started).toBe(false)
      expect(result.current.state.reconnecting).toBe(false)
      expect(telemetry.track).toHaveBeenCalledWith('edge.stream.error')
    })

    it('should handle onAborted event', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onAborted?.()
      })

      expect(result.current.state.status).toBe('aborted')
      expect(result.current.state.started).toBe(false)
    })

    it('should handle onLimit event', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onLimit?.()
      })

      expect(result.current.state.status).toBe('limited')
      expect(result.current.state.started).toBe(false)
      expect(telemetry.track).toHaveBeenCalledWith('edge.stream.limited')
    })

    it('should handle onHello to clear reconnecting state', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      // Simulate reconnecting state
      act(() => {
        openStreamCall.onError?.({ willRetry: true })
      })

      expect(result.current.state.reconnecting).toBe(true)

      act(() => {
        openStreamCall.onHello?.()
      })

      expect(result.current.state.reconnecting).toBe(false)
    })

    it('should handle onResume and track resume count', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onResume?.()
      })

      expect(result.current.state.resumedOnce).toBe(true)
      expect(result.current.state.metrics.resumeCount).toBe(1)
      expect(result.current.state.reconnecting).toBe(false)

      act(() => {
        openStreamCall.onResume?.()
      })

      expect(result.current.state.metrics.resumeCount).toBe(2)
    })

    it('should handle onCost to update metrics', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onCost?.(5.25)
      })

      expect(result.current.state.metrics.cost).toBe(5.25)
    })

    it('should handle onSseId to track last SSE ID', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onSseId?.('sse-12345')
      })

      expect(result.current.state.metrics.lastSseId).toBe('sse-12345')
    })
  })

  describe('Diagnostics', () => {
    it('should track TTFB on first token', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      // Advance time before first token
      vi.advanceTimersByTime(100)

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onToken?.('first')
      })

      expect(result.current.state.metrics.ttfbMs).toBeGreaterThanOrEqual(100)
    })

    it('should not update TTFB on subsequent tokens', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      vi.advanceTimersByTime(100)

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onToken?.('first')
      })

      const firstTtfb = result.current.state.metrics.ttfbMs

      vi.advanceTimersByTime(200)

      act(() => {
        openStreamCall.onToken?.('second')
      })

      expect(result.current.state.metrics.ttfbMs).toBe(firstTtfb)
    })
  })

  describe('History Integration', () => {
    it('should record history when enabled on done', () => {
      const config: StreamConfig = {
        ...defaultConfig,
        historyEnabled: true,
        paramsEnabled: true,
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start({ seed: '42', budget: 100, model: 'gpt-4' })
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onDone?.()
      })

      expect(history.record).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'done',
          seed: '42',
          budget: 100,
          model: 'gpt-4',
        })
      )
    })

    it('should not record history when disabled', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onDone?.()
      })

      expect(history.record).not.toHaveBeenCalled()
    })
  })

  describe('Cleanup', () => {
    it('should close stream handle on unmount', () => {
      const { result, unmount } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      unmount()

      expect(mockStreamHandle.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('Parameters', () => {
    it('should pass parameters to openStream', () => {
      const config: StreamConfig = {
        ...defaultConfig,
        paramsEnabled: true,
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start({ seed: '123', budget: 50, model: 'claude-3' })
      })

      expect(sseClient.openStream).toHaveBeenCalledWith(
        expect.objectContaining({
          seed: '123',
          budget: 50,
          model: 'claude-3',
        })
      )
    })
  })

  describe('Markdown Rendering', () => {
    it('should call onMdUpdate when mdEnabled', async () => {
      const onMdUpdate = vi.fn()
      const config: StreamConfig = {
        ...defaultConfig,
        mdEnabled: true,
        onMdUpdate,
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onToken?.('# Hello')
      })

      expect(onMdUpdate).toHaveBeenCalled()
    })

    it('should not call onMdUpdate when mdEnabled is false', async () => {
      const onMdUpdate = vi.fn()
      const config: StreamConfig = {
        ...defaultConfig,
        mdEnabled: false,
        onMdUpdate,
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start()
      })

      const openStreamCall = vi.mocked(sseClient.openStream).mock.calls[0][0]

      act(() => {
        openStreamCall.onToken?.('test')
      })

      expect(onMdUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Route Configuration', () => {
    it('should use default route "critique" when not specified', () => {
      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      expect(sseClient.openStream).toHaveBeenCalledWith(
        expect.objectContaining({
          route: 'critique',
        })
      )
    })

    it('should use custom route when specified', () => {
      const config: StreamConfig = {
        ...defaultConfig,
        route: 'custom-endpoint',
      }
      const { result } = renderHook(() => useStreamConnection(config))

      act(() => {
        result.current.actions.start()
      })

      expect(sseClient.openStream).toHaveBeenCalledWith(
        expect.objectContaining({
          route: 'custom-endpoint',
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle synchronous errors from openStream', () => {
      const syncError = new Error('Synchronous validation error')
      vi.mocked(sseClient.openStream).mockImplementation(() => {
        throw syncError
      })

      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      act(() => {
        result.current.actions.start()
      })

      expect(result.current.state.status).toBe('error')
      expect(result.current.state.started).toBe(false)
      expect(telemetry.track).toHaveBeenCalledWith('edge.stream.error')
    })

    it('should allow restart after synchronous error', () => {
      let callCount = 0
      vi.mocked(sseClient.openStream).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('First call fails')
        }
        return mockStreamHandle
      })

      const { result } = renderHook(() => useStreamConnection(defaultConfig))

      // First attempt fails
      act(() => {
        result.current.actions.start()
      })

      expect(result.current.state.status).toBe('error')
      expect(result.current.state.started).toBe(false)

      // Second attempt succeeds
      act(() => {
        result.current.actions.start()
      })

      expect(result.current.state.status).toBe('streaming')
      expect(result.current.state.started).toBe(true)
    })
  })
})
