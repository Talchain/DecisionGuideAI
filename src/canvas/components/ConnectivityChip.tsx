/**
 * Connectivity Status Chip (v1.2 - Task Group C)
 *
 * Displays engine connectivity status with semantic colors:
 * - OK: Engine reachable and healthy
 * - Degraded: Engine reachable but slow/partial
 * - Offline: Engine not reachable
 *
 * Updates on mount and on manual reprobe.
 */

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, AlertTriangle, HelpCircle } from 'lucide-react'
import { probeCapability, clearProbeCache, type ProbeResult } from '../../adapters/plot/v1/probe'

export type ConnectivityStatus = 'ok' | 'degraded' | 'offline' | 'unknown'

interface ConnectivityChipProps {
  className?: string
  showLabel?: boolean
  onStatusChange?: (status: ConnectivityStatus) => void
}

export function ConnectivityChip({ className = '', showLabel = true, onStatusChange }: ConnectivityChipProps) {
  const [status, setStatus] = useState<ConnectivityStatus>('unknown')
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkConnectivity = async () => {
    setIsLoading(true)
    try {
      const probe = await probeCapability()
      const newStatus = computeStatus(probe)
      setStatus(newStatus)
      setLastChecked(new Date())
      onStatusChange?.(newStatus)
    } catch (err) {
      console.error('[ConnectivityChip] Failed to check connectivity:', err)
      setStatus('unknown')
    } finally {
      setIsLoading(false)
    }
  }

  // Check on mount
  useEffect(() => {
    checkConnectivity()
  }, [])

  const handleReprobe = async () => {
    setIsLoading(true)
    try {
      clearProbeCache()
      await checkConnectivity()
    } catch (err) {
      console.error('[ConnectivityChip] Reprobe failed:', err)
      setStatus('unknown')
      setIsLoading(false)
    }
  }

  const config = getConfig(status, isLoading)

  const tooltipText = lastChecked
    ? `${config.label} - Last checked: ${lastChecked.toLocaleTimeString()}\nClick to refresh`
    : `${config.label}\nClick to refresh`

  return (
    <button
      onClick={handleReprobe}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-wait ${config.classes} ${className}`}
      title={tooltipText}
      aria-label={`Engine status: ${config.label}`}
      data-testid="connectivity-chip"
    >
      <config.Icon className="w-4 h-4" aria-hidden="true" />
      {showLabel && (
        <span className="text-xs font-medium">
          {config.label}
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
