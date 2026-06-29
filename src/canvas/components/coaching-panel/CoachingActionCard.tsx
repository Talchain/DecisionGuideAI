/**
 * CoachingActionCard — the single reusable coaching row.
 *
 * Collapsed: entity shape + the observation as the primary line (clamped to one
 * line). There is NO invented title — with no `display_title` in the envelope,
 * `grounding.observation` is the line (UX amendment 4; `display_title` is a
 * future wire requirement). Expanded: reveals the coaching moment.
 *
 * Accessible disclosure (WAI-ARIA): the header is a native button carrying
 * aria-expanded + aria-controls and is named by the observation; the expanded
 * region is mounted only when open, labelled by the observation, and is a
 * `region`. Controlled by the parent so the list can keep one row open at a time.
 *
 * Technical fields (signal_id, move, source) ride on data-* attributes for
 * traceability/tests only — never rendered as prose (UX amendment 3).
 */
import { useId, type CSSProperties } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { typography } from '@/styles/typography'
import { EntityTarget } from './EntityTarget'
import { CoachingMoment } from './CoachingMoment'
import { COACHING_COPY } from './constants'
import type { CoachingSignal } from './types'

interface CoachingActionCardProps {
  signal: CoachingSignal
  isOpen: boolean
  onToggle: () => void
}

export function CoachingActionCard({ signal, isOpen, onToggle }: CoachingActionCardProps) {
  const regionId = useId()
  const labelId = useId()
  const Chevron = isOpen ? ChevronDown : ChevronRight
  const observation = signal.grounding?.observation ?? ''
  const hasObservation = observation.trim().length > 0

  // One-line clamp when collapsed; full text when open. Inline style avoids
  // depending on the Tailwind line-clamp plugin (mirrors ExpandableCoachingText).
  const clampStyle: CSSProperties | undefined = isOpen
    ? undefined
    : {
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }

  return (
    <div
      className="overflow-hidden rounded-xl border border-panel-border bg-panel"
      data-testid="coaching-card"
      data-signal-id={signal.signal_id}
      data-move={signal.move}
      data-source={signal.source}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={regionId}
        // Name comes from the observation text; fall back to a generic label
        // only when there is no observation, so the control is always operable.
        aria-label={hasObservation ? undefined : COACHING_COPY.itemFallback}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset"
      >
        <span className="mt-0.5 flex-none">
          <EntityTarget targetKind={signal.target_kind} />
        </span>
        <span
          id={labelId}
          className={`${typography.panelBody} min-w-0 flex-1 text-text-body`}
          style={clampStyle}
        >
          {observation}
        </span>
        <Chevron className="mt-0.5 h-4 w-4 flex-none text-text-light" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={regionId}
          role="region"
          // Label the region by the observation when present; otherwise a
          // generic name (an empty labelledby reference would fail a11y).
          {...(hasObservation ? { 'aria-labelledby': labelId } : { 'aria-label': COACHING_COPY.itemFallback })}
          className="border-t border-panel-border px-3 pb-3 pt-1"
          data-testid="coaching-card-body"
        >
          <CoachingMoment signal={signal} />
        </div>
      )}
    </div>
  )
}

export default CoachingActionCard
