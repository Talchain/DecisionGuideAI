/**
 * EvidenceGapBadge — small "?" indicator on factor nodes with no observed data.
 *
 * Positioned absolute bottom-right of the FactorNode outer wrapper, below the
 * existing NodeBadge system which occupies top-right inside BaseNode.
 *
 * The visual badge is pointer-events-none so it never intercepts node drag/click.
 * A slightly larger transparent hover zone sits on top to make the native title
 * tooltip accessible on hover without interfering with drag.
 *
 * Feature-gated by VITE_FEATURE_GRAPH_BADGES / localStorage['feature.graphBadges'].
 *
 * Post-analysis escalation (A.9): when the factor has high VoI, the badge
 * escalates visually (colour shift + pulse animation). The pulse respects
 * prefers-reduced-motion per DS v5 §7.6.
 */

import { memo } from 'react'

export type EvidenceGapEscalation = 'none' | 'warning' | 'critical'

interface EvidenceGapBadgeProps {
  /** Human-readable label of the factor, used in the accessible tooltip. */
  label: string
  /** Post-analysis escalation level based on VoI. Default 'none'. */
  escalation?: EvidenceGapEscalation
}

/** Border + text colour classes by escalation level */
const ESCALATION_STYLES: Record<EvidenceGapEscalation, { border: string; text: string; bg: string }> = {
  none:     { border: 'border-warning/50', text: 'text-warning', bg: 'bg-panel' },
  warning:  { border: 'border-warning',    text: 'text-warning', bg: 'bg-warning-light' },
  critical: { border: 'border-danger',     text: 'text-danger',  bg: 'bg-danger-light' },
}

const ESCALATION_TOOLTIP: Record<EvidenceGapEscalation, string> = {
  none:     'Setting a value would strengthen the analysis.',
  warning:  'High investigation value — gathering evidence here would improve the analysis.',
  critical: 'Critical evidence gap — this is a top factor where better data could change the result.',
}

/**
 * 12px circle badge indicating the factor has no observed data.
 * Appears at bottom-right of the FactorNode outer wrapper.
 */
export const EvidenceGapBadge = memo(function EvidenceGapBadge({
  label,
  escalation = 'none',
}: EvidenceGapBadgeProps) {
  const tooltip = `No observed data for "${label}". ${ESCALATION_TOOLTIP[escalation]}`
  const styles = ESCALATION_STYLES[escalation]
  const shouldPulse = escalation !== 'none'

  return (
    <>
      {/* Visual badge — pointer-events-none for drag safety */}
      <div
        className={`absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full border ${styles.border} ${styles.bg}
          flex items-center justify-center pointer-events-none${shouldPulse ? ' evidence-gap-pulse' : ''}`}
        style={{ zIndex: 1 }}
        aria-hidden="true"
        data-testid="evidence-gap-badge"
      >
        <span
          className={`${styles.text} font-bold leading-none select-none`}
          style={{ fontSize: '7px' }}
          aria-hidden="true"
        >
          ?
        </span>
      </div>
      {/* Transparent hover zone — carries tooltip and accessible label */}
      <div
        className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full"
        style={{ zIndex: 2 }}
        title={tooltip}
        aria-label={tooltip}
        data-testid="evidence-gap-badge-hover"
      />
    </>
  )
})
