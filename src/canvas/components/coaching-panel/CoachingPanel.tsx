/**
 * CoachingPanel — render-only coaching surface (Phase 0).
 *
 * Pure presentational: it renders the coaching envelope it is given and owns no
 * data, no network, no storage, and (deliberately) no feature flag — a flag has
 * no effect on an unmounted, Storybook/tests-only component, so it is deferred
 * to the later mount PR (UX amendment 2). The future mount (Analysis tab) will
 * flag-gate this component and swap the fixture feed for the live envelope.
 *
 * Renders, in order: an optional fixture-only stale banner, the run-state
 * treatment when a run is in flight (F9 — banner over retained coaching,
 * skeleton when there is none; run state arrives as PROPS so this body stays
 * store-free and the mount decides the wiring), the orientation summary line
 * (verbatim, omitted when absent — never synthesised), and either a neutral
 * empty state or the signal list (in received order). While a run is in
 * flight the empty state is suppressed: "no coaching to show" is a settled
 * answer this surface does not hold mid-run. All model strings render as
 * TEXT — never HTML.
 */
import { typography } from '@/styles/typography'
import { AnalysisRunStateCover } from '../AnalysisRunStateCover'
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
  /**
   * F9: an analysis run is in flight. The mount supplies this from
   * useAnalysisTrust().isRunning — the panel itself stays store-free.
   */
  isRunning?: boolean
  /** F9: the run's true start clock (useAnalysisTrust().runStartedAt). */
  runStartedAt?: number
  className?: string
}

export function CoachingPanel({
  coaching,
  showStaleBanner = false,
  isRunning = false,
  runStartedAt,
  className = '',
}: CoachingPanelProps) {
  const signals = coaching?.signals ?? []
  const hasRetainedContent = signals.length > 0 || Boolean(coaching?.summary)

  return (
    <section
      aria-label={COACHING_COPY.panelAria}
      data-testid="coaching-panel"
      className={`flex flex-col gap-3 ${className}`}
      aria-busy={isRunning || undefined}
    >
      {showStaleBanner && <StaleBanner />}

      {isRunning && (
        <AnalysisRunStateCover
          isRunning
          startedAt={runStartedAt}
          contentRetained={hasRetainedContent}
        />
      )}

      {coaching?.summary && (
        <p className={`${typography.panelBody} text-text-body`} data-testid="coaching-summary">
          {coaching.summary}
        </p>
      )}

      {signals.length === 0 ? (
        isRunning ? null : (
          <p className={`${typography.panelBody} text-text-light`} data-testid="coaching-empty">
            {COACHING_COPY.emptyState}
          </p>
        )
      ) : (
        <CoachingList signals={signals} />
      )}
    </section>
  )
}

export default CoachingPanel
