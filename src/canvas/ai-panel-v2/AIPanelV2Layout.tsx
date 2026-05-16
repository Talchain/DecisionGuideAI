import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AIZone } from './AIZone'
import { AnalysisTabStripOverlay } from './AnalysisTabStripOverlay'
import { PullTab } from './PullTab'
import { usePanelSplit } from './hooks/usePanelSplit'
import { useFocusColumn } from './hooks/useFocusColumn'
import { useSelectionContext } from './hooks/useSelectionContext'
import { useStaleGuard } from '../ui/inspector-v2/useStaleGuard'
import {
  AI_PANEL_V2_WIDTH,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  ANALYSIS_TAB_STRIP_WIDTH,
  FOCUS_FULL_VIEWPORT,
  FOCUS_MIN_VIEWPORT,
  Z_AI_PANEL_BASE,
  Z_FOCUS_COLUMN,
} from './constants'
import type { AIPanelMode } from './constants'

// Right-edge AI panel + Focus mode coordination.
//
// Two positioning modes, but ONE persistent AIZone (so `useConversation`
// state survives mode toggles — singleton invariant from correction #9):
//
//   Compact / Conversation:
//     • Panel fixed at bottom-right, height = ratio × available height
//     • Dock contracts via --olumi-ai-panel-bottom
//
//   Focus:
//     • Panel fixed full-height as a column, LEFT of the dock (≥1600px)
//       or replacing the dock area (1440–1599px tab-strip mode)
//     • Dock reserves 0 below (--olumi-ai-panel-bottom: 0px)
//     • Width controlled by useFocusColumn (320 min, 50vw max)
//     • Left edge is the resize handle; right edge snaps back to Compact

const PANEL_RIGHT_MARGIN = 12
const PANEL_BOTTOM_OFFSET_CSS = 'calc(var(--bottombar-h, 0px) + 1rem)'

