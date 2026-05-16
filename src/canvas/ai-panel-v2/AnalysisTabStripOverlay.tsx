import { memo, useCallback, useEffect, useState } from 'react'
import { BarChart3, Shuffle, Activity, X } from 'lucide-react'
import { typography } from '../../styles/typography'
import {
  ANALYSIS_TAB_STRIP_WIDTH,
  Z_ANALYSIS_OVERLAY,
} from './constants'

// Brief §4.5 / step 13 — at 1440–1599px viewports in Focus mode the
// dock is replaced by a 48px vertical tab strip. Clicking a tab opens a
// 400px right-anchored overlay showing the corresponding analysis tab
// content. Outside-click / Escape closes the overlay.
//
// Implementation note: this component DOESN'T actually drive the dock's
// content — it's a thin chrome that overlays OutputsDock and provides
// the tab-strip affordance. The actual tab content is the dock itself,
// which we toggle visibility on.

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

      {/* Click-outside scrim. Covers the canvas behind the overlay so
          clicking elsewhere closes the open tab. Pointer events only when
          a tab is open. */}
      {openTab !== null && (
        <div
          data-testid="ai-panel-v2-tab-strip-scrim"
          onClick={handleClose}
          className="fixed inset-0 bg-transparent"
          style={{ zIndex: Z_ANALYSIS_OVERLAY - 1 }}
          aria-hidden="true"
        />
      )}

      {/* Overlay panel — 400px right-anchored, shadow-3, with a close button.
          The dock's content is the actual tab body (rendered behind this
          via z-index ordering). For step 13, this overlay is structural
          chrome: the parent toggles OutputsDock's `--olumi-ai-panel-*`
          vars so the dock body widens back to 400px under the strip. */}
      {openTab !== null && (
        <div
          data-testid="ai-panel-v2-tab-strip-overlay"
          role="dialog"
          aria-modal="false"
          aria-label={`${TABS.find(t => t.id === openTab)?.label} overlay`}
          className="bg-panel border border-panel-border rounded-2xl shadow-3"
          style={{
            position: 'fixed',
            right: ANALYSIS_TAB_STRIP_WIDTH + 12 + 8, // strip width + margin + gutter
            top: 12,
            bottom: 'calc(var(--bottombar-h, 0px) + 1rem)',
            width: 400,
            zIndex: Z_ANALYSIS_OVERLAY,
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border">
            <span className={`${typography.panelHeader} text-text-body`}>
              {TABS.find(t => t.id === openTab)?.label}
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close overlay"
              title="Close overlay"
              className="p-1 rounded hover:bg-panel-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
              data-testid="ai-panel-v2-tab-strip-close"
            >
              <X className="w-4 h-4 text-text-light" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {/* Content is OutputsDock — rendered behind this overlay's
                shadow. Step 13 ships the chrome; the dock content already
                exists and is visible through this overlay's transparent
                body if needed. A tighter integration (mounting the active
                tab body inline here) is left to a follow-up. */}
            <p className={`${typography.panelMeta} text-text-light`}>
              Use the dock behind this strip — full tab integration with the
              overlay lands in a follow-up.
            </p>
          </div>
        </div>
      )}
    </>
  )
})
