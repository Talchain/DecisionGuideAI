/**
 * RiskAdjustedDisplay - Shows risk-weighted outcomes based on user profile
 *
 * Features:
 * - Shows risk-adjusted expectation value
 * - Highlights relevant range based on risk tolerance
 * - Shows recommendation tailored to risk profile
 * - Integrates with stored risk profile from localStorage
 */

import { memo, useMemo } from 'react'
import { Shield, Scale, Zap, AlertTriangle, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { formatOutcomeValue, formatOutcomeValueCompact } from '../../lib/format'
import { RiskProfileInline } from './RiskProfileBadge'
import { useStoredRiskProfile } from './RiskTolerancePanel'
import {
  computeRiskAdjustedOutcome,
  getRiskAdjustedMessage,
  getEmphasisBand,
  type OutcomeBands,
} from '../utils/riskAdjustedOutcome'
import type { RiskProfile, RiskProfilePreset } from '../../adapters/plot/types'

interface RiskAdjustedDisplayProps {
  /** Outcome bands (p10/p50/p90) */
  bands: OutcomeBands
  /** Override the stored risk profile */
  overrideProfile?: RiskProfile | null
  /** Units for formatting */
  units?: 'currency' | 'percent' | 'count'
  /** Unit symbol for currency */
  unitSymbol?: string
  /** Goal direction */
  goalDirection?: 'maximize' | 'minimize'
  /** Compact mode - just show adjusted value and indicator */
  compact?: boolean
  /** Show profile badge */
  showProfileBadge?: boolean
}

/** Profile-specific styling */
const PROFILE_STYLES: Record<RiskProfilePreset, {
  icon: typeof Shield
  bgColor: string
  borderColor: string
  textColor: string
  accentColor: string
}> = {
  risk_averse: {
    icon: Shield,
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    textColor: 'text-sky-700',
    accentColor: 'text-sky-600',
  },
  neutral: {
    icon: Scale,
    bgColor: 'bg-sand-50',
    borderColor: 'border-sand-200',
    textColor: 'text-ink-700',
    accentColor: 'text-ink-600',
  },
  risk_seeking: {
    icon: Zap,
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-700',
    accentColor: 'text-carrot-600',
  },
}

export const RiskAdjustedDisplay = memo(function RiskAdjustedDisplay({
  bands,
  overrideProfile,
  units = 'percent',
  unitSymbol,
  goalDirection = 'maximize',
  compact = false,
  showProfileBadge = true,
}: RiskAdjustedDisplayProps) {
  const storedProfile = useStoredRiskProfile()
  const profile = overrideProfile !== undefined ? overrideProfile : storedProfile

  const adjusted = useMemo(
    () => computeRiskAdjustedOutcome(bands, profile),
    [bands, profile]
  )

  const message = useMemo(
    () => getRiskAdjustedMessage(bands, profile, goalDirection),
    [bands, profile, goalDirection]
  )

  const emphasisBand = useMemo(
    () => getEmphasisBand(profile),
    [profile]
  )

  const preset = profile?.profile || 'neutral'
  const styles = PROFILE_STYLES[preset]
  const Icon = styles.icon

  // No profile set - show minimal display with suggestion
  if (!profile) {
    return (
      <div
        className="p-3 bg-sand-50 border border-sand-200 rounded-lg"
        data-testid="risk-adjusted-display-empty"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-ink-400" aria-hidden="true" />
          <span className={`${typography.caption} text-ink-500`}>
            Set your risk tolerance to see personalised outcome expectations
          </span>
        </div>
      </div>
    )
  }

  // Compact mode - just the key value
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${styles.bgColor} ${styles.borderColor}`}
        data-testid="risk-adjusted-display-compact"
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${styles.textColor}`} aria-hidden="true" />
          <span className={`${typography.caption} ${styles.textColor}`}>
            {adjusted.label}
          </span>
        </div>
        <span className={`${typography.body} font-semibold ${styles.textColor}`}>
          {formatOutcomeValue(adjusted.adjustedValue, units, unitSymbol)}
        </span>
      </div>
    )
  }

  // Full display
  return (
    <div
      className={`rounded-lg border overflow-hidden ${styles.borderColor}`}
      data-testid="risk-adjusted-display"
    >
      {/* Header with profile indicator */}
      <div className={`px-4 py-3 ${styles.bgColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${styles.textColor}`} aria-hidden="true" />
          <span className={`${typography.label} ${styles.textColor}`}>
            Risk-Adjusted View
          </span>
        </div>
        {showProfileBadge && (
          <RiskProfileInline profile={profile} className={styles.accentColor} />
        )}
      </div>

      {/* Main content */}
      <div className="px-4 py-4 bg-white space-y-4">
        {/* Key message */}
        <p className={`${typography.body} ${styles.textColor}`}>
          {message}
        </p>

        {/* Planning range */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`${typography.caption} text-ink-500`}>
              {adjusted.planningLabel}
            </span>
            <span className={`${typography.body} font-medium ${styles.textColor}`}>
              {formatOutcomeValueCompact(adjusted.planningRange.low, units, unitSymbol)} – {formatOutcomeValueCompact(adjusted.planningRange.high, units, unitSymbol)}
            </span>
          </div>

          {/* Range visualization with emphasis */}
          <div className="relative h-3 bg-sand-100 rounded-full overflow-hidden">
            {/* Background range */}
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className={`${typography.caption} text-ink-400`}>
                {formatOutcomeValueCompact(bands.p10, units, unitSymbol)}
              </span>
              <span className={`${typography.caption} text-ink-400`}>
                {formatOutcomeValueCompact(bands.p90, units, unitSymbol)}
              </span>
            </div>

            {/* Emphasised region based on risk profile */}
            <div
              className={`absolute inset-y-0 ${styles.bgColor} opacity-80 rounded-full`}
              style={{
                left: emphasisBand === 'p10' ? '0%' : emphasisBand === 'p50' ? '30%' : '60%',
                right: emphasisBand === 'p10' ? '60%' : emphasisBand === 'p50' ? '30%' : '0%',
              }}
            />

            {/* Focus point */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow ${
                emphasisBand === 'p10'
                  ? 'bg-sky-500 left-[10%]'
                  : emphasisBand === 'p50'
                  ? 'bg-sand-500 left-[50%]'
                  : 'bg-carrot-500 left-[90%]'
              }`}
              style={{ transform: 'translate(-50%, -50%)' }}
            />
          </div>
        </div>

        {/* Recommendation */}
        <div className={`flex items-start gap-2 p-2 rounded ${styles.bgColor}`}>
          <AlertTriangle className={`h-4 w-4 ${styles.textColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
          <span className={`${typography.caption} ${styles.textColor}`}>
            {adjusted.recommendation}
          </span>
        </div>

        {/* Description */}
        <p className={`${typography.caption} text-ink-500`}>
          {adjusted.description}
        </p>
      </div>
    </div>
  )
})