export function AIPanelV2Layout() {
  // Track viewport width for the 1440–1599 tab-strip mode and to disable
  // Focus below FOCUS_MIN_VIEWPORT.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1600 : window.innerWidth,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Sentinel sized to the dock's vertical budget for honest pixel clamps.
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

  // useFocusColumn exits to Compact on snap-back drag.
  const handleFocusExit = useCallback(() => {
    setMode('compact')
  }, [setMode])
  const { width: focusWidth, isResizing: isFocusResizing, startLeftEdgeResize, startRightEdgeResize } = useFocusColumn({
    onExit: handleFocusExit,
  })

  const isFocus = activeMode === 'focus'
  // Tab-strip mode replaces the dock at narrow Focus viewports
  // (1440–1599) so the AI column + canvas can fit.
  const tabStripMode = isFocus && viewportWidth >= FOCUS_MIN_VIEWPORT && viewportWidth < FOCUS_FULL_VIEWPORT
  const [openAnalysisOverlayTab, setOpenAnalysisOverlayTab] = useState<string | null>(null)

  useEffect(() => {
    if (!tabStripMode && openAnalysisOverlayTab !== null) {
      setOpenAnalysisOverlayTab(null)
    }
  }, [tabStripMode, openAnalysisOverlayTab])

  // Selection / stale tint on the pull-tab edge.
  const { hasSelection, borderClass: selectionBorder } = useSelectionContext()
  const { isStale } = useStaleGuard()
  const tintBorderClass = useMemo(() => {
    if (hasSelection) return selectionBorder
    if (isStale) return 'border-warning'
    return 'border-panel-border'
  }, [hasSelection, selectionBorder, isStale])

  // Vertical AI-zone pixel height (Compact/Conv only).
  const aiHeightPx = availableHeightPx > 0
    ? Math.max(
        AI_ZONE_MIN_HEIGHT,
        Math.min(availableHeightPx - ANALYSIS_ZONE_MIN_HEIGHT, availableHeightPx * aiRatio),
      )
    : AI_ZONE_MIN_HEIGHT

  // CSS-variable coordination with OutputsDock:
  //   • --olumi-ai-panel-dock-width: dock width (400px normally; in
  //     1440–1599 Focus, 48px when closed and 400px while an analysis
  //     overlay tab is open)
  //   • --olumi-ai-panel-bottom: vertical reserve below the dock
  //     (Compact/Conv: aiHeightPx; Focus: 0 — dock returns to full height)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const dockWidth = tabStripMode && openAnalysisOverlayTab === null
      ? ANALYSIS_TAB_STRIP_WIDTH
      : AI_PANEL_V2_WIDTH
    root.style.setProperty('--olumi-ai-panel-dock-width', `${dockWidth}px`)
    root.style.setProperty('--olumi-ai-panel-bottom', isFocus ? '0px' : `${aiHeightPx}px`)
    return () => {
      root.style.removeProperty('--olumi-ai-panel-dock-width')
      root.style.removeProperty('--olumi-ai-panel-bottom')
    }
  }, [aiHeightPx, isFocus, openAnalysisOverlayTab, tabStripMode])

  // ── Compact / Conversation positioning ────────────────────────────────
  const compactStyle: React.CSSProperties = {
    position: 'fixed',
    width: AI_PANEL_V2_WIDTH,
    height: `${aiHeightPx}px`,
    right: PANEL_RIGHT_MARGIN,
    bottom: PANEL_BOTTOM_OFFSET_CSS,
    zIndex: Z_AI_PANEL_BASE,
    transition: isDragging ? 'none' : 'height var(--duration-base, 300ms) ease-out, width var(--duration-base, 300ms) ease-out, right var(--duration-base, 300ms) ease-out',
  }

  // ── Focus positioning ─────────────────────────────────────────────────
  // When tabStripMode is on, the dock is replaced by a 48px strip; the AI
  // column occupies the right portion of the viewport. When ≥1600px, the
  // dock keeps its 400px width and the AI column sits LEFT of it.
  //
  // Special case: while a tab-strip tab is open (1440-1599), the dock
  // expands back to 400px to show its content. We slide the AI column
  // LEFT so the two don't overlap — without the shift, both would sit at
  // the same z-index and the AI column (rendered later) would paint over
  // the expanded dock, hiding the analysis content the user just opened.
  const dockWidthForLayout = tabStripMode && openAnalysisOverlayTab === null
    ? ANALYSIS_TAB_STRIP_WIDTH
    : AI_PANEL_V2_WIDTH
  const dockReserved = dockWidthForLayout + PANEL_RIGHT_MARGIN
  const focusStyle: React.CSSProperties = {
    position: 'fixed',
    width: focusWidth,
    top: PANEL_RIGHT_MARGIN,
    bottom: PANEL_BOTTOM_OFFSET_CSS,
    right: dockReserved + 12, // 12px gutter between the AI column and the dock
    zIndex: Z_FOCUS_COLUMN,
    transition: isDragging || isFocusResizing ? 'none' : 'width var(--duration-base, 300ms) ease-out, right var(--duration-base, 300ms) ease-out',
  }

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
      <aside
        data-testid="ai-panel-v2-layout"
        aria-label="AI conversation"
        className="flex flex-col pointer-events-auto bg-panel border border-panel-border rounded-2xl overflow-visible shadow-2"
        style={isFocus ? focusStyle : compactStyle}
        data-ai-ratio={aiRatio.toFixed(3)}
        data-active-mode={activeMode}
        data-is-dragging={isDragging ? 'true' : 'false'}
        data-viewport-mode={tabStripMode ? 'tab-strip' : 'full'}
      >
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
            {/* Left-edge resize handle — widens the Focus column. */}
            <div
              data-testid="ai-panel-v2-focus-left-edge"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Focus column"
              onPointerDown={startLeftEdgeResize}
              className="absolute inset-y-0 left-0 w-1 cursor-ew-resize z-10"
            />
            {/* Right-edge resize handle — narrow / snap back to Compact. */}
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
          <AIZone />
        </div>
      </aside>
      {/* 1440–1599 tab-strip chrome — only in Focus mode at narrow
          Focus-supported viewports. Replaces the dock visually with a
          48px strip; clicking opens a 400px overlay. */}
      <AnalysisTabStripOverlay
        active={tabStripMode}
        onActiveTabChange={setOpenAnalysisOverlayTab}
      />
    </>
  )
}
