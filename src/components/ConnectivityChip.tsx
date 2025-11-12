/**
 * Connectivity Chip (M1.1)
 * Shows PLoT engine health status with manual retry
 */

import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { probeHealth, type HealthStatus } from '../adapters/plot/v1/health'

const BACKOFF_SCHEDULE = [1000, 3000, 10000] // 1s, 3s, 10s

export function ConnectivityChip() {
  const [status, setStatus] = useState<HealthStatus>('unhealthy')
  const [isProbing, setIsProbing] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const probe = useCallback(async () => {
    setIsProbing(true)
    const result = await probeHealth()
    setStatus(result)
    setIsProbing(false)
    setAttempt(0) // Reset on successful probe
    return result
  }, [])

  // Initial probe on mount
  useEffect(() => {
    probe()
  }, [probe])

  // Auto-retry on unhealthy with backoff
  useEffect(() => {
    if (status === 'healthy' || isProbing) return

    const delay = BACKOFF_SCHEDULE[Math.min(attempt, BACKOFF_SCHEDULE.length - 1)]
    const timeoutId = setTimeout(() => {
      setAttempt((a) => a + 1)
      probe()
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [status, isProbing, attempt, probe])

  const handleManualRetry = () => {
    setAttempt(0)
    probe()
  }

  const isHealthy = status === 'healthy'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isHealthy ? 'Engine online' : 'Engine offline'}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        isHealthy
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}
    >
      {isProbing ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : isHealthy ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}

      <span>{isHealthy ? 'Online' : 'Offline'}</span>

      {!isHealthy && !isProbing && (
        <button
          onClick={handleManualRetry}
          className="ml-1 text-amber-600 hover:text-amber-800 underline"
          aria-label="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  )
}
