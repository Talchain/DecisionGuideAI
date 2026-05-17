import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './panelTypography.css'
import { AIZone } from './AIZone'
import { AnalysisTabStripOverlay } from './AnalysisTabStripOverlay'
import { PullTab } from './PullTab'
import { OutputsDock } from '../components/OutputsDock'
import { useConversation } from '../conversation/useConversation'
import { usePanelSplit } from './hooks/usePanelSplit'
import { useFocusColumn } from './hooks/useFocusColumn'
import { useSelectionContext } from './hooks/useSelectionContext'
import { useStaleGuard } from '../ui/inspector-v2/useStaleGuard'
import {
  AI_PANEL_V2_WIDTH,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  FOCUS_FULL_VIEWPORT,
  FOCUS_MIN_VIEWPORT,
  Z_AI_PANEL_BASE,
  Z_FOCUS_COLUMN,
} from './constants'
// Right-edge AI panel — single container, two zones.
//
//   Compact / Conversation:
//     • Outer column-flex container fixed to the right edge of viewport
//     • Top zone:  <OutputsDock embedded />  (analysis surface)
//     • Bottom zone: <AIZone />              (AI conversation)
//     • Split ratio driven by usePanelSplit; PullTab on the boundary
//
//   Focus:
//     • OutputsDock keeps its top-right position (full height)
//     • AIZone detaches as a left-of-dock column controlled by useFocusColumn
//     • PullTab still anchors at AIZone's top edge
//
// AIZone owns the singleton useConversation() instance (correction #9).
// OutputsDock is mounted EXACTLY ONCE inside this layout, sharing state
// across mode toggles — it does NOT mount/unmount on Compact↔Focus.

const PANEL_RIGHT_MARGIN = 12
const PANEL_BOTTOM_OFFSET_CSS = 'calc(var(--bottombar-h, 0px) + 1rem)'
const PULL_TAB_DRAG_BAND_HEIGHT = 16

