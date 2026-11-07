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
import { ChevronDown, Compass, Users } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../components/layout/TopBar'
import { LENS_BAR_TESTID, lensBarFitsBesidePill, placeLensBar } from '../canvas/artefacts/LensBar'
import { LENS_COPY, LENS_ICON } from '../canvas/artefacts/lenses'
import { useDrivers, useRestsOn, useViewLens, VIEW_LENSES, type ViewLens } from './lens'

export function ViewLensBar({ nav = false }: { nav?: boolean } = {}): JSX.Element {
  const lens = useViewLens((s) => s.lens)
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
      const nextCompact = !lensBarFitsBesidePill({ ...at, barWidth: labelledWidth.current })
      if (nextCompact !== compactNow.current) { compactNow.current = nextCompact; setCompact(nextCompact); return } // measured again once drawn
      const next = placeLensBar({ ...at, barWidth: width })
      setPlace((held) => (held && held.left === next.left && held.top === next.top ? held : next))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('outputs-dock-opened', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    for (const el of [bar.current, document.querySelector('[role="banner"]'), document.querySelector('aside[aria-label="Outputs dock"]')]) if (el && ro) ro.observe(el)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('outputs-dock-opened', measure); ro?.disconnect() }
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
  if (nav) return <NavBar barRef={bar} place={place} compact={compact} />
  return (
    <div ref={bar} role="radiogroup" aria-label={LENS_COPY.bar} data-testid={LENS_BAR_TESTID} onKeyDown={onKeyDown}
      data-compact={compact || undefined}
      className="fixed z-[1250] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel/95 p-1 shadow-2 backdrop-blur-sm transition-[left,top,opacity] duration-200 ease-out"
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, opacity: place ? 1 : 0 }}>
      {VIEW_LENSES.map((id) => {
        const selected = id === lens, Icon = LENS_ICON[id], count = id === 'rests_on' ? olumi : 0, waiting = !usable(id)
        return (
          <button key={id} ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }} type="button" role="radio"
            aria-checked={selected} aria-disabled={waiting || undefined} tabIndex={selected ? 0 : -1} data-testid={`${LENS_BAR_TESTID}-${id}`} title={waiting ? LENS_COPY.needsRun : compact || id === 'tradeoffs' ? LENS_COPY.label[id] : LENS_COPY.hint[id]}
            aria-label={id === 'rests_on' && count > 0 ? `${LENS_COPY.label[id]}, ${LENS_COPY.count.rests_on(count)}` : LENS_COPY.label[id]}
            onClick={() => { if (!waiting) useViewLens.setState({ lens: id }) }}
            className={`${typography.viewPanelBody} inline-flex h-full items-center gap-1.5 rounded-full border px-3 transition-colors duration-200 ${selected ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : waiting ? 'cursor-default border-transparent text-text-light/60' : 'border-transparent text-text-light hover:text-text-body'} ${ACTION_FOCUS}`}>
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className={compact ? 'sr-only' : undefined} data-lens-label={id}>{LENS_COPY.label[id]}</span>
            {count > 0 ? <span data-testid={`${LENS_BAR_TESTID}-${id}-count`} className={`${typography.viewPanelMeta} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** The lenses Explore holds: every lens but the plain model, in the bar's own order. */
const EXPLORE: readonly ViewLens[] = VIEW_LENSES.filter((id) => id !== 'full')
// Tighter than the six pills (px-2.5, gap-1), so the three keep their words beside the pill on Paul's 1232 px screen.
const SEGMENT = `${typography.viewPanelBody} inline-flex h-full items-center gap-1 rounded-full border px-2.5 transition-colors duration-200 ${ACTION_FOCUS}`
const segment = (on: boolean) => `${SEGMENT} ${on ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : 'border-transparent text-text-light hover:text-text-body'}`

/** V11's three: Model, Explore (a menu of the lenses), Team. Placed and measured by ViewLensBar, exactly as the six pills. */
function NavBar({ barRef, place, compact }: { barRef: RefObject<HTMLDivElement>; place: { left: number; top: number } | null; compact: boolean }): JSX.Element {
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
  const ExploreIcon = exploring ? LENS_ICON[lens] : Compass
  return (
    <div ref={barRef} role="toolbar" aria-label={LENS_COPY.bar} data-testid={LENS_BAR_TESTID} data-nav="" data-compact={compact || undefined}
      className="fixed z-[1250] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel/95 p-1 shadow-2 backdrop-blur-sm transition-[left,top,opacity] duration-200 ease-out"
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, opacity: place ? 1 : 0 }}>
      <button type="button" aria-pressed={!exploring} data-testid={`${LENS_BAR_TESTID}-full`} title={LENS_COPY.hint.full}
        onClick={() => { useViewLens.setState({ lens: 'full' }); setOpen(false) }} className={segment(!exploring)}>
        <LENS_ICON.full aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className={compact ? 'sr-only' : undefined}>{LENS_COPY.label.full}</span>
      </button>
      <div className="relative h-full">
        <button ref={exploreBtn} type="button" aria-haspopup="menu" aria-expanded={open} aria-pressed={exploring} data-testid={`${LENS_BAR_TESTID}-explore`}
          onClick={() => setOpen((o) => !o)} className={segment(exploring || open)}>
          <ExploreIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className={compact ? 'sr-only' : undefined}>{exploring ? LENS_COPY.label[lens] : 'Explore'}</span>
          <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0" />
        </button>
        {!open ? null : (
          <div ref={menu} role="menu" aria-label="Explore" data-testid={`${LENS_BAR_TESTID}-explore-menu`}
            className="absolute left-0 top-full z-10 mt-2 grid w-[300px] gap-0.5 rounded-2xl border border-panel-border bg-panel p-1.5 shadow-2">
            {EXPLORE.map((id) => {
              const Icon = LENS_ICON[id], waiting = id === 'what_changes' && waits, count = id === 'rests_on' ? olumi : 0, on = id === lens
              return (
                <button key={id} type="button" role="menuitemradio" aria-checked={on} aria-disabled={waiting || undefined} data-testid={`${LENS_BAR_TESTID}-${id}`}
                  onClick={() => { if (waiting) return; useViewLens.setState({ lens: id }); setOpen(false); exploreBtn.current?.focus() }}
                  className={`grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-xl px-3 py-2 text-left ${waiting ? 'cursor-default' : 'cursor-pointer hover:bg-panel-hover'} ${on ? 'bg-[var(--panel-tab-active-bg)]' : ''} ${ACTION_FOCUS}`}>
                  <Icon aria-hidden="true" className={`mt-[3px] h-3.5 w-3.5 ${waiting ? 'text-text-light' : 'text-text-body'}`} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className={`${typography.viewPanelBody} ${waiting ? 'text-text-light' : 'text-text-header'}`}>{LENS_COPY.label[id]}</span>
                    <span className={`${typography.viewPanelMeta} text-text-light`}>{waiting ? LENS_COPY.needsRun : LENS_COPY.hint[id]}</span>
                  </span>
                  {count > 0 ? <span className={`${typography.viewPanelMeta} mt-[2px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : <span />}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <button type="button" data-testid={`${LENS_BAR_TESTID}-team`} onClick={() => { setOpen(false); useUIStore.getState().forceActivateOutputTab('team') }} className={segment(false)}>
        <Users aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className={compact ? 'sr-only' : undefined}>Team</span>
      </button>
    </div>
  )
}
