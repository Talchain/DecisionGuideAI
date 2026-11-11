/**
 * THE LENS BAR ON THE CORE LANE: the legacy bar's control (its place, its look, its words and icons, `LensBar.tsx`) with the lenses the
 * View fills (`lens.ts`). One press switches; the arrow keys move along it. Rests on carries the count of Olumi's figures and
 * assumptions to check or set. What would change needs a Run that names what each option moves with: before one it is shown but
 * cannot be chosen, and says how to get one.
 *
 * V11 (Paul 6 Nov, "Navigation": reduce the six equal-weight lens pills to Model, Explore and Team; within Explore, retain the existing
 * lenses as contextual choices): with `nav`, the same bar, in the same place, holds three: Model (no lens), Explore (a menu of the other
 * lenses, each with its own words, icon and count; the lens on is named on the button) and Team (opens the Team tab). Without `nav`, the
 * six pills as before, so switching back is one prop at the call site (ViewCanvas.tsx).
 */
import { useEffect, useRef, useState, useLayoutEffect, type KeyboardEvent, type RefObject } from 'react'
import { Compass } from 'lucide-react'
import { useUIStore, type OutputTab } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { HIT_44 } from '../styles/hitArea'
import { SELECTED } from '../styles/selected'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../components/layout/TopBar'
import { LENS_BAR_TESTID, lensBarFitsBesidePill, lensBarFitsCanvas, placeLensBar } from '../canvas/artefacts/LensBar'
import { LENS_ICON } from '../canvas/artefacts/lenses'
import { useViewStore } from './store'
import { useOverview } from './strategy/overview/useOverview'
import { useReveal } from './reveal'
import { forgetLanded } from './revealReturn'
import { allBut } from './layout'
import { useDrivers, useRestsOn, useViewLens, VIEW_LENSES, type ViewLens } from './lens'

