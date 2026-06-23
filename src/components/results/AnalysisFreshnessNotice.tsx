/**
 * AnalysisFreshnessNotice — cautious freshness/staleness messaging for the
 * Analysis results path.
 *
 * Renders CEE's `analysis_ready.freshness` verdict (held in the `analysisFreshness`
 * store slice) as one of four non-scientific lines. It reads the slice directly
 * (a `state` prop overrides it for tests/stories). When the slice is unset it
 * renders nothing — it never asserts a freshness state we don't have.
 *
 * Source rules live in the slice reducer (retain / order-by-computed_at /
 * never-absence→fresh). This component is display-only: it does NOT use
 * v5AnalysisFact, useStaleGuard, or any local graph-hash computation, and it
 * never shows the technical reason/hash fields as copy (they ride on data-*).
 */
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import { useCanvasStore } from '@/canvas/store'
import { typography } from '@/styles/typography'
import type {
  AnalysisFreshnessState,
  AnalysisFreshnessValue,
} from '@/canvas/store/analysisFreshness'

/** Cautious, non-scientific copy. One short line per state. */
export const FRESHNESS_COPY: Record<AnalysisFreshnessValue, string> = {
  fresh: 'Analysis reflects the current model.',
  stale: 'Model changed since this analysis. Re-run to update.',
  unknown: 'Cannot confirm whether this analysis is current.',
  none: 'No analysis yet.',
}

const ICON: Record<AnalysisFreshnessValue, typeof AlertTriangle> = {
  fresh: CheckCircle2,
  stale: AlertTriangle,
  unknown: HelpCircle,
  none: HelpCircle,
}

export interface AnalysisFreshnessNoticeProps {
  /** Override the store slice (tests / Storybook). `undefined` → read the store. */
  state?: AnalysisFreshnessState | null
  className?: string
}

export function AnalysisFreshnessNotice({ state: stateProp, className = '' }: AnalysisFreshnessNoticeProps) {
  const storeState = useCanvasStore((s) => s.analysisFreshness)
  const state = stateProp !== undefined ? stateProp : storeState

  // No verdict yet → no notice (never claim a freshness state we don't hold).
  if (!state) return null

  const { freshness } = state
  const isStale = freshness === 'stale'
  const Icon = ICON[freshness]

  return (
    <div
      data-testid="analysis-freshness-notice"
      data-freshness={freshness}
      data-freshness-reason={state.freshnessReason}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 bg-panel ${isStale ? 'border-warning/30' : 'border-panel-border'} ${className}`.trim()}
    >
      <Icon
        size={14}
        className={`flex-none ${isStale ? 'text-warning' : 'text-text-light'}`}
        aria-hidden="true"
      />
      <span className={`${typography.panelBody} text-text-body`}>{FRESHNESS_COPY[freshness]}</span>
    </div>
  )
}

export default AnalysisFreshnessNotice
