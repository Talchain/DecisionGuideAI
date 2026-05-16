import { memo, useCallback, useEffect, useState } from 'react'
import { BarChart3, Shuffle, Activity } from 'lucide-react'
import { useUIStore, type OutputTab } from '../../stores/uiStore'
import {
  ANALYSIS_TAB_STRIP_WIDTH,
  Z_ANALYSIS_OVERLAY,
  Z_ANALYSIS_SCRIM,
} from './constants'

// Brief §4.5 / step 13 — at 1440–1599px viewports in Focus mode the
// dock is visually replaced by a 48px vertical tab strip. Clicking a tab
// expands the real OutputsDock back to 400px as a temporary right-anchored
// overlay and switches it to the selected tab. Outside-click / Escape closes
// the overlay by collapsing the dock back to the strip width.

type TabId = 'results' | 'compare' | 'diagnostics'

interface AnalysisTabStripOverlayProps {
  active: boolean
  /** Called when the user opens / closes a tab. The parent toggles
   *  OutputsDock visibility based on this. */
  onActiveTabChange?: (tabId: TabId | null) => void
}

const TABS: { id: TabId; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'results', label: 'Analysis', Icon: BarChart3 },
  { id: 'compare', label: 'Compare', Icon: Shuffle },
  { id: 'diagnostics', label: 'Model', Icon: Activity },
]

export const AnalysisTabStripOverlay = memo(function AnalysisTabStripOverlay({
  active,
  onActiveTabChange,
}: AnalysisTabStripOverlayProps) {
  const [openTab, setOpenTab] = useState<TabId | null>(null)

  // Reset when the overlay deactivates.
  useEffect(() => {
    if (!active && openTab !== null) {
      setOpenTab(null)
      onActiveTabChange?.(null)
    }
  }, [active, openTab, onActiveTabChange])

  const handleTabClick = useCallback((tabId: TabId) => {
    setOpenTab(prev => {
      const next = prev === tabId ? null : tabId
      if (next !== null) {
        useUIStore.getState().setActiveOutputTab(next as OutputTab)
        useUIStore.getState().openRightPanel('results')
      }
      onActiveTabChange?.(next)
      return next
    })
  }, [onActiveTabChange])

  const handleClose = useCallback(() => {
    setOpenTab(null)
    onActiveTabChange?.(null)
  }, [onActiveTabChange])

  // Escape closes the overlay (correction #13: only when open).
  useEffect(() => {
    if (openTab === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      handleClose()
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true } as AddEventListenerOptions)
  }, [openTab, handleClose])

  if (!active) return null

  return (
    <>
      {/* Vertical tab strip — 48px wide, fixed at right:12, top:12 to
          bottom:bottombar+1rem. Sits ABOVE OutputsDock so the dock is
          visually replaced. */}
      <nav
        data-testid="ai-panel-v2-tab-strip"
        aria-label="Analysis tabs"
        className="flex flex-col items-center gap-2 py-3 bg-panel border border-panel-border rounded-2xl shadow-1"
        style={{
          position: 'fixed',
          right: 12,
          top: 12,
          bottom: 'calc(var(--bottombar-h, 0px) + 1rem)',
          width: ANALYSIS_TAB_STRIP_WIDTH,
          zIndex: Z_ANALYSIS_OVERLAY,
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = openTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabClick(id)}
              aria-label={label}
              aria-pressed={isActive}
              title={label}
              className={[
                'flex items-center justify-center w-7 h-7 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
                isActive
                  ? 'text-info border-info bg-info/10'
                  : 'text-text-light border-panel-border hover:text-text-body hover:border-text-light',
              ].join(' ')}
              data-testid={`ai-panel-v2-tab-${id}`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )
        })}
      </nav>

      {/* Click-outside scrim. It sits below OutputsDock so the expanded
          dock remains interactive, but above the canvas for outside-close. */}
      {openTab !== null && (
        <div
          data-testid="ai-panel-v2-tab-strip-scrim"
          onClick={handleClose}
          className="fixed inset-0 bg-transparent"
          style={{ zIndex: Z_ANALYSIS_SCRIM }}
          aria-hidden="true"
        />
      )}
    </>
  )
})
