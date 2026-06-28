/**
 * CoachingPanel — render-only coaching surface (Phase 0).
 *
 * Pure presentational: it renders the coaching envelope it is given and owns no
 * data, no network, no storage, and (deliberately) no feature flag — a flag has
 * no effect on an unmounted, Storybook/tests-only component, so it is deferred
 * to the later mount PR (UX amendment 2). The future mount (Analysis tab) will
 * flag-gate this component and swap the fixture feed for the live envelope.
 *
 * Renders, in order: an optional fixture-only stale banner, the orientation
 * summary line (verbatim, omitted when absent — never synthesised), and either
 * a neutral empty state or the signal list (in received order). All model
 * strings render as TEXT — never HTML.
 */
import { typography } from '@/styles/typography'
import { CoachingList } from './CoachingList'
import { StaleBanner } from './StaleBanner'
import { COACHING_COPY } from './constants'
import type { Coaching } from './types'

export interface CoachingPanelProps {
  coaching?: Coaching | null
  /**
   * Fixture-only: render the panel-level stale banner. There is no live
   * staleness data this phase; the UI never derives it (F.6).
   */
  showStaleBanner?: boolean
  className?: string
}

export function CoachingPanel({ coaching, showStaleBanner = false, className = '' }: CoachingPanelProps) {
  const signals = coaching?.signals ?? []

  return (
    <section
      aria-label={COACHING_COPY.panelAria}
      data-testid="coaching-panel"
      className={`flex flex-col gap-3 ${className}`}
    >
      {showStaleBanner && <StaleBanner />}

      {coaching?.summary && (
        <p className={`${typography.panelBody} text-text-body`} data-testid="coaching-summary">
          {coaching.summary}
        </p>
      )}

      {signals.length === 0 ? (
        <p className={`${typography.panelBody} text-text-light`} data-testid="coaching-empty">
          {COACHING_COPY.emptyState}
        </p>
      ) : (
        <CoachingList signals={signals} />
      )}
    </section>
  )
}

export default CoachingPanel
