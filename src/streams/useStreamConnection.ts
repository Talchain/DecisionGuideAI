/**
 * useStreamConnection - Encapsulates SSE stream lifecycle, buffering, and state management
 *
 * Core responsibilities:
 * - Stream connection management (start/stop/resume)
 * - RAF-based token buffering for smooth rendering
 * - Status tracking and diagnostics
 * - Event handler coordination
 * - Cleanup on unmount
 *
 * Behavior-preserving extraction from SandboxStreamPanel.tsx
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { openStream, type StreamHandle } from '../lib/sseClient'
import { getDefaults } from '../lib/session'
import { track } from '../lib/telemetry'
import { record } from '../lib/history'
import { fetchRunReport, type RunReport } from '../lib/runReport'
import { renderMarkdownSafe } from '../lib/markdown'

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'cancelled' | 'limited' | 'aborted' | 'error'

export interface StreamMetrics {
  cost?: number
  tokenCount: number
  ttfbMs?: number
  resumeCount: number
  lastSseId?: string
}

export interface StreamConfig {
  // Feature flags
  historyEnabled: boolean
  chipsEnabled: boolean
  paramsEnabled: boolean
  mdEnabled: boolean
  bufferEnabled: boolean

  // Route for stream endpoint (default: 'critique')
  route?: string

  // Callback for markdown rendering (if mdEnabled)
  onMdUpdate?: (html: string) => void

  // Ref for status focus management
  statusRef?: React.RefObject<HTMLDivElement | null>
}

export interface StreamParams {
  seed?: string | number
  budget?: number
  model?: string
}

export interface StreamState {
  status: StreamStatus
  output: string
  metrics: StreamMetrics
  reconnecting: boolean
  resumedOnce: boolean
  started: boolean
  reportData: RunReport | null
}

export interface StreamActions {
  start: (params?: StreamParams) => void
  stop: () => void
  reset: () => void
}

export interface UseStreamConnectionReturn {
  state: StreamState
  actions: StreamActions
}

/**
 * Hook to manage SSE stream connection with RAF buffering and event handling
 */
