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
      {/* The hover zone — and the ONLY thing that carries this badge's meaning.
          ⚠ `aria-label` ON A BARE `<div>` IS DISCARDED. A `div` with no role
          maps to `role="generic"`, and ARIA forbids a name on a generic
          element — so screen readers dropped this label entirely and the badge
          was, to them, absent. The comment above this said "carries tooltip and
          accessible label"; measured on the deployed build, it carried the
          tooltip only. `role="img"` is the smallest thing that makes a name
          valid here, and it is the honest role: this IS a graphic conveying
          meaning, not a control — there is nothing to activate.
          ⚠ AND THE MEANING WAS MOUSE-ONLY. `title` needs hover, which touch
          does not have, so the escalation ("critical evidence gap — better data
          could change the result") reached only users with a pointer, on a 20px
          transparent target. `tabIndex={0}` puts it in the tab order so a
          keyboard user reaches it and the name is announced; the focus ring is
          what stops that being an invisible stop.
          ⛔ Deliberately NOT a `<button>`. There is no action behind it, and a
          control that does nothing when pressed is worse than a graphic. */}
      <div
        className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full outline-none
          focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
        style={{ zIndex: 2 }}
        role="img"
        tabIndex={0}
        title={tooltip}
        aria-label={tooltip}
        data-testid="evidence-gap-badge-hover"
      />
    </>
  )
})
