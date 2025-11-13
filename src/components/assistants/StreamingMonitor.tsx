/**
 * N4: Streaming Resilience - Assistants Integration
 *
 * Monitors streaming requests for:
 * - Correlation ID tracking (surfaced in debug tray)
 * - Missing COMPLETE event detection
 * - User-visible retry action
 * - Timeout handling (≥2.5s)
 */

import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'

export interface StreamingState {
  correlationId?: string
  status: 'idle' | 'streaming' | 'complete' | 'timeout' | 'error'
  startTime?: number
  lastEventTime?: number
  eventCount: number
  error?: string
}

interface StreamingMonitorProps {
  state: StreamingState
  onRetry?: () => void
  showDebug?: boolean // Dev-only debug tray
}

const STREAMING_TIMEOUT_MS = 2500 // ≥2.5s

export function StreamingMonitor({ state, onRetry, showDebug = false }: StreamingMonitorProps) {
  const [timeElapsed, setTimeElapsed] = useState(0)

  // Track elapsed time during streaming
  useEffect(() => {
    if (state.status === 'streaming' && state.startTime) {
      const interval = setInterval(() => {
        setTimeElapsed(Date.now() - state.startTime!)
      }, 100)
      return () => clearInterval(interval)
    }
  }, [state.status, state.startTime])

  // Detect timeout (no events for ≥2.5s)
  useEffect(() => {
    if (state.status === 'streaming' && state.lastEventTime) {
      const checkTimeout = setInterval(() => {
        const timeSinceLastEvent = Date.now() - state.lastEventTime!
        if (timeSinceLastEvent >= STREAMING_TIMEOUT_MS) {
          // Timeout detected - handled by parent component
          console.warn(`[StreamingMonitor] Timeout detected (${timeSinceLastEvent}ms since last event)`)
        }
      }, 500)
      return () => clearInterval(checkTimeout)
    }
  }, [state.status, state.lastEventTime])

  // Don't render if idle and no debug
  if (state.status === 'idle' && !showDebug) return null

  return (
    <div className="space-y-2">
      {/* Status Banner */}
      {state.status === 'streaming' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-info-50 border border-info-200 rounded-lg text-xs">
          <RefreshCw className="w-4 h-4 text-info-600 animate-spin" />
          <span className="text-info-900 font-medium">Streaming response...</span>
          <span className="text-info-700">{(timeElapsed / 1000).toFixed(1)}s</span>
        </div>
      )}

      {state.status === 'complete' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-success-50 border border-success-200 rounded-lg text-xs">
          <CheckCircle2 className="w-4 h-4 text-success-600" />
          <span className="text-success-900 font-medium">Stream complete</span>
          <span className="text-success-700">{state.eventCount} events</span>
        </div>
      )}

      {state.status === 'timeout' && (
        <div className="flex items-start gap-2 px-3 py-2 bg-warning-50 border border-warning-200 rounded-lg text-xs">
          <AlertTriangle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-warning-900 font-medium">Stream incomplete</p>
            <p className="text-warning-700 mt-0.5">
              No events received for 2.5s — response may be incomplete.
            </p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2 py-1 bg-warning-600 text-white rounded hover:bg-warning-700 transition-colors flex items-center gap-1"
              aria-label="Retry streaming request"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-2 px-3 py-2 bg-danger-50 border border-danger-200 rounded-lg text-xs">
          <XCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-danger-900 font-medium">Stream failed</p>
            {state.error && (
              <p className="text-danger-700 mt-0.5">{state.error}</p>
            )}
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2 py-1 bg-danger-600 text-white rounded hover:bg-danger-700 transition-colors flex items-center gap-1"
              aria-label="Retry streaming request"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Debug Tray (Dev Only) */}
      {showDebug && import.meta.env.DEV && (
        <details className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
          <summary className="cursor-pointer font-medium text-gray-700 select-none">
            Debug Info
          </summary>
          <dl className="mt-2 space-y-1 text-gray-600">
            <div className="flex gap-2">
              <dt className="font-medium">Status:</dt>
              <dd>{state.status}</dd>
            </div>
            {state.correlationId && (
              <div className="flex gap-2">
                <dt className="font-medium">Correlation ID:</dt>
                <dd className="font-mono text-[10px] break-all">{state.correlationId}</dd>
              </div>
            )}
            {state.startTime && (
              <div className="flex gap-2">
                <dt className="font-medium">Started:</dt>
                <dd>{new Date(state.startTime).toLocaleTimeString()}</dd>
              </div>
            )}
            {state.lastEventTime && (
              <div className="flex gap-2">
                <dt className="font-medium">Last Event:</dt>
                <dd>{new Date(state.lastEventTime).toLocaleTimeString()}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="font-medium">Event Count:</dt>
              <dd>{state.eventCount}</dd>
            </div>
          </dl>
        </details>
      )}
    </div>
  )
}

/**
 * Hook to manage streaming state
 */
export function useStreamingMonitor() {
  const [state, setState] = useState<StreamingState>({
    status: 'idle',
    eventCount: 0
  })

  const startStreaming = (correlationId?: string) => {
    setState({
      correlationId,
      status: 'streaming',
      startTime: Date.now(),
      lastEventTime: Date.now(),
      eventCount: 0
    })
  }

  const recordEvent = () => {
    setState((prev) => ({
      ...prev,
      lastEventTime: Date.now(),
      eventCount: prev.eventCount + 1
    }))
  }

  const complete = () => {
    setState((prev) => ({
      ...prev,
      status: 'complete'
    }))
  }

  const timeout = () => {
    setState((prev) => ({
      ...prev,
      status: 'timeout'
    }))
  }

  const error = (message: string) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      error: message
    }))
  }

  const reset = () => {
    setState({
      status: 'idle',
      eventCount: 0
    })
  }

  return {
    state,
    startStreaming,
    recordEvent,
    complete,
    timeout,
    error,
    reset
  }
}