export function useStreamConnection(config: StreamConfig): UseStreamConnectionReturn {
  const {
    historyEnabled,
    chipsEnabled,
    paramsEnabled,
    mdEnabled,
    bufferEnabled,
    route = 'critique',
    onMdUpdate,
    statusRef,
  } = config

  // Core state
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [output, setOutput] = useState('')
  const [cost, setCost] = useState<number | undefined>(undefined)
  const [reconnecting, setReconnecting] = useState(false)
  const [resumedOnce, setResumedOnce] = useState(false)
  const [started, setStarted] = useState(false)
  const [reportData, setReportData] = useState<RunReport | null>(null)

  // Diagnostics state
  const [diagTokenCount, setDiagTokenCount] = useState(0)
  const [diagTtfbMs, setDiagTtfbMs] = useState<number | undefined>(undefined)
  const [diagResumeCount, setDiagResumeCount] = useState(0)
  const [diagLastId, setDiagLastId] = useState<string | undefined>(undefined)

  // Refs for stream management
  const handleRef = useRef<StreamHandle | null>(null)
  const acceptTokensRef = useRef(true)
  const stopAtRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const costRef = useRef<number | undefined>(undefined)
  const firstTokenAtRef = useRef<number | null>(null)
  const textRef = useRef('')
  const tokensRef = useRef<Array<{ id: string; text: string }>>([])

  // RAF buffering
  const frameBufRef = useRef<string[]>([])
  const rafIdRef = useRef<number | null>(null)

  const flushFrame = useCallback(() => {
    rafIdRef.current = null
    if (!acceptTokensRef.current) {
      frameBufRef.current = []
      return
    }
    if (frameBufRef.current.length > 0) {
      const chunk = frameBufRef.current.join('')
      frameBufRef.current = []
      setOutput((prev) => prev + chunk)
      textRef.current += chunk
      if (mdEnabled && onMdUpdate) {
        onMdUpdate(renderMarkdownSafe(textRef.current))
      }
    }
  }, [mdEnabled, onMdUpdate])

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current != null) return
    const prefersReduced = (() => {
      try {
        return !!(globalThis as any)?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      } catch {
        return false
      }
    })()
    if (prefersReduced) {
      rafIdRef.current = -1 as any
      Promise.resolve().then(() => {
        rafIdRef.current = null
        flushFrame()
      })
      return
    }
    const raf: any = (globalThis as any).requestAnimationFrame
    if (typeof raf === 'function') {
      rafIdRef.current = raf(() => {
        rafIdRef.current = null
        flushFrame()
      })
    } else {
      rafIdRef.current = -1 as any
      Promise.resolve().then(() => {
        rafIdRef.current = null
        flushFrame()
      })
    }
  }, [flushFrame])

  const cancelFlush = useCallback(() => {
    if (rafIdRef.current != null) {
      try {
        (globalThis as any).cancelAnimationFrame?.(rafIdRef.current as any)
      } catch {}
      try {
        clearTimeout(rafIdRef.current as any)
      } catch {}
      rafIdRef.current = null
    }
  }, [])

  const flushNow = useCallback(() => {
    cancelFlush()
    if (frameBufRef.current.length > 0) {
      const chunk = frameBufRef.current.join('')
      frameBufRef.current = []
      setOutput((prev) => prev + chunk)
      textRef.current += chunk
      if (mdEnabled && onMdUpdate) {
        onMdUpdate(renderMarkdownSafe(textRef.current))
      }
    }
  }, [cancelFlush, mdEnabled, onMdUpdate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleRef.current?.close()
      handleRef.current = null
    }
  }, [])

  const start = useCallback((overrideParams?: StreamParams) => {
    if (started) return

    setStarted(true)
    setStatus('streaming')
    setOutput('')
    if (mdEnabled && onMdUpdate) onMdUpdate('')
    setCost(undefined)
    costRef.current = undefined
    setReconnecting(false)
    setResumedOnce(false)
    acceptTokensRef.current = true
    stopAtRef.current = null
    setReportData(null)
    tokensRef.current = []
    textRef.current = ''
    track('edge.stream.start')

    // Reset diagnostics
    setDiagLastId(undefined)
    setDiagResumeCount(0)
    setDiagTtfbMs(undefined)
    setDiagTokenCount(0)
    firstTokenAtRef.current = null

    const { sessionId, org } = getDefaults()
    startedAtRef.current = Date.now()

    const seedArg = overrideParams?.seed != null ? overrideParams.seed : undefined
    const budgetArg = overrideParams?.budget
    const modelArg = overrideParams?.model

    let h: StreamHandle
    try {
      h = openStream({
        route,
        sessionId,
        org,
        seed: seedArg,
        budget: budgetArg,
        model: modelArg,
      onHello: () => {
        setReconnecting(false)
      },
      onResume: () => {
        setReconnecting(false)
        setResumedOnce((v) => v || true)
        setDiagResumeCount((v) => v + 1)
      },
      onToken: (t) => {
        if (!acceptTokensRef.current) return
        const id = String(tokensRef.current.length + 1)
        tokensRef.current.push({ id, text: t })
        setDiagTokenCount((c) => c + 1)
        if (firstTokenAtRef.current == null && startedAtRef.current != null) {
          const dt = Math.max(0, Date.now() - startedAtRef.current)
          firstTokenAtRef.current = Date.now()
          setDiagTtfbMs(dt)
        }
        if (bufferEnabled) {
          frameBufRef.current.push(t)
          scheduleFlush()
        } else {
          setOutput((prev) => prev + t)
          textRef.current += t
        }
        track('edge.stream.token')
      },
      onSseId: (id?: string) => {
        if (id) setDiagLastId(id)
      },
      onCost: (usd) => {
        setCost(usd)
        costRef.current = usd
      },
      onDone: () => {
        flushNow()
        setStatus('done')
        setStarted(false)
        setReconnecting(false)
        if (mdEnabled && onMdUpdate) onMdUpdate(renderMarkdownSafe(textRef.current))
        setTimeout(() => statusRef?.current?.focus(), 0)
        track('edge.stream.done')
        if (historyEnabled) {
          const durationMs = startedAtRef.current
            ? Math.max(0, Date.now() - startedAtRef.current)
            : undefined
          record({
            id: `${Date.now()}-${seedArg || 'na'}`,
            ts: Date.now(),
            status: 'done',
            durationMs,
            estCost: costRef.current,
            seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
            budget: paramsEnabled && budgetArg ? budgetArg : undefined,
            model: paramsEnabled && modelArg ? modelArg : undefined,
            route: 'critique',
            sessionId,
            org,
          })
        }
        if (chipsEnabled) {
          void fetchRunReport({
            sessionId,
            org,
            seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
            budget: paramsEnabled && budgetArg ? budgetArg : undefined,
            model: paramsEnabled && modelArg ? modelArg : undefined,
          })
            .then(setReportData)
            .catch(() => {})
        }
      },
      onCancelled: () => {
        flushNow()
        setStatus('cancelled')
        setStarted(false)
        setReconnecting(false)
        if (mdEnabled && onMdUpdate) onMdUpdate(renderMarkdownSafe(textRef.current))
        setTimeout(() => statusRef?.current?.focus(), 0)
        track('edge.stream.cancelled')
      },
      onError: (err?: any) => {
        if (err && err.willRetry) {
          setReconnecting(true)
        } else {
          flushNow()
          setStatus('error')
          setStarted(false)
          setReconnecting(false)
          if (mdEnabled && onMdUpdate) onMdUpdate(renderMarkdownSafe(textRef.current))
          setTimeout(() => statusRef?.current?.focus(), 0)
          track('edge.stream.error')
          if (historyEnabled) {
            const durationMs = startedAtRef.current
              ? Math.max(0, Date.now() - startedAtRef.current)
              : undefined
            record({
              id: `${Date.now()}-${seedArg || 'na'}`,
              ts: Date.now(),
              status: 'error',
              durationMs,
              estCost: costRef.current,
              seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
              budget: paramsEnabled && budgetArg ? budgetArg : undefined,
              model: paramsEnabled && modelArg ? modelArg : undefined,
              route: 'critique',
              sessionId,
              org,
            })
          }
          if (chipsEnabled) {
            void fetchRunReport({
              sessionId,
              org,
              seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
              budget: paramsEnabled && budgetArg ? budgetArg : undefined,
              model: paramsEnabled && modelArg ? modelArg : undefined,
            })
              .then(setReportData)
              .catch(() => {})
          }
        }
      },
      onAborted: () => {
        flushNow()
        setStatus('aborted')
        setStarted(false)
        setReconnecting(false)
        if (mdEnabled && onMdUpdate) onMdUpdate(renderMarkdownSafe(textRef.current))
        setTimeout(() => statusRef?.current?.focus(), 0)
        if (historyEnabled) {
          const durationMs = startedAtRef.current
            ? Math.max(0, Date.now() - startedAtRef.current)
            : undefined
          record({
            id: `${Date.now()}-${seedArg || 'na'}`,
            ts: Date.now(),
            status: 'aborted',
            durationMs,
            estCost: costRef.current,
            seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
            budget: paramsEnabled && budgetArg ? budgetArg : undefined,
            model: paramsEnabled && modelArg ? modelArg : undefined,
            route: 'critique',
            sessionId,
            org,
          })
        }
        if (chipsEnabled) {
          void fetchRunReport({
            sessionId,
            org,
            seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
            budget: paramsEnabled && budgetArg ? budgetArg : undefined,
            model: paramsEnabled && modelArg ? modelArg : undefined,
          })
            .then(setReportData)
            .catch(() => {})
        }
      },
      onLimit: () => {
        flushNow()
        setStatus('limited')
        setStarted(false)
        setReconnecting(false)
        if (mdEnabled && onMdUpdate) onMdUpdate(renderMarkdownSafe(textRef.current))
        setTimeout(() => statusRef?.current?.focus(), 0)
        track('edge.stream.limited')
        if (historyEnabled) {
          const durationMs = startedAtRef.current
            ? Math.max(0, Date.now() - startedAtRef.current)
            : undefined
          record({
            id: `${Date.now()}-${seedArg || 'na'}`,
            ts: Date.now(),
            status: 'limited',
            durationMs,
            estCost: costRef.current,
            seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
            budget: paramsEnabled && budgetArg ? budgetArg : undefined,
            model: paramsEnabled && modelArg ? modelArg : undefined,
            route: 'critique',
            sessionId,
            org,
          })
        }
        if (chipsEnabled) {
          void fetchRunReport({
            sessionId,
            org,
            seed: paramsEnabled && seedArg ? String(seedArg) : undefined,
            budget: paramsEnabled && budgetArg ? budgetArg : undefined,
            model: paramsEnabled && modelArg ? modelArg : undefined,
          })
            .then(setReportData)
            .catch(() => {})
        }
      },
    })
      handleRef.current = h
    } catch (err) {
      // Handle synchronous throws from openStream (e.g., validation errors)
      if (import.meta.env.DEV) {
        console.error('[useStreamConnection] Synchronous error in openStream:', err)
      }
      setStarted(false)
      setStatus('error')
      setReconnecting(false)
      track('edge.stream.error')
      // Don't assign handleRef if openStream threw
    }
  }, [
    started,
    mdEnabled,
    onMdUpdate,
    historyEnabled,
    chipsEnabled,
    paramsEnabled,
    bufferEnabled,
    route,
    statusRef,
    scheduleFlush,
    flushNow,
  ])

  const stop = useCallback(() => {
    if (!started) return
    flushNow()
    setStatus('cancelled')
    setStarted(false)
    setReconnecting(false)
    acceptTokensRef.current = false
    stopAtRef.current = Date.now()
    setTimeout(() => statusRef?.current?.focus(), 0)
    const h = handleRef.current
    h?.cancel().catch(() => {})
    handleRef.current = null
  }, [started, flushNow, statusRef])

  const reset = useCallback(() => {
    setStatus('idle')
    setOutput('')
    setCost(undefined)
    setReconnecting(false)
    setResumedOnce(false)
    setStarted(false)
    setReportData(null)
    setDiagTokenCount(0)
    setDiagTtfbMs(undefined)
    setDiagResumeCount(0)
    setDiagLastId(undefined)
    textRef.current = ''
    tokensRef.current = []
    frameBufRef.current = []
    cancelFlush()
  }, [cancelFlush])

  return {
    state: {
      status,
      output,
      metrics: {
        cost,
        tokenCount: diagTokenCount,
        ttfbMs: diagTtfbMs,
        resumeCount: diagResumeCount,
        lastSseId: diagLastId,
      },
      reconnecting,
      resumedOnce,
      started,
      reportData,
    },
    actions: {
      start,
      stop,
      reset,
    },
  }
}
