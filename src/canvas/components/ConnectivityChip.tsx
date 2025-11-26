/**
 * Connectivity Status Chip (v1.2 - Task Group C + P1 Polish)
 *
 * Displays engine connectivity status with semantic colours:
 * - OK: Engine reachable and healthy
 * - Degraded: Engine reachable but slow/partial
 * - Offline: Engine not reachable (navigator.onLine false or probe failures)
 *
 * Features:
 * - Exponential backoff retry: 1s → 3s → 10s (capped at 10s)
 * - Manual click forces immediate reprobe and resets backoff
 * - Clear offline detection using navigator.onLine
 * - Accessible with role="status" and aria-live="polite"
 */

import { useEffect, useState, useRef } from 'react'
import { Wifi, WifiOff, AlertTriangle, HelpCircle } from 'lucide-react'
import { probeCapability, clearProbeCache, type ProbeResult } from '../../adapters/plot/v1/probe'
import { typography } from '../../styles/typography'

export type ConnectivityStatus = 'ok' | 'degraded' | 'offline' | 'unknown'

interface ConnectivityChipProps {
  className?: string
  showLabel?: boolean
  onStatusChange?: (status: ConnectivityStatus) => void
}

// Backoff schedule: 1s → 3s → 10s (cap at 10s)
const BACKOFF_DELAYS_MS = [1000, 3000, 10000]
const MAX_BACKOFF_MS = 10000

export function ConnectivityChip({ className = '', showLabel = true, onStatusChange }: ConnectivityChipProps) {
  const [status, setStatus] = useState<ConnectivityStatus>('unknown')
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null)

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const checkConnectivity = async () => {
    setIsLoading(true)

    // Clear any pending retry timers
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }

    try {
      // First check if we're actually offline
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus('offline')
        setLastChecked(new Date())
        onStatusChange?.('offline')
        scheduleRetry()
        return
      }

      const probe = await probeCapability()
      const newStatus = computeStatus(probe)
      setStatus(newStatus)
      setLastChecked(new Date())
      onStatusChange?.(newStatus)

      // Reset retry attempt on success
      if (newStatus === 'ok' || newStatus === 'degraded') {
        setRetryAttempt(0)
        setNextRetryIn(null)
      } else {
        // Schedule retry for non-OK states
        scheduleRetry()
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[ConnectivityChip] Failed to check connectivity:', err)
      }

      // Check if actually offline
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus('offline')
      } else {
        // Probe failed but network is online → offline (can't reach engine)
        setStatus('offline')
      }

      setLastChecked(new Date())
      onStatusChange?.(status)
      scheduleRetry()
    } finally {
      setIsLoading(false)
    }
  }

  const scheduleRetry = () => {
    // Calculate next delay using backoff schedule
    const delayMs = retryAttempt < BACKOFF_DELAYS_MS.length
      ? BACKOFF_DELAYS_MS[retryAttempt]
      : MAX_BACKOFF_MS

    setNextRetryIn(Math.floor(delayMs / 1000))
    setRetryAttempt(prev => prev + 1)

    // Start countdown timer (update every second)
    countdownTimerRef.current = setInterval(() => {
      setNextRetryIn(prev => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    // Schedule actual retry
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      checkConnectivity()
    }, delayMs)
  }

  // Check on mount
  useEffect(() => {
    checkConnectivity()

    // Cleanup timers on unmount
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  const handleReprobe = async () => {
    // Manual click resets backoff and forces immediate check
    setRetryAttempt(0)
    setNextRetryIn(null)
    setIsLoading(true)

    try {
      clearProbeCache()
      await checkConnectivity()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[ConnectivityChip] Reprobe failed:', err)
      }
      setIsLoading(false)
    }
  }

  const config = getConfig(status, isLoading)

  const tooltipText = (() => {
    const baseText = config.label
    const lastCheckedText = lastChecked ? ` - Last checked: ${lastChecked.toLocaleTimeString()}` : ''
    const retryText = nextRetryIn !== null ? `\nRetrying in ${nextRetryIn}s` : ''
    const clickText = '\nClick to retry now'
    return `${baseText}${lastCheckedText}${retryText}${clickText}`
  })()

  return (
    <button
      onClick={handleReprobe}
      disabled={isLoading}
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-wait ${config.classes} ${className}`}
      title={tooltipText}
      aria-label={`Engine status: ${config.label}${nextRetryIn !== null ? `. Retrying in ${nextRetryIn} seconds` : ''}`}
      data-testid="connectivity-chip"
    >
      <config.Icon className="w-4 h-4" aria-hidden="true" />
      {showLabel && (
        <span className={`${typography.caption} font-medium`}>
          {config.label}
          {nextRetryIn !== null && <span className="ml-1">({nextRetryIn}s)</span>}
        </span>
      )}
    </button>
  )
}

function computeStatus(probe: ProbeResult): ConnectivityStatus {
  if (!probe.available) {
    return 'offline'
  }

  // Check health status
  if (probe.healthStatus === 'ok') {
    return 'ok'
  } else if (probe.healthStatus === 'degraded') {
    return 'degraded'
  }

  // Fallback: if available but health unknown, assume OK
  return 'ok'
}

function getConfig(status: ConnectivityStatus, isLoading: boolean) {
  if (isLoading) {
    return {
      label: 'Checking...',
      classes: 'bg-gray-50 border-gray-200 text-gray-600',
      Icon: HelpCircle,
    }
  }

  switch (status) {
    case 'ok':
      return {
        label: 'Engine OK',
        classes: 'bg-success-50 border-success-200 text-success-700',
        Icon: Wifi,
      }
    case 'degraded':
      return {
        label: 'Engine Degraded',
        classes: 'bg-warning-50 border-warning-200 text-warning-700',
        Icon: AlertTriangle,
      }
    case 'offline':
      return {
        label: 'Engine Offline',
        classes: 'bg-danger-50 border-danger-200 text-danger-700',
        Icon: WifiOff,
      }
    case 'unknown':
    default:
      return {
        label: 'Status Unknown',
        classes: 'bg-gray-50 border-gray-200 text-gray-600',
        Icon: HelpCircle,
      }
  }
}
