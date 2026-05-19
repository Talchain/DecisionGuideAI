import { memo, useCallback } from 'react'
import { typo } from '../../styles/typography'
import { useStaleGuard } from '../ui/inspector-v2/useStaleGuard'
import { useV2Run } from '../hooks/useV2Run'

/**
 * StaleAnalysisBadge — "Analysis stale · Rerun" above the persistent input
 * strip when the graph hash has diverged from the last analysis hash.
 * Clicking "Rerun" triggers a fresh analysis run.
 */
export const StaleAnalysisBadge = memo(function StaleAnalysisBadge() {
  const { isStale } = useStaleGuard()
  const { runV2Analysis } = useV2Run()

  const handleRerun = useCallback(() => {
    void runV2Analysis()
  }, [runV2Analysis])

  if (!isStale) return null

  return (
    <div
      className="px-3 py-1 flex items-center gap-1.5"
      data-testid="ai-panel-stale-badge"
      role="status"
      aria-live="polite"
    >
      <span className={typo('panelMeta', 'text-warning')}>Analysis stale</span>
      <span className={typo('panelMeta', 'text-text-light')}>·</span>
      <button
        type="button"
        onClick={handleRerun}
        className={typo('panelMeta', 'text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded px-0.5')}
        data-testid="ai-panel-stale-badge-rerun"
      >
        Rerun
      </button>
    </div>
  )
})
