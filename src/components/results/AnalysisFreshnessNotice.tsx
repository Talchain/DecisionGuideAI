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
import {
  resolveDisplayedFreshness,
  type AnalysisFreshnessState,
  type AnalysisFreshnessValue,
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
  /** Override the local dirty overlay (tests / Storybook). `undefined` → read the store. */
  dirty?: boolean
  className?: string
}

export function AnalysisFreshnessNotice({ state: stateProp, dirty: dirtyProp, className = '' }: AnalysisFreshnessNoticeProps) {
  const storeState = useCanvasStore((s) => s.analysisFreshness)
  const storeDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const state = stateProp !== undefined ? stateProp : storeState
  const dirty = dirtyProp !== undefined ? dirtyProp : storeDirty

  // No verdict yet → no notice (never claim a freshness state we don't hold).
  if (!state) return null

  // CEE verdict is the source of truth; the local dirty overlay may only
  // downgrade a retained 'fresh' to cannot-confirm (never fabricate 'stale').
  const freshness = resolveDisplayedFreshness(state, dirty) as AnalysisFreshnessValue
  const isStale = freshness === 'stale'
  const Icon = ICON[freshness]
  // Mark when the displayed verdict differs from CEE's because of a local edit —
  // technical signal for tests/debug only, not user copy.
  const downgraded = state.freshness === 'fresh' && freshness === 'unknown'

  return (
    <div
      data-testid="analysis-freshness-notice"
      data-freshness={freshness}
      data-cee-freshness={state.freshness}
      data-freshness-dirty={downgraded ? 'true' : undefined}
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
