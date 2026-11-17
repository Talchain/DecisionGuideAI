/**
 * THE LENS BAR ON THE CORE LANE: the legacy bar's control (its words and icons, `LensBar.tsx`) with the lenses the View fills (`lens.ts`).
 * One press switches; the arrow keys move along it. Rests on carries the count of Olumi's figures and assumptions to check or set. What would
 * change needs a Run that names what each option moves with: before one it is shown but cannot be chosen, and says how to get one.
 *
 * ICONS ONLY, ALWAYS ON THE TOP ROW (Paul, 17 Nov: "make the top floating menu all icons so it always fits on the top of the screen and not
 * underneath the main left-hand top menu"; experience contract section 8). Each lens is one icon button: its words (core's `lens_words`) are
 * its hover and its name, the lens in use is pressed, and Rests on keeps its count as a small number. The bar sits directly right of the
 * scenario pill on the pill's row; the pill gives way to make that room (TeamPresence `topRowLimit`, read by the avatars and useTopBarFit),
 * and the bar waits, hidden, while it does. Only on a window narrower than Paul's three sizes, with the pill at its tightest and still no
 * room, does the bar take the row under the pill rather than run over the dock.
 */
import { useRef, useState, useLayoutEffect, type KeyboardEvent } from 'react'
import { typography } from '../styles/typography'
import { HIT_44 } from '../styles/hitArea'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../components/layout/TopBar'
import { TIGHT_MAX } from '../components/layout/useTopBarFit'
import { LENS_BAR_TESTID } from '../canvas/artefacts/LensBar'
import { LENS_ICON } from '../canvas/artefacts/lenses'
import { useViewStore } from './store'
import { useOverview } from './strategy/overview/useOverview'
import { useDrivers, useRestsOn, useViewLens, VIEW_LENSES, type ViewLens } from './lens'
import { DOCK_GAP, TOP_ROW_BAR } from './TeamPresence'

type Place = { left: number; top: number }

/**
 * Where the bar stands: directly right of the pill on its row when it fits before the dock; else, with the pill at its tightest (every avatar
 * folded and every step of useTopBarFit taken), on the row under the pill; else nowhere yet (null: hidden while the pill makes room). Pure.
 */
export function lensBarPlace(at: { readonly pill: { left: number; right: number; bottom: number } | null; readonly barWidth: number; readonly viewportWidth: number; readonly dockInset: number; readonly tightest: boolean }): Place | null {
  const left = at.pill === null ? DOCK_GAP : Math.round(at.pill.right + DOCK_GAP)
  if (left + at.barWidth <= at.viewportWidth - at.dockInset - DOCK_GAP) return { left, top: TOP_PILL_TOP_PX }
  return at.tightest && at.pill !== null ? { left: Math.round(at.pill.left), top: Math.round(at.pill.bottom + 8) } : null
}

export function ViewLensBar(): JSX.Element | null {
  const lens = useViewLens((s) => s.lens)
  const overviewOpen = useOverview((s) => s.open)
  // Every word on the bar is core's (`lens_words`, N3); with no View there is no bar.
  const W = useViewStore((s) => s.view?.lens_words ?? null)
  const { olumi } = useRestsOn()
  const waits = useDrivers().size === 0
  const usable = (id: ViewLens) => id !== 'what_changes' || !waits
  const bar = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<ViewLens, HTMLButtonElement>())
  const [place, setPlace] = useState<Place | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const banner = document.querySelector('[role="banner"]'), pill = banner?.getBoundingClientRect()
      const tightest = banner?.getAttribute('data-tight') === String(TIGHT_MAX) && banner.querySelector('[data-presence-disc]') === null
      const next = lensBarPlace({ pill: pill !== undefined && pill.width > 0 ? pill : null, barWidth: bar.current?.getBoundingClientRect().width ?? 0, viewportWidth: window.innerWidth, dockInset: measureDockInset(), tightest })
      setPlace((held) => (held === next || (held !== null && next !== null && held.left === next.left && held.top === next.top) ? held : next))
      // The left toolbar starts under the bar only on the narrow window's fallback row (it hid the toolbar's "+"); on the top row, never.
      document.documentElement.style.setProperty('--view-nav-bottom', next !== null && next.top > TOP_PILL_TOP_PX ? `${next.top + TOP_PILL_HEIGHT_PX}px` : '0px')
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('outputs-dock-opened', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    for (const el of [bar.current, document.querySelector('[role="banner"]'), document.querySelector('aside[aria-label="Outputs dock"]')]) if (el && ro) ro.observe(el)
    // The pill's steps change its width (observed) and its `data-tight` (not a size): read again on the pill's own beat as well.
    const t = setInterval(measure, 500)
    return () => { clearInterval(t); window.removeEventListener('resize', measure); window.removeEventListener('outputs-dock-opened', measure); ro?.disconnect(); document.documentElement.style.removeProperty('--view-nav-bottom') }
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : VIEW_LENSES.length - 1
    let next = VIEW_LENSES[(VIEW_LENSES.indexOf(lens) + step) % VIEW_LENSES.length]!
    if (!usable(next)) next = VIEW_LENSES[(VIEW_LENSES.indexOf(next) + step) % VIEW_LENSES.length]!
    useViewLens.setState({ lens: next })
    buttons.current.get(next)?.focus()
  }
  // D1 (strategy canvas audit, 10 Nov; the design owner's call): the bar is a canvas control, so while the Strategy Overview stands in
  // place of the canvas it is not drawn (it sat over the overview's title); the overview has its own Close, and Escape closes it.
  if (W === null || overviewOpen) return null
  return (
    <div ref={bar} role="radiogroup" aria-label={W.bar} data-testid={LENS_BAR_TESTID} onKeyDown={onKeyDown} {...{ [TOP_ROW_BAR]: '' }}
      className="fixed z-[1250] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel p-1 transition-[left,top,opacity] duration-200 ease-out motion-reduce:transition-none"
      // Paul liked the bar's responsive motion (9cce33fa): it fades in once placed, and glides when the pill gives way.
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, visibility: place ? 'visible' : 'hidden', opacity: place ? 1 : 0 }}>
      {VIEW_LENSES.map((id) => {
        const selected = id === lens, Icon = LENS_ICON[id], count = id === 'rests_on' ? olumi : 0, waiting = !usable(id)
        return (
          <button key={id} ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }} type="button" role="radio"
            aria-checked={selected} aria-disabled={waiting || undefined} tabIndex={selected ? 0 : -1} data-testid={`${LENS_BAR_TESTID}-${id}`} title={waiting ? W.needsRun : W.label[id]}
            aria-label={id === 'rests_on' ? W.rests_on_label : W.label[id]}
            onClick={() => { if (!waiting) useViewLens.setState({ lens: id }) }}
            className={`${typography.viewPanelMeta} ${HIT_44} inline-flex h-full min-w-8 items-center justify-center gap-1 rounded-full border px-2 font-medium transition-colors duration-200 ${selected ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : waiting ? 'cursor-default border-transparent text-text-light' : 'border-transparent text-text-light hover:text-text-body'} ${ACTION_FOCUS}`}>
            <Icon aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
            <span className="sr-only" data-lens-label={id}>{W.label[id]}</span>
            {count > 0 ? <span data-testid={`${LENS_BAR_TESTID}-${id}-count`} className={`${typography.viewPanelMeta} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
