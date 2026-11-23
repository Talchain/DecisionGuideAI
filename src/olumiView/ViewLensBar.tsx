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
import { useRef, useState, useLayoutEffect, type KeyboardEvent, type ReactNode } from 'react'
import { OkIcon, type IconId } from './look/icons'
import { HoverButton } from './look/Hover'
import { TOOLBAR_BAR, TOOLBAR_COUNTED_ICON, TOOLBAR_ICON } from './look/toolbar'
import { typography } from '../styles/typography'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../components/layout/TopBar'
import { TIGHT_MAX } from '../components/layout/useTopBarFit'
import { LENS_BAR_TESTID } from '../canvas/artefacts/LensBar'
import { useViewStore } from './store'
import { useOverview } from './strategy/overview/useOverview'
import { useDrivers, useRestsOn, useViewLens, VIEW_LENSES, type ViewLens } from './lens'
import { DOCK_GAP, TOP_ROW_BAR } from './TeamPresence'

const LENS_GLYPH: Record<ViewLens, IconId> = {
  full: 'lenses',
  tradeoffs: 'lens-tradeoffs',
  rests_on: 'rests-on',
  premortem: 'lens-premortem',
  what_changes: 'lens-what-changes',
  what_if: 'what-if',
}

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

/** `extra`: the canvas's other top-row controls (the team's Views and Compare views, v12/views/ViewsToggle), drawn after the lenses inside the
 *  same bar, so the bar's measured width (its place, and the pill's room for it) includes them; outside the lenses' radio group and its arrow keys. */
export function ViewLensBar({ extra }: { extra?: ReactNode } = {}): JSX.Element | null {
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
    const focused = VIEW_LENSES.find((id) => buttons.current.get(id) === e.target) ?? lens
    const next = VIEW_LENSES[(VIEW_LENSES.indexOf(focused) + step) % VIEW_LENSES.length]!
    if (usable(next)) useViewLens.setState({ lens: next })
    buttons.current.get(next)?.focus()
  }
  // D1 (strategy canvas audit, 10 Nov; the design owner's call): the bar is a canvas control, so while the Strategy Overview stands in
  // place of the canvas it is not drawn (it sat over the overview's title); the overview has its own Close, and Escape closes it.
  if (W === null || overviewOpen) return null
  return (
    <div ref={bar} data-testid={LENS_BAR_TESTID} {...{ [TOP_ROW_BAR]: '' }}
      className={`fixed z-[1250] ${TOOLBAR_BAR} transition-[left,top,opacity] duration-200 ease-out motion-reduce:transition-none`}
      // Paul liked the bar's responsive motion (9cce33fa): it fades in once placed, and glides when the pill gives way.
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, visibility: place ? 'visible' : 'hidden', opacity: place ? 1 : 0 }}>
      <div role="radiogroup" aria-label={W.bar} data-testid={`${LENS_BAR_TESTID}-lenses`} onKeyDown={onKeyDown} className="flex h-full items-center">
        {VIEW_LENSES.map((id) => {
          const selected = id === lens, count = id === 'rests_on' ? olumi : 0, waiting = !usable(id)
          return (
            <HoverButton key={id} ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }} type="button" role="radio"
              aria-checked={selected} aria-disabled={waiting || undefined} tabIndex={selected ? 0 : -1} data-testid={`${LENS_BAR_TESTID}-${id}`} words={waiting ? W.needsRun : W.label[id]}
              aria-label={id === 'rests_on' ? W.rests_on_label : W.label[id]}
              onClick={() => { if (!waiting) useViewLens.setState({ lens: id }) }}
              className={count > 0 ? TOOLBAR_COUNTED_ICON : TOOLBAR_ICON}>
              <OkIcon id={LENS_GLYPH[id]} size={14} decorative inherit />
              <span className={`sr-only ${typography.viewPanelMeta}`} data-lens-label={id}>{W.label[id]}</span>
              {count > 0 ? <span data-testid={`${LENS_BAR_TESTID}-${id}-count`} className={`${typography.viewPanelMeta} tabular-nums`}>{count}</span> : null}
            </HoverButton>
          )
        })}
      </div>
      {extra}
    </div>
  )
}
