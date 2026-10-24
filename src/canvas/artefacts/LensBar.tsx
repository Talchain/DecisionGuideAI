/**
 * ⭐ THE LENS BAR: one segmented control at the top of the canvas, so switching thinking tools is one press (Paul, 18 Oct
 * 2026: "it needs to easily switch between them"; DL-3 answer 3: top centre, in the top band, replacing the sidebar's
 * dropdown: one switcher, not two).
 *
 * It sits on the top pill's row and at its height, in the free run between the pill and the dock, centred there, so
 * it covers no card (the fit keeps the graph below that row) and never the dock or the inspector. When the run is too
 * narrow for it, it moves one row down, clear of the pill. Each segment says what it shows; "What would change" reads
 * a Run, so before one it is shown but cannot be chosen and says how to get one. L moves to the next lens.
 *
 * View only: it changes the lens and nothing else.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { measureDockInset } from '../components/FloatingOlumiPanel'
import { OVERLAY_BAND_LEFT_PAD } from '../components/CanvasOverlayBand'
import { TOP_PILL_BOTTOM_PX, TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../../components/layout/TopBar'
import { resolveActiveGoalNodeId } from '../hooks/goalThresholdResolvers'
import { assumptionMapOf } from './assumptionMapModel'
import { isUnsettled } from './RestsOnMarker'
import { LENS_COPY, LENS_ICON, LENS_ORDER, lensNeedsRun, useCurrentPremortemWorksheet, usePremortemArrival, type BarLens } from './lenses'

export const LENS_BAR_TESTID = 'lens-bar'
/** The space kept between the bar and the pill, the dock or the window edge. */
const GAP_PX = 12

interface Placement { readonly left: number; readonly top: number }

/**
 * Where the bar goes: centred in the free run on the pill's row, or one row down when that run is too narrow. Pure, so
 * the rule is tested without a layout engine.
 */
export function placeLensBar(input: {
  readonly viewportWidth: number
  readonly pillRight: number
  readonly dockInset: number
  readonly barWidth: number
}): Placement {
  const { viewportWidth, pillRight, dockInset, barWidth } = input
  const runLeft = pillRight + GAP_PX
  const runRight = viewportWidth - dockInset - GAP_PX
  if (runRight - runLeft >= barWidth) return { left: runLeft + (runRight - runLeft - barWidth) / 2, top: TOP_PILL_TOP_PX }
  // One row down, the canvas tools stand at the left edge: start where the band's occupants do, clear of them.
  const frameLeft = OVERLAY_BAND_LEFT_PAD
  return { left: Math.max(frameLeft, frameLeft + (runRight - frameLeft - barWidth) / 2), top: TOP_PILL_BOTTOM_PX + GAP_PX / 2 }
}

