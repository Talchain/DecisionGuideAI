import { useEffect } from 'react'
import {
  AI_PANEL_V2_WIDTH,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  COMPACT_AI_RATIO,
  Z_AI_PANEL_BASE,
} from './constants'

// Step 1 skeleton: bottom-right AI zone that sits BELOW the existing
// OutputsDock. Both are fixed-position panels; this layout coordinates with
// the dock through two CSS variables written on the document root:
//
//   --olumi-ai-panel-bottom        height reserved below the dock
//   --olumi-ai-panel-dock-width    width override for the dock (flag-only)
//
// Both are flag-specific names — they never collide with the dock's existing
// --dock-right-expanded variable, so runtime resize state stored there is
// preserved across flag toggles. When FF_AI_PANEL_V2 is off neither variable
// is set, and OutputsDock's computed style resolves to its legacy values.
//
// Implementation choice (step 1 verification): mounting OutputsDock as a
// child of this layout (the original "embedded" approach in the plan)
// triggered a Rules-of-Hooks crash inside PreAnalysisPanel when the dock
// became a flex child instead of a fixed-position overlay. The CSS-variable
// split keeps the dock's own render path untouched.

// Clamp max subtracts the actual right-panel chrome budget — not bare
// 100vh — so the analysis-zone minimum is preserved on small viewports:
//
//   • 12px      — dock's `top: 12` inset
//   • 1rem      — dock's bottom margin (matches its bottom calc)
//   • bottombar — set by DraftChat / toolbar height
//   • analysis-min — keep this much vertical room for OutputsDock above us
//
// On a 600px-tall viewport with bottombar = 0, this yields:
//   max = 600 − 12 − 16 − 0 − 200 = 372px
// instead of the naive `100vh − 200px` = 400px (which would let the AI
// zone eat into the dock's minimum).
const AI_ZONE_HEIGHT_CSS = `clamp(${AI_ZONE_MIN_HEIGHT}px, ${Math.round(
  COMPACT_AI_RATIO * 100
)}vh, calc(100vh - 12px - 1rem - var(--bottombar-h, 0px) - ${ANALYSIS_ZONE_MIN_HEIGHT}px))`

export function AIPanelV2Layout() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.setProperty('--olumi-ai-panel-dock-width', `${AI_PANEL_V2_WIDTH}px`)
    root.style.setProperty('--olumi-ai-panel-bottom', AI_ZONE_HEIGHT_CSS)
    return () => {
      root.style.removeProperty('--olumi-ai-panel-dock-width')
      root.style.removeProperty('--olumi-ai-panel-bottom')
    }
  }, [])

  return (
    <aside
      data-testid="ai-panel-v2-layout"
      aria-label="AI conversation"
      className="flex flex-col pointer-events-auto bg-panel border border-panel-border rounded-2xl overflow-hidden shadow-2"
      style={{
        position: 'fixed',
        width: AI_PANEL_V2_WIDTH,
        height: AI_ZONE_HEIGHT_CSS,
        right: 12,
        bottom: 'calc(var(--bottombar-h, 0px) + 1rem)',
        zIndex: Z_AI_PANEL_BASE,
      }}
    >
      <div
        data-testid="ai-panel-v2-ai-zone"
        className="flex-1 min-h-0 overflow-hidden"
      >
        {/* AIZone (SelectionPill + ChatThread + StaleBadge + AIInputBar)
            arrives in steps 2–6. Step 1 ships an empty zone so the split
            layout and CSS-variable coordination can be verified without
            touching conversation wiring. DraftChat stays mounted in both
            flag states until the in-panel input lands. */}
      </div>
    </aside>
  )
}
