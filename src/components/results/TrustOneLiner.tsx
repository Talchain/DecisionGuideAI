/**
 * TrustOneLiner — compact trust summary with 32px mini ring + deterministic copy.
 *
 * Replaces the verbose trust text in HeroSection. Shows:
 * - 32px SVG arc ring filled proportional to recommendation stability
 * - Deterministic label from stability thresholds
 * - Evidence suffix when AI estimates dominate
 * - "More" link scrolling to #trust-narrative in Advanced section
 */

import { typography } from '../../styles/typography'
import { getStabilityClassification } from '../../lib/stability'
import Tooltip from '../Tooltip'

export interface TrustOneLinerProps {
  /** Recommendation stability score (0-1) */
  recommendationStability?: number
  /** Count of factors using default/AI estimates */
  defaultEstimateCount?: number
  /** Total factor count */
  totalFactorCount?: number
}

/**
 * Deterministic copy mapping for trust summary label.
 * Delegates to canonical getStabilityClassification() in lib/stability.ts.
 */
function getStabilityLabel(stability: number | undefined): string {
  return getStabilityClassification(stability ?? null)?.heroLabel ?? 'Unknown stability'
}

/**
 * Evidence suffix based on proportion of AI-estimated factors.
 * Appended after " · " when applicable.
 */
function getEvidenceSuffix(defaultCount?: number, totalCount?: number): string | null {
  if (defaultCount == null || totalCount == null || totalCount === 0) return null
  const ratio = defaultCount / totalCount
  if (ratio > 0.75) return 'most values are AI estimates'
  if (ratio > 0.50) return 'evidence is limited'
  return null
}

/**
 * SVG arc ring colour based on stability value.
 * Uses canonical classification from lib/stability.ts.
 */
function getRingColour(stability: number | undefined): string {
  const cls = getStabilityClassification(stability ?? null)
  if (!cls) return 'var(--factor)'
  switch (cls.level) {
    case 'high': return 'var(--success)'
    case 'moderate': return 'var(--success)'
    case 'low': return 'var(--warning)'
    case 'very_low': return 'var(--danger)'
  }
}

export function TrustOneLiner({
  recommendationStability,
  defaultEstimateCount,
  totalFactorCount,
}: TrustOneLinerProps) {
  const stabilityPct = recommendationStability != null
    ? Math.round(recommendationStability * 100)
    : null
  const label = getStabilityLabel(recommendationStability)
  const suffix = getEvidenceSuffix(defaultEstimateCount, totalFactorCount)
  const ringColour = getRingColour(recommendationStability)

  // SVG arc calculation: circle circumference = 2 * pi * r = 2 * 3.14159 * 13 ≈ 81.68
  const circumference = 2 * Math.PI * 13
  const fillLength = recommendationStability != null
    ? circumference * Math.max(0, Math.min(1, recommendationStability))
    : 0
  const gapLength = circumference - fillLength

  const scrollToTrustNarrative = () => {
    const el = document.getElementById('trust-narrative')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Auto-expand the Advanced accordion if collapsed
      const accordion = el.closest('[data-testid="accordion-advanced"]')
      if (accordion) {
        const trigger = accordion.querySelector('button[aria-expanded="false"]') as HTMLButtonElement | null
        trigger?.click()
      }
    }
  }

  return (
    <div className="flex items-center gap-2.5 py-1.5" data-testid="trust-one-liner">
      {/* 32px mini ring */}
      <Tooltip content={stabilityPct != null ? `Overall trust score: ${stabilityPct}%` : 'Overall trust score'}>
        <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
          <svg viewBox="0 0 32 32" width={32} height={32}>
            {/* Track */}
            <circle cx={16} cy={16} r={13} fill="none" stroke="var(--border-default)" strokeWidth={3} />
            {/* Fill arc */}
            <circle
              cx={16}
              cy={16}
              r={13}
              fill="none"
              stroke={ringColour}
              strokeWidth={3}
              strokeDasharray={`${fillLength} ${gapLength}`}
              transform="rotate(-90 16 16)"
              strokeLinecap="round"
            />
          </svg>
          {stabilityPct != null && (
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-text-header"
            >
              {stabilityPct}
            </span>
          )}
        </div>
      </Tooltip>

      {/* Copy */}
      <span className={`${typography.panelBody} text-text-light flex-1`}>
        <strong className="text-text-body font-semibold">{label}</strong>
        {suffix && <> &middot; {suffix}</>}
        {' '}&middot;{' '}
        <button
          type="button"
          onClick={scrollToTrustNarrative}
          className={`${typography.panelBody} text-info hover:underline`}
          data-testid="trust-more-link"
        >
          more
        </button>
      </span>
    </div>
  )
}
