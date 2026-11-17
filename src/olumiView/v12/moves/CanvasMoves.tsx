/**
 * OLUMI'S QUESTIONS ON THE CANVAS (contract section 8: "the canvas: the engine's methods for this scenario (`session.methods`) as one rail of
 * icons, seven at most with the rest behind one 'more' icon"). One column in the canvas's left gutter, under the tool column, in Olumi's blue
 * ring: Olumi's mark on top opens core's whole list (core's words, in core's order), then the first RAIL_MAX of core's questions as icons, each
 * named by core's own words for it (hover and screen reader). A press asks core that question exactly as the panel's menu does (ViewChat
 * `runMethod`), and shows Olumi's surface, where the answer lands. Drawn only where the panel offers its own ways to test the model
 * (`movesOffered`). At rest this column is the only new thing on the screen.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { revealOlumiSurface } from '../../../canvas/conversation/revealOlumi'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import { isAnswering, runMethod, useViewChat } from '../../ViewChat'
import { menuOf } from '../actions'
import { ACTIONS_MENU_NAME } from '../actionsMenu'
import { methodIcon, movesOffered, RAIL_MAX } from './registry'

/** Where the rail stands: under the tool column ("Canvas tools"), at its left, with the tool column's own gap. */
const TOOLS = 'nav[aria-label="Canvas tools"]'
const GAP = 8
const BUTTON = 'inline-flex h-[31px] w-[29px] flex-none items-center justify-center rounded-sm text-text-light transition-colors duration-100 hover:bg-info/10 hover:text-text-body disabled:cursor-default disabled:text-text-light disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

const ask = (id: string): void => { revealOlumiSurface(); runMethod(id) }

export function CanvasMoves(): JSX.Element | null {
  const sid = useViewStore((s) => s.sid), view = useViewStore((s) => s.view), at = useViewStore((s) => s.at)
  const busy = useViewChat((s) => s.busy)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const offered = movesOffered(sid, view, at)
  useLayoutEffect(() => {
    if (!offered) return undefined
    const measure = () => {
      const tools = document.querySelector(TOOLS)?.getBoundingClientRect()
      const next = tools === undefined || tools.height === 0 ? null : { left: Math.round(tools.left), top: Math.round(tools.bottom + GAP) }
      setPlace((held) => (held === next || (held !== null && next !== null && held.left === next.left && held.top === next.top) ? held : next))
    }
    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    const tools = document.querySelector(TOOLS)
    if (tools !== null && ro !== null) ro.observe(tools)
    // The tool column moves when the lens bar's row does (its `top` reads `--view-nav-bottom`): read again on that beat too.
    const t = setInterval(measure, 500)
    return () => { clearInterval(t); window.removeEventListener('resize', measure); ro?.disconnect() }
  }, [offered])
  // The list closes on a press outside it, or Escape (focus back on Olumi's mark).
  useEffect(() => {
    if (!open) return undefined
    const away = (e: MouseEvent) => { if (root.current !== null && !root.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('[data-testid="canvas-moves-all"]')?.focus() } }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  if (!offered || view === null) return null
  const menu = menuOf(view)
  if (menu === null || menu.methods.length === 0) return null
  const held = busy || isAnswering(view)
  return (
    <div ref={root} role="toolbar" aria-orientation="vertical" aria-label={ACTIONS_MENU_NAME} data-testid="canvas-moves"
      className="fixed z-[1100] flex flex-col items-center gap-0.5 rounded-md border border-info/30 bg-panel p-[5px] shadow-1"
      style={{ left: place?.left ?? 13, top: place?.top ?? 0, visibility: place === null ? 'hidden' : 'visible' }}>
      <button type="button" data-testid="canvas-moves-all" aria-label={ACTIONS_MENU_NAME} title={ACTIONS_MENU_NAME} aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} className={BUTTON}>
        <OlumiAiIcon size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {menu.methods.slice(0, RAIL_MAX).map((m) => {
        const Icon = methodIcon(m.id)
        return (
          <button key={m.id} type="button" data-method={m.id} data-testid="canvas-moves-method" aria-label={m.text} title={m.text} disabled={held}
            onClick={() => ask(m.id)} className={BUTTON}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )
      })}
      {!open ? null : (
        // Core's whole list, in core's order and words, beside the rail; a gated question carries the menu's own line for what it needs.
        <div role="group" aria-label={ACTIONS_MENU_NAME} data-testid="canvas-moves-list"
          className={`${typography.viewPanelBody} absolute left-full top-0 ml-2 max-h-[60vh] w-[300px] space-y-0.5 overflow-y-auto rounded-lg border border-panel-border bg-panel p-1.5 shadow-2`}>
          {menu.methods.map((m) => {
            const Icon = methodIcon(m.id)
            return (
              <button key={m.id} type="button" data-method={m.id} data-testid="canvas-moves-list-method" disabled={held} onClick={() => { setOpen(false); ask(m.id) }}
                className="grid w-full grid-cols-[14px_minmax(0,1fr)] items-start gap-2 rounded-md px-2 py-1.5 text-left text-text-body hover:bg-panel-hover disabled:cursor-default disabled:text-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
                <Icon className="mt-0.5 h-3.5 w-3.5 text-text-light" strokeWidth={1.75} aria-hidden="true" />
                <span className="grid min-w-0 gap-0.5">
                  <span data-view={`session.methods.${m.i}.text`}>{m.text}</span>
                  {m.prerequisite === null ? null : <span className={`${typography.viewPanelMeta} text-text-light`}>{m.prerequisite}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
