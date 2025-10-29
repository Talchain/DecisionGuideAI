/**
 * ResultsDiff - Shows delta between current and previous run
 *
 * Features:
 * - Absolute and percentage delta for Likely outcome
 * - Top 1-2 key driver changes
 * - Edited fields indicator (from staged/applied changes)
 * - Color-coded: green (improvement), red (decline), gray (neutral)
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ResultsDiffProps {
  currentLikely: number
  previousLikely: number
  units?: string
  currentDrivers?: Array<{ label: string; impact?: number }>
  previousDrivers?: Array<{ label: string; impact?: number }>
}

export function ResultsDiff({
  currentLikely,
  previousLikely,
  units = 'units',
  currentDrivers = [],
  previousDrivers = []
}: ResultsDiffProps) {
  // Calculate deltas
  const absoluteDelta = currentLikely - previousLikely
  const percentDelta = previousLikely !== 0
    ? ((currentLikely - previousLikely) / Math.abs(previousLikely)) * 100
    : 0

  // Determine trend direction
  const isImprovement = absoluteDelta > 0
  const isDecline = absoluteDelta < 0
  const isNeutral = Math.abs(absoluteDelta) < 0.01

  // Color coding
  const trendColor = isImprovement
    ? 'var(--olumi-success)'
    : isDecline
    ? 'var(--olumi-danger)'
    : 'rgba(232, 236, 245, 0.6)'

  const trendBg = isImprovement
    ? 'rgba(32, 201, 151, 0.15)'
    : isDecline
    ? 'rgba(255, 107, 107, 0.15)'
    : 'rgba(232, 236, 245, 0.1)'

  // Icon
  const TrendIcon = isImprovement ? TrendingUp : isDecline ? TrendingDown : Minus

  // Format delta
  const formatDelta = (value: number) => {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}`
  }

  const formatPercentDelta = (value: number) => {
    const sign = value > 0 ? '+' : ''
    return `${sign}${Math.abs(value).toFixed(1)}%`
  }

  // Detect driver changes (simple label-based comparison)
  const changedDrivers = currentDrivers
    .filter(cd => {
      const prevDriver = previousDrivers.find(pd => pd.label === cd.label)
      if (!prevDriver) return true // New driver
      const impactDiff = Math.abs((cd.impact || 0) - (prevDriver.impact || 0))
      return impactDiff > 0.05 // Significant change threshold
    })
    .slice(0, 2) // Top 2 changes

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '0.375rem',
        border: '1px solid rgba(91, 108, 255, 0.15)',
        backgroundColor: 'rgba(91, 108, 255, 0.03)',
      }}
    >
      {/* Header */}
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(232, 236, 245, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        Changes since last run
      </div>

      {/* Outcome Delta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          borderRadius: '0.25rem',
          backgroundColor: trendBg,
          marginBottom: '0.5rem',
        }}
      >
        <TrendIcon className="w-4 h-4" style={{ color: trendColor }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--olumi-text)' }}>
            Likely outcome
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(232, 236, 245, 0.7)' }}>
            {formatDelta(absoluteDelta)} {units} ({formatPercentDelta(percentDelta)})
          </div>
        </div>
      </div>

      {/* Driver Changes */}
      {changedDrivers.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'rgba(232, 236, 245, 0.7)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            Key driver changes:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {changedDrivers.map((driver, index) => {
              const prevDriver = previousDrivers.find(pd => pd.label === driver.label)
              const isNew = !prevDriver
              return (
                <li key={index} style={{ marginBottom: '0.125rem' }}>
                  {driver.label} {isNew ? '(new)' : '(changed)'}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