export function AIPanelV2Layout() {
  // Singleton useConversation() for the entire AI panel v2 surface.
  //
  // ── Architecture deviation from the literal brief ───────────────────
  // The approved plan's correction #9 said "useConversation() is called
  // exactly once at the top of AIZone". The brief's intent was the
  // singleton invariant — ONE instance — not the literal location. With
  // the Fix 1 restructure (AIPanelV2Layout owning both zones), the hook
  // moved one level up so the SAME instance can be threaded into both
  // the embedded OutputsDock (for its pre-analysis chip-fires) and
  // AIZone (the main chat surface). The invariant is preserved: exactly
  // one useConversation() across the panel-v2 tree (asserted by
  // SingletonInvariant.spec.tsx). Tests + close-out reference the
  // invariant by name ("single conversation instance") rather than the
  // call site.
  //
  // FF off renders neither — OutputsDock calls its own useConversation
  // in OutputsDockStandaloneHost.
  const conversation = useConversation()

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1600 : window.innerWidth,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Sentinel measures the vertical budget honestly so pixel clamps
  // respect the actual usable height (viewport minus top/bottom chrome).
  const measureRef = useRef<HTMLDivElement>(null)
  const [availableHeightPx, setAvailableHeightPx] = useState(0)
  useLayoutEffect(() => {
    if (!measureRef.current || typeof ResizeObserver === 'undefined') return
    const el = measureRef.current
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = entry.contentRect.height
        if (h > 0) setAvailableHeightPx(h)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const getPanelHeight = useCallback(() => availableHeightPx, [availableHeightPx])

  const { aiRatio, activeMode, isDragging, startDrag, setMode, adjustByPx } = usePanelSplit({
    getPanelHeight,
  })

  const handleFocusExit = useCallback(() => setMode('compact'), [setMode])
  const { width: focusWidth, isResizing: isFocusResizing, startLeftEdgeResize, startRightEdgeResize } = useFocusColumn({
    onExit: handleFocusExit,
  })

  const isFocus = activeMode === 'focus'
  const tabStripMode = isFocus && viewportWidth >= FOCUS_MIN_VIEWPORT && viewportWidth < FOCUS_FULL_VIEWPORT
  const [openAnalysisOverlayTab, setOpenAnalysisOverlayTab] = useState<string | null>(null)

  useEffect(() => {
    if (!tabStripMode && openAnalysisOverlayTab !== null) {
      setOpenAnalysisOverlayTab(null)
    }
  }, [tabStripMode, openAnalysisOverlayTab])

  const { hasSelection, borderClass: selectionBorder } = useSelectionContext()
  const { isStale } = useStaleGuard()
  const tintBorderClass = useMemo(() => {
    if (hasSelection) return selectionBorder
    if (isStale) return 'border-warning'
    return 'border-default'
  }, [hasSelection, selectionBorder, isStale])

  // AI-zone pixel height (Compact/Conv only).
  const aiHeightPx = availableHeightPx > 0
    ? Math.max(
        AI_ZONE_MIN_HEIGHT,
        Math.min(availableHeightPx - ANALYSIS_ZONE_MIN_HEIGHT, availableHeightPx * aiRatio),
      )
    : AI_ZONE_MIN_HEIGHT
  const analysisHeightPx = availableHeightPx > 0 ? availableHeightPx - aiHeightPx : 0

  // ── Compact / Conversation: AI zone pinned at bottom, dock above ──
  // ── Focus: AI zone detaches as a separate column LEFT of dock ──
  //
  // The two zones are independent fixed-positioned siblings (not a
  // single shared container) so OutputsDock retains its mounted React
  // tree across mode toggles. Their bounds are coordinated to look like
  // a single split column — see the position math below.

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: PANEL_RIGHT_MARGIN,
          bottom: PANEL_BOTTOM_OFFSET_CSS,
          right: -9999,
          width: 1,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />

      {/* ── Analysis zone (top in Compact/Conv; right column in Focus) ─
          In 1440-1599 tab-strip mode, hide the analysis zone while no
          tab is open — the 48px strip is the only visible analysis
          chrome. Clicking a tab re-shows the full dock as an overlay.
          In Focus mode the zone runs top to bottom (top + bottom
          positioning; no explicit height needed). */}
      <aside
        data-testid="ai-panel-v2-analysis-zone"
        aria-label="Analysis"
        className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
        style={{
          position: 'fixed',
          top: PANEL_RIGHT_MARGIN,
          right: PANEL_RIGHT_MARGIN,
          width: AI_PANEL_V2_WIDTH,
          // Compact/Conv: height = budget − ai zone; Focus: top + bottom
          // implicit height (no explicit `height`) so the dock fills the
          // available column. The previous string-spliced calc was
          // double-mangling PANEL_BOTTOM_OFFSET_CSS into a + 1rem term.
          ...(isFocus
            ? { bottom: PANEL_BOTTOM_OFFSET_CSS }
            : {
                height: analysisHeightPx > 0
                  ? `${analysisHeightPx}px`
                  : `calc(70vh - ${PANEL_RIGHT_MARGIN}px)`,
              }),
          zIndex: Z_AI_PANEL_BASE,
          transition: isDragging ? 'none' : 'height var(--duration-base, 300ms) ease-out',
          display: tabStripMode && openAnalysisOverlayTab === null ? 'none' : undefined,
        }}
        data-tab-strip-hidden={tabStripMode && openAnalysisOverlayTab === null ? 'true' : 'false'}
      >
        <OutputsDock embedded embeddedSendMessage={conversation.sendMessage} />
      </aside>

      {/* ── AI zone (bottom in Compact/Conv, left column in Focus) ──── */}
      <aside
        data-testid="ai-panel-v2-layout"
        aria-label="AI conversation"
        className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-visible shadow-2"
        style={isFocus ? {
          position: 'fixed',
          width: focusWidth,
          top: PANEL_RIGHT_MARGIN,
          bottom: PANEL_BOTTOM_OFFSET_CSS,
          right: AI_PANEL_V2_WIDTH + PANEL_RIGHT_MARGIN + 12,
          zIndex: Z_FOCUS_COLUMN,
          transition: isDragging || isFocusResizing ? 'none' : 'width var(--duration-base, 300ms) ease-out, right var(--duration-base, 300ms) ease-out',
        } : {
          position: 'fixed',
          width: AI_PANEL_V2_WIDTH,
          height: `${aiHeightPx}px`,
          right: PANEL_RIGHT_MARGIN,
          bottom: PANEL_BOTTOM_OFFSET_CSS,
          zIndex: Z_AI_PANEL_BASE,
          transition: isDragging ? 'none' : 'height var(--duration-base, 300ms) ease-out',
        }}
        data-ai-ratio={aiRatio.toFixed(3)}
        data-active-mode={activeMode}
        data-is-dragging={isDragging ? 'true' : 'false'}
        data-viewport-mode={tabStripMode ? 'tab-strip' : 'full'}
      >
        {/* Wide invisible drag band at the AI zone's top edge — the
            visible PullTab anchors at left. The whole band picks up
            vertical drag, but icons inside the visible chrome stop
            propagation so clicks switch modes instead. */}
        <div
          aria-hidden="true"
          onPointerDown={startDrag}
          className={isFocus ? 'hidden' : 'absolute left-0 right-0 -top-2 cursor-ns-resize z-10'}
          style={{ height: PULL_TAB_DRAG_BAND_HEIGHT, pointerEvents: 'auto' }}
        />
        <PullTab
          activeMode={activeMode}
          onModeClick={setMode}
          onStartDrag={startDrag}
          onAdjustByPx={adjustByPx}
          tintBorderClass={tintBorderClass}
          staleAnnouncement={isStale && !hasSelection}
        />
        {isFocus && (
          <>
            <div
              data-testid="ai-panel-v2-focus-left-edge"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Focus column"
              onPointerDown={startLeftEdgeResize}
              className="absolute inset-y-0 left-0 w-1 cursor-ew-resize z-10"
            />
            <div
              data-testid="ai-panel-v2-focus-right-edge"
              role="separator"
              aria-orientation="vertical"
              aria-label="Exit Focus mode"
              onPointerDown={startRightEdgeResize}
              className="absolute inset-y-0 right-0 w-1 cursor-ew-resize z-10"
            />
          </>
        )}
        <div
          data-testid="ai-panel-v2-ai-zone"
          className="flex flex-col flex-1 min-h-0 bg-panel overflow-hidden rounded-2xl"
        >
          <AIZone conversation={conversation} activeMode={activeMode} />
        </div>
      </aside>

      {/* 1440–1599 tab-strip overlay (only in Focus at narrow viewports). */}
      <AnalysisTabStripOverlay
        active={tabStripMode}
        onActiveTabChange={setOpenAnalysisOverlayTab}
      />
    </>
  )
}
