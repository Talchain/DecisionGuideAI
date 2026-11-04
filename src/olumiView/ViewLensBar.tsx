/**
 * THE LENS BAR ON THE CORE LANE: the legacy bar's control (its place, its look, its words and icons, `LensBar.tsx`) with the lenses the
 * View fills (`lens.ts`). One press switches; the arrow keys move along it. Rests on carries the count of Olumi's figures and
 * assumptions to check or set.
 */
import { useRef, useState, useLayoutEffect, type KeyboardEvent } from 'react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { TOP_PILL_HEIGHT_PX, TOP_PILL_TOP_PX } from '../components/layout/TopBar'
import { LENS_BAR_TESTID, placeLensBar } from '../canvas/artefacts/LensBar'
import { LENS_COPY, LENS_ICON } from '../canvas/artefacts/lenses'
import { useRestsOn, useViewLens, VIEW_LENSES, type ViewLens } from './lens'

export function ViewLensBar(): JSX.Element {
  const lens = useViewLens((s) => s.lens)
  const { olumi } = useRestsOn()
  const bar = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<ViewLens, HTMLButtonElement>())
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const pill = document.querySelector('[role="banner"]')?.getBoundingClientRect()
      const next = placeLensBar({ viewportWidth: window.innerWidth, pillRight: pill && pill.width > 0 ? pill.right : 0, dockInset: measureDockInset(), barWidth: bar.current?.getBoundingClientRect().width ?? 0 })
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
    const next = VIEW_LENSES[(VIEW_LENSES.indexOf(lens) + 1) % VIEW_LENSES.length]!
    useViewLens.setState({ lens: next })
    buttons.current.get(next)?.focus()
  }
  return (
    <div ref={bar} role="radiogroup" aria-label={LENS_COPY.bar} data-testid={LENS_BAR_TESTID} onKeyDown={onKeyDown}
      className="fixed z-[1200] flex items-center gap-0.5 rounded-full border border-panel-border bg-panel/95 p-1 shadow-2 backdrop-blur-sm transition-[left,top,opacity] duration-200 ease-out"
      style={{ height: TOP_PILL_HEIGHT_PX, left: place?.left ?? 0, top: place?.top ?? TOP_PILL_TOP_PX, opacity: place ? 1 : 0 }}>
      {VIEW_LENSES.map((id) => {
        const selected = id === lens, Icon = LENS_ICON[id], count = id === 'rests_on' ? olumi : 0
        return (
          <button key={id} ref={(el) => { if (el) buttons.current.set(id, el); else buttons.current.delete(id) }} type="button" role="radio"
            aria-checked={selected} tabIndex={selected ? 0 : -1} data-testid={`${LENS_BAR_TESTID}-${id}`} title={LENS_COPY.hint[id]}
            aria-label={id === 'rests_on' && count > 0 ? `${LENS_COPY.label[id]}, ${LENS_COPY.count.rests_on(count)}` : LENS_COPY.label[id]}
            onClick={() => useViewLens.setState({ lens: id })}
            className={`${typography.panelBody} inline-flex h-full items-center gap-1.5 rounded-full border px-3 transition-colors duration-200 ${selected ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : 'border-transparent text-text-light hover:text-text-body'} ${ACTION_FOCUS}`}>
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {LENS_COPY.label[id]}
            {count > 0 ? <span data-testid={`${LENS_BAR_TESTID}-${id}-count`} className={`${typography.panelMeta} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info/30 px-1 tabular-nums text-text-body`}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