export function ViewLensBar({ nav = false, previousPlace = false }: { nav?: boolean; /** Spike: placed exactly as the previous product's bar is (`placeLensBar`), on the previous canvas. */ previousPlace?: boolean } = {}): JSX.Element | null {
  const lens = useViewLens((s) => s.lens)
  const overviewOpen = useOverview((s) => s.open)
  // Every word on the bar is core's (`lens_words`, N3); with no View there is no bar.
  const W = useViewStore((s) => s.view?.lens_words ?? null)
  const { olumi } = useRestsOn()
  const waits = useDrivers().size === 0
  const usable = (id: ViewLens) => id !== 'what_changes' || !waits
  const bar = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<ViewLens, HTMLButtonElement>())
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  // Icon-only (each label on hover) when the labelled bar does not fit beside the pill, so the bar keeps the top row (R3 pristine). The
  // labelled width is kept from the last labelled draw, so the bar turns its labels back on once there is room for them.
  const [compact, setCompact] = useState(false)
  const compactNow = useRef(false), labelledWidth = useRef(0)
  useLayoutEffect(() => {
    const measure = () => {
      const pill = document.querySelector('[role="banner"]')?.getBoundingClientRect()
      const width = bar.current?.getBoundingClientRect().width ?? 0
      if (!compactNow.current) labelledWidth.current = width
      const at = { viewportWidth: window.innerWidth, pillRight: pill && pill.width > 0 ? pill.right : 0, dockInset: measureDockInset() }
      // J1 step 5 (the prototype's labelled Model / Explore / Team bar): when the labelled bar does not fit beside the pill, it takes its own
      // row on the canvas, at the pill's left under it, and keeps its labels; it is never drawn icon-only.
      const beside = lensBarFitsBesidePill({ ...at, barWidth: labelledWidth.current })
      // PL-155: a bar wider than the canvas column, on a row of its own, ran under the dock at 900 px. Then it is icon-only (each label on hover and
      // for a reader), as the previous product's bar was at narrow widths. The labelled width is remembered, so the labels return when room does.
      const fitsCanvas = lensBarFitsCanvas({ viewportWidth: at.viewportWidth, dockInset: at.dockInset, barWidth: labelledWidth.current })
      if (compactNow.current === fitsCanvas) { compactNow.current = !fitsCanvas; setCompact(!fitsCanvas); return } // measured again once drawn
      // J1 gate: under the core lane's full-width header strip the bar sits on the canvas's top-left, as the prototype's does.
      const strip = pill !== undefined && pill.width >= window.innerWidth - 1
      const next = previousPlace ? placeLensBar({ ...at, barWidth: width }) : strip ? { left: 16, top: Math.floor(pill.bottom + 12) } : beside || !pill ? placeLensBar({ ...at, barWidth: width }) : { left: Math.floor(pill.left), top: Math.floor(pill.bottom + 8) }
      setPlace((held) => (held && held.left === next.left && held.top === next.top ? held : next))
      // UI restore stage 1, row 2: the left toolbar starts under this bar when the bar sits under the pill (it hid the toolbar's "+").
      document.documentElement.style.setProperty('--view-nav-bottom', pill && next.top >= pill.bottom ? `${next.top + 36}px` : '0px')
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('outputs-dock-opened', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    for (const el of [bar.current, document.querySelector('[role="banner"]'), document.querySelector('aside[aria-label="Outputs dock"]')]) if (el && ro) ro.observe(el)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('outputs-dock-opened', measure); ro?.disconnect(); document.documentElement.style.removeProperty('--view-nav-bottom') }
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
  if (nav) return <NavBar barRef={bar} place={place} compact={compact} W={W} />
  return (
    <div ref={bar} role="radiogroup" aria-label={W.bar} data-testid={LENS_BAR_TESTID} onKeyDown={onKeyDown}
      data-compact={compact || undefined}
      className="fixed z-[1250] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel/95 p-1 shadow-2 backdrop-blur-sm transition-[left,top,opacity] duration-200 ease-out"
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, opacity: place ? 1 : 0 }}>
      {VIEW_LENSES.map((id) => {
        const selected = id === lens, Icon = LENS_ICON[id], count = id === 'rests_on' ? olumi : 0, waiting = !usable(id)
        return (
          <button key={id} ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }} type="button" role="radio"
            aria-checked={selected} aria-disabled={waiting || undefined} tabIndex={selected ? 0 : -1} data-testid={`${LENS_BAR_TESTID}-${id}`} title={waiting ? W.needsRun : compact || id === 'tradeoffs' ? W.label[id] : W.hint[id]}
            aria-label={id === 'rests_on' ? W.rests_on_label : W.label[id]}
            onClick={() => { if (!waiting) useViewLens.setState({ lens: id }) }}
            className={`${typography.viewPanelBody} inline-flex h-full items-center gap-1.5 rounded-full border px-3 transition-colors duration-200 ${selected ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : waiting ? 'cursor-default border-transparent text-text-light/60' : 'border-transparent text-text-light hover:text-text-body'} ${ACTION_FOCUS}`}>
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className={compact ? 'sr-only' : undefined} data-lens-label={id}>{W.label[id]}</span>
            {count > 0 ? <span data-testid={`${LENS_BAR_TESTID}-${id}-count`} className={`${typography.viewPanelMeta} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** The lenses Explore holds: every lens but the plain model, in the bar's own order. */
const EXPLORE: readonly ViewLens[] = allBut(VIEW_LENSES, 'full')
// J1 gate (the prototype's three): each its own pill, words only; the one in use outlined in ink on the warm tint, never Olumi's blue.
const SEGMENT = `${typography.viewPanelBody} inline-flex h-full items-center gap-1.5 rounded-full border px-3.5 font-medium transition-colors duration-200 ${ACTION_FOCUS} ${HIT_44}`
const segment = (on: boolean) => `${SEGMENT} ${on ? `border-text-header ${SELECTED}` : 'border-[#EEE6D8] bg-canvas text-text-body hover:text-text-header'}`

/** V11's three: Model, Explore (a menu of the lenses), Team. Placed and measured by ViewLensBar, exactly as the six pills. */
type LensWords = NonNullable<ReturnType<typeof useViewStore.getState>['view']>['lens_words']
function NavBar({ barRef, place, compact, W }: { barRef: RefObject<HTMLDivElement>; place: { left: number; top: number } | null; compact: boolean; W: LensWords }): JSX.Element {
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
    <div ref={barRef} role="toolbar" aria-label={W.bar} data-testid={LENS_BAR_TESTID} data-nav="" data-compact={compact || undefined}
      className="fixed z-[1250] flex items-center gap-2 transition-[left,top] duration-200 ease-out"
      style={{ height: 36, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, visibility: place ? 'visible' : 'hidden' }}>
      <button type="button" aria-pressed={modelOn} data-testid={`${LENS_BAR_TESTID}-full`} title={W.hint.full}
        onClick={pressModel} className={segment(modelOn)}>
<span className={compact ? 'sr-only' : undefined}>{W.label.full}</span>
      </button>
      <div className="relative h-full">
        <button ref={exploreBtn} type="button" aria-haspopup="menu" aria-expanded={open} aria-pressed={exploring} data-testid={`${LENS_BAR_TESTID}-explore`}
          onClick={() => setOpen((o) => !o)} className={segment(exploring || open)}>
          {exploring ? <ExploreIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className={compact ? 'sr-only' : undefined}>{exploring ? W.label[lens] : W.explore}</span>
        </button>
        {!open ? null : (
          <div ref={menu} role="menu" aria-label={W.explore} data-testid={`${LENS_BAR_TESTID}-explore-menu`}
            className="absolute left-0 top-full z-10 mt-2 grid w-[300px] gap-0.5 rounded-2xl border border-panel-border bg-panel p-1.5 shadow-2">
            {EXPLORE.map((id) => {
              const Icon = LENS_ICON[id], waiting = id === 'what_changes' && waits, count = id === 'rests_on' ? olumi : 0, on = id === lens
              return (
                <button key={id} type="button" role="menuitemradio" aria-checked={on} aria-disabled={waiting || undefined} data-testid={`${LENS_BAR_TESTID}-${id}`}
                  onClick={() => { if (waiting) return; useViewLens.setState({ lens: id }); setOpen(false); exploreBtn.current?.focus() }}
                  className={`grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-xl px-3 py-2 text-left ${waiting ? 'cursor-default' : 'cursor-pointer hover:bg-panel-hover'} ${on ? 'bg-[var(--panel-tab-active-bg)]' : ''} ${ACTION_FOCUS}`}>
                  <Icon aria-hidden="true" className={`mt-[3px] h-3.5 w-3.5 ${waiting ? 'text-text-light' : 'text-text-body'}`} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className={`${typography.viewPanelBody} ${waiting ? 'text-text-light' : 'text-text-header'}`}>{W.label[id]}</span>
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
<span className={compact ? 'sr-only' : undefined}>{W.team}</span>
      </button>
    </div>
  )
}
