import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AIZone } from './AIZone'
import { PullTab } from './PullTab'
import { usePanelSplit } from './hooks/usePanelSplit'
import {
  AI_PANEL_V2_WIDTH,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  Z_AI_PANEL_BASE,
} from './constants'

// Bottom-right AI panel that sits BELOW OutputsDock. The two coordinate
// through CSS variables on document.documentElement:
//
//   --olumi-ai-panel-bottom        height reserved below the dock
//   --olumi-ai-panel-dock-width    width override for the dock
//
// FF off → variables unset, dock fills its legacy bounding box.
// FF on  → this layout sets the height of the AI panel based on the
//          current split ratio; the dock contracts in lock-step.
//
// `usePanelSplit` owns the live aiRatio (Compact/Conversation modes).
// PullTab anchors to the panel's top edge so users can click to switch
// modes or drag to resize. Focus mode (horizontal drag) ships in step 12.

const PANEL_RIGHT_MARGIN = 12
const PANEL_BOTTOM_OFFSET_CSS = 'calc(var(--bottombar-h, 0px) + 1rem)'

// Available vertical budget the AI panel can claim, in pixels:
//   100vh − dock top inset (12px) − dock bottom margin (1rem) − analysis min
// The hook clamps the ratio to keep the dock's minimum height honest.
const AVAILABLE_HEIGHT_CSS = `calc(100vh - ${PANEL_RIGHT_MARGIN}px - 1rem - var(--bottombar-h, 0px))`

export function AIPanelV2Layout() {
  // A 1px sentinel measures the *available* vertical budget (viewport −
  // chrome). We compute pixel-clamping against this rather than reading
  // window.innerHeight directly, because the bottombar-h and 1rem terms
  // resolve through CSS only.
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

  const { aiRatio, activeMode, startDrag, setMode, adjustByPx } = usePanelSplit({
    getPanelHeight,
  })

  // AI-zone height in pixels — derived from ratio, with the same min-zone
  // clamp the hook applies. We compute here too so the CSS variable used by
  // the dock matches the actual pixel height exactly.
  const aiHeightPx = availableHeightPx > 0
    ? Math.max(
        AI_ZONE_MIN_HEIGHT,
        Math.min(availableHeightPx - ANALYSIS_ZONE_MIN_HEIGHT, availableHeightPx * aiRatio),
      )
    : AI_ZONE_MIN_HEIGHT
  const aiHeightCss = `${aiHeightPx}px`

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.setProperty('--olumi-ai-panel-dock-width', `${AI_PANEL_V2_WIDTH}px`)
    root.style.setProperty('--olumi-ai-panel-bottom', aiHeightCss)
    return () => {
      root.style.removeProperty('--olumi-ai-panel-dock-width')
      root.style.removeProperty('--olumi-ai-panel-bottom')
    }
  }, [aiHeightCss])

  return (
    <>
      {/* Off-screen sentinel: same vertical budget as the dock so we
          measure pixels honestly without reading window.innerHeight. */}
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
        style={{
          position: 'fixed',
          width: AI_PANEL_V2_WIDTH,
          height: aiHeightCss,
          right: PANEL_RIGHT_MARGIN,
          bottom: PANEL_BOTTOM_OFFSET_CSS,
          zIndex: Z_AI_PANEL_BASE,
        }}
        data-ai-ratio={aiRatio.toFixed(3)}
        data-active-mode={activeMode}
      >
        {/* PullTab is positioned outside the rounded clip so it can extend
            above the panel's top edge. The panel container uses
            overflow-visible to permit that. */}
        <PullTab
          activeMode={activeMode}
          onModeClick={setMode}
          onStartDrag={startDrag}
          onAdjustByPx={adjustByPx}
        />
        <div
          data-testid="ai-panel-v2-ai-zone"
          className="flex flex-col flex-1 min-h-0 bg-panel overflow-hidden rounded-2xl"
        >
          <AIZone />
        </div>
      </aside>
    </>
  )
}

export { AVAILABLE_HEIGHT_CSS }