/** The bar's place, re-measured when the window, the pill or the dock changes size. */
function useLensBarPlacement(bar: HTMLElement | null): Placement | null {
  const [placement, setPlacement] = useState<Placement | null>(null)
  useLayoutEffect(() => {
    if (!bar || typeof window === 'undefined') return
    const measure = () => {
      const pill = document.querySelector('[role="banner"]')?.getBoundingClientRect()
      const next = placeLensBar({
        viewportWidth: window.innerWidth,
        pillRight: pill && pill.width > 0 ? pill.right : 0,
        dockInset: measureDockInset(),
        barWidth: bar.getBoundingClientRect().width,
      })
      setPlacement((held) => (held && held.left === next.left && held.top === next.top ? held : next))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('outputs-dock-opened', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    for (const el of [bar, document.querySelector('[role="banner"]'), document.querySelector('aside[aria-label="Outputs dock"]')]) {
      if (el && ro) ro.observe(el)
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('outputs-dock-opened', measure)
      ro?.disconnect()
    }
  }, [bar])
  return placement
}

/** The small count beside a segment: figures nobody has settled; Olumi's pre-mortem stories. Attention, never a score. */
function useSegmentCounts(): Partial<Record<BarLens, number>> {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const worksheet = useCurrentPremortemWorksheet()
  return useMemo(() => {
    const goalId = resolveActiveGoalNodeId({ ceeAnalysisReady, outcomeNodeId, nodes })
    const unsettled = assumptionMapOf(nodes, edges, goalId).items.filter((item) => isUnsettled(item.column)).length
    return { rests_on: unsettled, premortem: worksheet?.rows.length ?? 0 }
  }, [nodes, edges, ceeAnalysisReady, outcomeNodeId, worksheet])
}

export function LensBar() {
  // "If it failed": restores the worksheet on reload, and turns to the lens when a worksheet the user asked for
  // arrives. Here because the bar is mounted for the canvas's whole life, before any early return.
  usePremortemArrival()
  const enabled = isGraphLensEnabled()
  const hasModel = useCanvasStore((s) => s.nodes.length > 0)
  const active = useCanvasStore((s) => s.lens.active)
  const hasRun = useCanvasStore((s) => s.results.status === 'complete' && !!s.results.report)
  const setLens = useCanvasStore((s) => s.setLens)
  const counts = useSegmentCounts()
  const [bar, setBar] = useState<HTMLDivElement | null>(null)
  const placement = useLensBarPlacement(bar)
  const buttons = useRef(new Map<BarLens, HTMLButtonElement>())
  // Option isolation is a view of the Model segment's graph, entered from an option card: the bar shows Model.
  const current: BarLens = active === 'option' ? 'full' : active

  const choose = useCallback((lens: BarLens) => {
    if (lensNeedsRun(lens) && !hasRun) return
    setLens(lens)
  }, [hasRun, setLens])

  // Arrow keys move along the bar and choose (the radio-group pattern); a lens that cannot show yet is skipped.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const usable = LENS_ORDER.filter((lens) => hasRun || !lensNeedsRun(lens))
    const at = usable.indexOf(current)
    const next = usable[(at + (event.key === 'ArrowRight' ? 1 : usable.length - 1)) % usable.length]
    choose(next)
    buttons.current.get(next)?.focus()
  }

  if (!enabled || !hasModel) return null
  return (
    <div
      ref={setBar}
      role="radiogroup"
      aria-label={LENS_COPY.bar}
      aria-keyshortcuts="L"
      data-testid={LENS_BAR_TESTID}
      onKeyDown={onKeyDown}
      className="fixed z-[1200] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel/95 p-1 shadow-2 backdrop-blur-sm transition-[left,top,opacity] duration-200 ease-out"
      style={{
        height: TOP_PILL_HEIGHT_PX,
        left: placement?.left ?? 0,
        top: placement?.top ?? TOP_PILL_TOP_PX,
        // Hidden until measured, so it never flashes over the pill at x 0.
        opacity: placement ? 1 : 0,
      }}
    >
      {LENS_ORDER.map((lens) => {
        const selected = lens === current
        const waiting = lensNeedsRun(lens) && !hasRun
        const count = counts[lens] ?? 0
        const LensIcon = LENS_ICON[lens]
        return (
          <button
            key={lens}
            ref={(el) => { if (el) buttons.current.set(lens, el); else buttons.current.delete(lens) }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={waiting || undefined}
            tabIndex={selected ? 0 : -1}
            data-testid={`${LENS_BAR_TESTID}-${lens}`}
            aria-label={(lens === 'rests_on' || lens === 'premortem') && count > 0
              ? `${LENS_COPY.label[lens]}, ${LENS_COPY.count[lens](count)}`
              : LENS_COPY.label[lens]}
            title={waiting ? LENS_COPY.needsRun : LENS_COPY.hint[lens]}
            onClick={() => choose(lens)}
            className={`${typography.panelBody} inline-flex h-full items-center gap-1.5 rounded-full border px-3 transition-colors duration-200 ${
              selected
                ? 'border-info/30 bg-[var(--panel-tab-active-bg)] text-text-header'
                : waiting
                  ? 'cursor-default border-transparent text-text-light/60'
                  : 'border-transparent text-text-light hover:text-text-body'
            } ${ACTION_FOCUS}`}
          >
            <LensIcon aria-hidden="true" data-testid={`${LENS_BAR_TESTID}-${lens}-icon`} className="h-3.5 w-3.5 shrink-0" />
            {LENS_COPY.label[lens]}
            {count > 0 ? (
              <span
                data-testid={`${LENS_BAR_TESTID}-${lens}-count`}
                className={`${typography.panelMeta} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
