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
 *
 * V11 (Paul 6 Nov) `nav`: the same bar, in the same place, holding three: Model (no lens), Explore (a menu of the other lenses) and Team.
 * Paul withdrew it on 11 Nov; the canvas mounts the six (ViewCanvas.tsx).
 */
import { useEffect, useRef, useState, useLayoutEffect, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Compass } from 'lucide-react'
import { useUIStore, type OutputTab } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { MENU_SHELL } from './look/menu'
import { HIT_44 } from '../styles/hitArea'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../components/layout/TopBar'
import { TIGHT_MAX } from '../components/layout/useTopBarFit'
import { LENS_BAR_TESTID } from '../canvas/artefacts/LensBar'
import { LENS_ICON } from '../canvas/artefacts/lenses'
import { useViewStore } from './store'
import { useOverview } from './strategy/overview/useOverview'
import { useReveal } from './reveal'
import { forgetLanded } from './revealReturn'
import { allBut } from './layout'
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

/** `extra`: the canvas's other top-row controls (the team's Views and Compare views, v12/views/ViewsToggle), drawn after the lenses inside the
 *  same bar, so the bar's measured width (its place, and the pill's room for it) includes them; outside the lenses' radio group and its arrow keys. */
export function ViewLensBar({ nav = false, extra }: { nav?: boolean; extra?: ReactNode } = {}): JSX.Element | null {
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
  if (nav) return <NavBar barRef={bar} place={place} W={W} />
  return (
    <div ref={bar} data-testid={LENS_BAR_TESTID} {...{ [TOP_ROW_BAR]: '' }}
      className="fixed z-[1250] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel p-1 transition-[left,top,opacity] duration-200 ease-out motion-reduce:transition-none"
      // Paul liked the bar's responsive motion (9cce33fa): it fades in once placed, and glides when the pill gives way.
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, visibility: place ? 'visible' : 'hidden', opacity: place ? 1 : 0 }}>
      <div role="radiogroup" aria-label={W.bar} data-testid={`${LENS_BAR_TESTID}-lenses`} onKeyDown={onKeyDown} className="flex h-full items-center gap-0.5">
      {/* A lens radio is 28 px (border 2 + px-1.5 + the 14 px icon); its hit area stays 44 (HIT_44). At 1128x680@1.33 Detailed a revealed board with a
          Rests-on count must fit beside the pill at its tightest (286 px), with the team's two icons (ViewsToggle) at their own size (UI lead, 19 Nov). */}
      {VIEW_LENSES.map((id) => {
        const selected = id === lens, Icon = LENS_ICON[id], count = id === 'rests_on' ? olumi : 0, waiting = !usable(id)
        return (
          <button key={id} ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }} type="button" role="radio"
            aria-checked={selected} aria-disabled={waiting || undefined} tabIndex={selected ? 0 : -1} data-testid={`${LENS_BAR_TESTID}-${id}`} title={waiting ? W.needsRun : W.label[id]}
            aria-label={id === 'rests_on' ? W.rests_on_label : W.label[id]}
            onClick={() => { if (!waiting) useViewLens.setState({ lens: id }) }}
            className={`${typography.viewPanelMeta} ${HIT_44} inline-flex h-full min-w-7 items-center justify-center gap-1 rounded-full border px-1.5 font-medium transition-colors duration-200 ${selected ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : waiting ? 'cursor-default border-transparent text-text-light' : 'border-transparent text-text-light hover:text-text-body'} ${ACTION_FOCUS}`}>
            <Icon aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
            <span className="sr-only" data-lens-label={id}>{W.label[id]}</span>
            {count > 0 ? <span data-testid={`${LENS_BAR_TESTID}-${id}-count`} className={`${typography.viewPanelMeta} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : null}
          </button>
        )
      })}
      </div>
      {extra}
    </div>
  )
}

/** The lenses Explore holds: every lens but the plain model, in the bar's own order. */
const EXPLORE: readonly ViewLens[] = allBut(VIEW_LENSES, 'full')
// J1 gate (the prototype's three): each its own pill, words only; the one in use outlined in ink on the warm tint, never Olumi's blue.
const SEGMENT = `${typography.viewPanelMeta} inline-flex h-full items-center gap-1.5 rounded-full border px-3 font-medium transition-colors duration-200 ${ACTION_FOCUS} ${HIT_44}`
const segment = (on: boolean) => `${SEGMENT} ${on ? 'border-text-header bg-panel-hover text-text-header' : 'border-panel-border bg-canvas text-text-light hover:text-text-header'}`

/** V11's three: Model, Explore (a menu of the lenses), Team. Placed by ViewLensBar, exactly as the six icons. */
type LensWords = NonNullable<ReturnType<typeof useViewStore.getState>['view']>['lens_words']
function NavBar({ barRef, place, W }: { barRef: RefObject<HTMLDivElement>; place: Place | null; W: LensWords }): JSX.Element {
  const lens = useViewLens((s) => s.lens)
  const { olumi } = useRestsOn()
  const waits = useDrivers().size === 0
  const [open, setOpen] = useState(false)
  const exploreBtn = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  // The menu closes on a press outside it, or Escape (focus back on Explore).
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !exploreBtn.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); exploreBtn.current?.focus() } }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  useEffect(() => { if (open) menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"], [role="menuitemradio"]:not([aria-disabled])')?.focus() }, [open])
  const exploring = lens !== 'full'
  // DL ruling 9 Nov: Model and Team are one destination each, on the canvas and in the dock, always in sync. The canvas Model opens the
  // dock's Model tab on the plain model; the dock's Model tab turns any lens off; each is pressed while its dock tab is open.
  const dockTab = useUIStore((s) => s.activeOutputTab)
  useEffect(() => { if (dockTab === 'diagnostics' && useViewLens.getState().lens !== 'full') useViewLens.setState({ lens: 'full' }) }, [dockTab])
  // DL round 5 (rehearsal item 4): one control is always pressed. Model is what the canvas shows unless a lens is on (Explore) or the Team
  // panel is open, so it carries the selected ring at rest too, not only while its panel is open.
  const modelOn = !exploring && dockTab !== 'team'
  // Demo rehearsal 0ce8 step 4 (DL 10 Nov): choosing a lens never takes Analysis away. The dock's last tab of its own (Olumi, Analysis,
  // Reasoning, Compare) is kept, so leaving Team or a lens for Model gives the dock back as it was; the Model outline opens only when Model
  // is pressed while the canvas already shows it.
  const lastTab = useRef<OutputTab>('olumi')
  useEffect(() => { if (dockTab !== 'team' && dockTab !== 'diagnostics') lastTab.current = dockTab }, [dockTab])
  const pressModel = () => {
    const wasOn = modelOn
    useViewLens.setState({ lens: 'full' }); setOpen(false)
    if (dockTab === 'team') { useUIStore.getState().forceActivateOutputTab(lastTab.current); return }
    if (wasOn) useUIStore.getState().forceActivateOutputTab('diagnostics')
  }
  const ExploreIcon = exploring ? LENS_ICON[lens] : Compass
  return (
    <div ref={barRef} role="toolbar" aria-label={W.bar} data-testid={LENS_BAR_TESTID} data-nav="" {...{ [TOP_ROW_BAR]: '' }}
      className="fixed z-[1250] flex items-center gap-2 transition-[left,top] duration-200 ease-out"
      style={{ height: 36, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, visibility: place ? 'visible' : 'hidden' }}>
      <button type="button" aria-pressed={modelOn} data-testid={`${LENS_BAR_TESTID}-full`} title={W.hint.full}
        onClick={pressModel} className={segment(modelOn)}>
<span>{W.label.full}</span>
      </button>
      <div className="relative h-full">
        <button ref={exploreBtn} type="button" aria-haspopup="menu" aria-expanded={open} aria-pressed={exploring} data-testid={`${LENS_BAR_TESTID}-explore`}
          onClick={() => setOpen((o) => !o)} className={segment(exploring || open)}>
          {exploring ? <ExploreIcon aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" /> : null}
          <span>{exploring ? W.label[lens] : W.explore}</span>
        </button>
        {!open ? null : (
          <div ref={menu} role="menu" aria-label={W.explore} data-testid={`${LENS_BAR_TESTID}-explore-menu`}
            className={`absolute left-0 top-full z-10 mt-2 grid w-[300px] gap-0.5 ${MENU_SHELL}`}>
            {EXPLORE.map((id) => {
              const Icon = LENS_ICON[id], waiting = id === 'what_changes' && waits, count = id === 'rests_on' ? olumi : 0, on = id === lens
              return (
                <button key={id} type="button" role="menuitemradio" aria-checked={on} aria-disabled={waiting || undefined} data-testid={`${LENS_BAR_TESTID}-${id}`}
                  onClick={() => { if (waiting) return; useViewLens.setState({ lens: id }); setOpen(false); exploreBtn.current?.focus() }}
                  className={`grid w-full grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-2 rounded-md px-3 py-2 text-left ${waiting ? 'cursor-default' : 'cursor-pointer hover:bg-panel-hover'} ${on ? 'bg-[var(--panel-tab-active-bg)]' : ''} ${ACTION_FOCUS}`}>
                  <Icon aria-hidden="true" strokeWidth={1.75} className="mt-[2px] h-3.5 w-3.5 text-text-light" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className={`${typography.viewPanelMeta} font-medium ${waiting ? 'text-text-light' : 'text-text-header'}`}>{W.label[id]}</span>
                    <span className={`${typography.viewPanelMeta} text-text-light`}>{waiting ? W.needsRun : W.hint[id]}</span>
                  </span>
                  {count > 0 ? <span className={`${typography.viewPanelMeta} mt-[2px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : <span />}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <button type="button" aria-pressed={dockTab === 'team'} data-testid={`${LENS_BAR_TESTID}-team`} onClick={() => {
        // Team pressed while a reveal panel or evidence is open (the landing opens one by itself): the person asked for Team, so the
        // panel steps aside and Team's own titled panel shows (V11 lane 10 Nov, journey step 6.3).
        setOpen(false); forgetLanded(); useReveal.getState().select(null); useUIStore.getState().forceActivateOutputTab('team')
      }} className={segment(dockTab === 'team')}>
<span>{W.team}</span>
      </button>
    </div>
  )
}
