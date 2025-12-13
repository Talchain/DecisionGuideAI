/**
 * RiskProfileBadge - Compact badge showing active risk profile
 *
 * Displays the current risk tolerance setting with:
 * - Icon indicator (🛡️ / ⚖️ / 🎲)
 * - Profile label
 * - Click to edit functionality
 */

import { memo } from 'react'
import { Settings2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { RiskProfile, RiskProfilePreset } from '../../adapters/plot/types'

export interface RiskProfileBadgeProps {
  /** Current risk profile (null if not set) */
  profile: RiskProfile | null
  /** Called when user wants to change profile */
  onEdit?: () => void
  /** Compact mode - just icon and short label */
  compact?: boolean
  /** Custom className */
  className?: string
}

/** Profile icons by preset type */
const PROFILE_ICONS: Record<RiskProfilePreset, string> = {
  risk_averse: '🛡️',
  neutral: '⚖️',
  risk_seeking: '🎲',
}

/** Profile colors by preset type */
const PROFILE_COLORS: Record<RiskProfilePreset, { bg: string; text: string; border: string }> = {
  risk_averse: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
  neutral: {
    bg: 'bg-sand-50',
    text: 'text-sand-700',
    border: 'border-sand-200',
  },
  risk_seeking: {
    bg: 'bg-carrot-50',
    text: 'text-carrot-700',
    border: 'border-carrot-200',
  },
}

/** Short labels for compact mode */
const SHORT_LABELS: Record<RiskProfilePreset, string> = {
  risk_averse: 'Cautious',
  neutral: 'Balanced',
  risk_seeking: 'Bold',
}

export const RiskProfileBadge = memo(function RiskProfileBadge({
  profile,
  onEdit,
  compact = false,
  className = '',
}: RiskProfileBadgeProps) {
  // Not set state
  if (!profile) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          border border-dashed border-sand-300 bg-white
          text-ink-500 hover:text-ink-700 hover:border-sand-400
          transition-colors ${className}`}
        aria-label="Set risk tolerance"
        data-testid="risk-profile-badge-empty"
      >
        <Settings2 className="w-4 h-4" aria-hidden="true" />
        <span className={typography.caption}>Set risk tolerance</span>
      </button>
    )
  }

  const colors = PROFILE_COLORS[profile.profile]
  const icon = PROFILE_ICONS[profile.profile]
  const label = compact ? SHORT_LABELS[profile.profile] : profile.label

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
        border ${colors.border} ${colors.bg}
        ${colors.text} hover:opacity-90
        transition-opacity ${className}`}
      aria-label={`Risk tolerance: ${profile.label}. Click to change.`}
      data-testid="risk-profile-badge"
    >
      <span aria-hidden="true">{icon}</span>
      <span className={`${typography.caption} font-medium`}>{label}</span>
    </button>
  )
})

/**
 * RiskProfileInline - Even more compact inline display
 * For use in tight spaces like table cells or inline text
 */
export const RiskProfileInline = memo(function RiskProfileInline({
  profile,
  className = '',
}: {
  profile: RiskProfile | null
  className?: string
}) {
  if (!profile) {
    return (
      <span className={`${typography.caption} text-ink-400 ${className}`}>
        Not set
      </span>
    )
  }

  const icon = PROFILE_ICONS[profile.profile]
  const shortLabel = SHORT_LABELS[profile.profile]

  return (
    <span
      className={`inline-flex items-center gap-1 ${typography.caption} ${className}`}
      title={`${profile.label}: ${profile.reasoning}`}
      data-testid="risk-profile-inline"
    >
      <span aria-hidden="true">{icon}</span>
      <span>{shortLabel}</span>
    </span>
  )
})
