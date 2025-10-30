/**
 * PreviewDiff - Shows comparison between preview and current analysis
 *
 * Features:
 * - Side-by-side likely outcome comparison
 * - Delta with color coding
 * - Epsilon tolerance for "no significant change"
 * - Color + icon + text redundancy for accessibility
 * - Highlights significant changes in drivers
 */

import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import type { ReportV1 } from '../../adapters/plot/types'

// Epsilon tolerance: changes smaller than this are considered "no significant change"
// This prevents noise from floating-point arithmetic and very small differences
const EPSILON = 0.01 // 1% of a unit
const PERCENT_EPSILON = 0.5 // 0.5% threshold for percentage changes

interface PreviewDiffProps {
  currentReport: ReportV1
  previewReport: ReportV1
}

export function PreviewDiff({ currentReport, previewReport }: PreviewDiffProps) {
  const currentLikely = currentReport.results.likely
  const previewLikely = previewReport.results.likely
  const units = currentReport.results.units

  // Calculate delta
  const absoluteDelta = previewLikely - currentLikely
  const percentDelta = currentLikely !== 0
    ? ((previewLikely - currentLikely) / Math.abs(currentLikely)) * 100
    : 0

  // Determine trend direction with epsilon tolerance
  // Use both absolute and percent thresholds to handle edge cases
  const isNeutral = Math.abs(absoluteDelta) < EPSILON || Math.abs(percentDelta) < PERCENT_EPSILON
  const isImprovement = !isNeutral && absoluteDelta > 0
  const isDecline = !isNeutral && absoluteDelta < 0

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

  // Icon and text label for redundancy
  const TrendIcon = isImprovement ? TrendingUp : isDecline ? TrendingDown : Minus
  const trendLabel = isImprovement ? 'Improved' : isDecline ? 'Declined' : 'No Change'

  // Format delta
  const formatDelta = (value: number) => {
    if (isNeutral) return '±0.00' // Show ± for neutral to indicate "within tolerance"
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}`
  }

  const formatPercentDelta = (value: number) => {
    if (isNeutral) return '(~0%)' // Show ~ for "approximately zero"
    const sign = value > 0 ? '+' : ''
    return `(${sign}${Math.abs(value).toFixed(1)}%)`
  }

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '0.375rem',
        border: '1px solid rgba(91, 108, 255, 0.2)',
        backgroundColor: 'rgba(91, 108, 255, 0.05)',
      }}
    >
      {/* Header */}
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'rgba(232, 236, 245, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem'
      }}>
        Preview vs Current
      </div>

      {/* Comparison Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        {/* Current Value */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(232, 236, 245, 0.5)', marginBottom: '0.25rem' }}>
            Current
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--olumi-text)' }}>
            {currentLikely.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(232, 236, 245, 0.5)' }}>
            {units}
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className="w-5 h-5" style={{ color: 'rgba(232, 236, 245, 0.4)', flexShrink: 0 }} />

        {/* Preview Value */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--olumi-primary)', marginBottom: '0.25rem' }}>
            Preview
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--olumi-primary)' }}>
            {previewLikely.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(232, 236, 245, 0.5)' }}>
            {units}
          </div>
        </div>
      </div>

      {/* Delta Indicator with Color + Icon + Text redundancy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          borderRadius: '0.25rem',
          backgroundColor: trendBg,
        }}
        role="status"
        aria-label={`${trendLabel}: ${formatDelta(absoluteDelta)} ${units}`}
      >
        <TrendIcon className="w-4 h-4" style={{ color: trendColor }} aria-hidden="true" />
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: trendColor }}>
          <span style={{ marginRight: '0.5rem' }}>{trendLabel}:</span>
          {formatDelta(absoluteDelta)} {units}
          <span style={{ marginLeft: '0.375rem', opacity: 0.8 }}>
            {formatPercentDelta(percentDelta)}
          </span>
        </div>
      </div>
    </div>
  )
}
