import { memo, useCallback } from 'react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { resolveDisplayedFreshness } from '../store/analysisFreshness'
import { useV2Run } from '../hooks/useV2Run'

/**
 * StaleAnalysisBadge — "Analysis stale · Rerun" above the persistent input strip,
 * shown only when the CEE analysis verdict is genuinely 'stale'. Clicking "Rerun"
 * triggers a fresh analysis run.
 *
 * Source of truth is the CEE freshness verdict + local dirty overlay
 * (resolveDisplayedFreshness), NOT the legacy useStaleGuard graph-hash path
 * (_internal.graphHash is never written, so it could never fire). The badge appears
 * ONLY on a real CEE 'stale' verdict — the overlay can only downgrade a retained
 * fresh → 'unknown' (cannot-confirm), never to 'stale', so this copy is never
 * fabricated. The cannot-confirm state is surfaced on the Results surface instead.
 */
export const StaleAnalysisBadge = memo(function StaleAnalysisBadge() {
  const ceeFreshness = useCanvasStore(s => s.analysisFreshness)
  const freshnessDirty = useCanvasStore(s => s.analysisFreshnessDirty)
  const displayedFreshness = resolveDisplayedFreshness(ceeFreshness, freshnessDirty)
  const { runV2Analysis } = useV2Run()

  const handleRerun = useCallback(() => {
    void runV2Analysis()
  }, [runV2Analysis])

  if (displayedFreshness !== 'stale') return null

  return (
    <div
      className="px-3 py-1 flex items-center gap-1.5"
      data-testid="ai-panel-stale-badge"
      role="status"
      aria-live="polite"
    >
      <span className={typo('panelMeta', 'text-warning')}>Analysis stale</span>
      <span className={typo('panelMeta', 'text-text-light')} aria-hidden="true">·</span>
      <button
        type="button"
        onClick={handleRerun}
        aria-label="Rerun analysis"
        className={typo('panelMeta', 'text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded px-0.5')}
        data-testid="ai-panel-stale-badge-rerun"
      >
        Rerun
      </button>
    </div>
  )
})
