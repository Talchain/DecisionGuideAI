/**
 * Health pill for PLoT v1 HTTP adapter
 * Shows connection status with ok/degraded/down states
 */

import { useEffect, useRef, useState } from 'react'
import { health } from '../http'
import type { V1HealthResponse } from '../types'

interface PlotHealthPillProps {
  pause?: boolean
}

export function PlotHealthPill({ pause = false }: PlotHealthPillProps): JSX.Element {
  const [status, setStatus] = useState<'ok' | 'degraded' | 'down' | null>(null)
  const [version, setVersion] = useState<string | undefined>()
  const timerRef = useRef<number | null>(null)
  const lastProbeRef = useRef<number | null>(null)

  // Polling intervals: 30s normal, 300s max backoff
  const base = 30_000
  const max = 300_000
  const backoffRef = useRef<number>(base)

  const clearTimer = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const schedule = (delay: number) => {
    clearTimer()
    timerRef.current = setTimeout(tick, delay) as unknown as number
  }

  const tick = async () => {
    if (pause) {
      schedule(backoffRef.current)
      return
    }

    const response: V1HealthResponse = await health()

    setStatus(response.status)
    setVersion(response.version)
    lastProbeRef.current = Date.now()

    if (response.status === 'ok') {
      backoffRef.current = base
    } else {
      backoffRef.current = Math.min(max, backoffRef.current * 2)
    }

    schedule(backoffRef.current)
  }

  useEffect(() => {
    void tick() // Run immediately on mount
    return () => clearTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pause) {
      clearTimer()
    } else {
      schedule(backoffRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause])

  const secs = lastProbeRef.current
    ? Math.max(0, Math.round((Date.now() - lastProbeRef.current) / 1000))
    : 0

  const getStatusColor = () => {
    if (status === null) return 'bg-gray-300'
    if (status === 'ok') return 'bg-emerald-500'
    if (status === 'degraded') return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    if (status === null) return 'Checking PLoT engine…'
    if (status === 'ok') return version ? `PLoT v${version} • OK` : 'PLoT engine • OK'
    if (status === 'degraded') return 'PLoT engine • Degraded'
    return 'PLoT engine • Offline'
  }

  const title = status === null
    ? getStatusText()
    : `${getStatusText()} — checked ${secs}s ago`

  return (
    <div
      className="flex items-center gap-2 text-xs text-gray-600"
      title={title}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{getStatusText()}</span>
    </div>
  )
}
