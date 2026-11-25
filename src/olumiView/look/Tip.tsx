/**
 * THE ONE HOVER (panel-and-visual system rule 4, 20 Nov): every hover on the lane is this Tip. 150 ms after the pointer comes to rest or keyboard focus arrives
 * (a focus ring, not a mouse press); placed beside its anchor in its own region; one layout, a title line (the
 * words' first line) and an optional body (the rest), in the 12/16 type scale. `useAnchoredTip` is the one way an icon or a control gets it, so no
 * site writes a native `title` for a hover.
 *
 * THE LANE'S ONE TIP (surfaces step B, 18 Nov): the small box that says what a row cannot fit or why it cannot act. On the lane it stands in for the
 * right-click menu's own tooltip (canvas/contextMenu/MenuTooltip, a second look: rounded-lg, 11 px, grey on the page ground), which the older look,
 * off the lane, keeps until that look has been pictured. One look: the panel's ground and border, 12/16 text,
 * 240 px at most, read only (the pointer passes through, no scroll: the whole text is always drawn). Its position is written
 * to two custom properties.
 */
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { typography } from '../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../canvas/layers'
import { placeNear } from './placeNear'
import { placeHost } from './placeHost'

export const TIP_GAP = 8
/** The one open delay for every hover (ms). */
export const TIP_DELAY = 150
export const TIP_CLASS = `pointer-events-none fixed left-[var(--tip-x,0px)] top-[var(--tip-y,0px)] ${CANVAS_LAYER_CLASS.menuTooltip} ok-tip whitespace-pre-line break-words rounded-sm border border-panel-border bg-panel shadow-1 ${typography.viewPanelMeta} text-text-body`

export type TipSpacing = 'peek' | 'list'

export type TipAnchor = {
  getBoundingClientRect(): DOMRect
  closest?(selector: string): Element | null
  matches?(selector: string): boolean
}

export type ClosestAnchor = Pick<Required<TipAnchor>, 'closest'>
type TipEvent = { currentTarget: TipAnchor }

function closestAnchor(anchor: TipAnchor | undefined): ClosestAnchor | null {
  return typeof anchor?.closest === 'function' ? { closest: anchor.closest.bind(anchor) } : null
}

export function Tip({ id, text, anchorRect, anchor, spacing, icon }: { id?: string; text: string; anchorRect: DOMRect | null; anchor?: TipAnchor; spacing?: TipSpacing; icon?: ReactNode }): JSX.Element | null {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = el.current
    if (t === null || anchorRect === null) return
    const element = closestAnchor(anchor)
    const open = placeHost.openBoxes().filter((box) => !(
      box.left <= anchorRect.left && box.right >= anchorRect.right &&
      box.top <= anchorRect.top && box.bottom >= anchorRect.bottom
    ))
    const { left, top } = placeNear(anchorRect, t.getBoundingClientRect(), {
      region: placeHost.regionFor(element),
      open,
      cards: placeHost.cards(element),
      gap: TIP_GAP,
      limit: TIP_GAP,
    })
    t.style.setProperty('--tip-x', `${left}px`)
    t.style.setProperty('--tip-y', `${top}px`)
  }, [anchorRect, anchor, text, spacing, icon])
  if (anchorRect === null || text === '') return null
  const [head = '', ...rest] = text.split('\n')
  const body = rest.join('\n')
  const stacked = body !== '' && spacing !== undefined
  return (
    <div ref={el} id={id} role="tooltip" data-testid="lane-tip" className={`${TIP_CLASS} ${stacked ? `flex flex-col p-3 ${spacing === 'list' ? 'gap-2' : 'gap-3'}` : 'px-2 py-1'}`}>
      <span data-tip-title="" className={[body === '' ? '' : 'ok-tip-title', icon ? 'flex items-start gap-1.5' : ''].filter(Boolean).join(' ')}>
        {icon ? <><span className="shrink-0">{icon}</span><span className="min-w-0">{head}</span></> : head}
      </span>
      {body === '' ? null : <>{'\n'}<span data-tip-body="" className={stacked ? 'flex flex-col gap-3' : undefined}>
        {stacked ? rest.map((line, i) => <Fragment key={i}>{i === 0 ? null : '\n'}<span>{line}</span></Fragment>) : body}
      </span></>}
    </div>
  )
}

/** One tip on the screen at a time (Codex round 4: a card's tip and an icon's tip inside it opened together). The newest tip to open closes the
 *  one before; since pointerenter reaches an ancestor before its child, the innermost element's tip is the one left open. */
let openTip: (() => void) | null = null

export const useCanvasCardTip = create<{ tipId: string | null }>(() => ({ tipId: null }))

/** The tip's delay (default TIP_DELAY, 150 ms): shown that long after the pointer comes to rest on a row, gone at once when it leaves. */
export function useTipDelay(delay = TIP_DELAY) {
  const [active, setActive] = useState<{ text: string; rect: DOMRect; element: TipAnchor; itemId?: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const close = useRef<() => void>(() => {})
  close.current = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setActive(null) }
  const mine = useRef(() => close.current())
  const showTooltip = (text: string, element: TipAnchor, itemId?: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (openTip !== null && openTip !== mine.current) openTip()
      openTip = mine.current
      setActive({ text, rect: element.getBoundingClientRect(), element, itemId })
    }, delay)
  }
  const hideTooltip = () => {
    close.current()
    if (openTip === mine.current) openTip = null
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (openTip === mine.current) openTip = null }, [])
  return { activeTooltip: active, showTooltip, hideTooltip }
}

export const focusRing = (e: TipEvent): boolean => {
  try { return e.currentTarget.matches?.(':focus-visible') ?? true } catch { return true }
}

/** The anchor moves under a scroll or a resize and the tip keeps its first measure: close it rather than leave it detached. The one place that rule lives (an icon, a button and the context menu all use it). */
export function useTipDismissOnMove(shown: boolean, hide: () => void) {
  const latest = useRef(hide)
  latest.current = hide
  useEffect(() => {
    if (!shown) return
    const close = () => latest.current()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [shown])
}

/**
 * The one way an element gets the one hover. Spread `handlers` on the element and draw `tip` beside it (it is portalled to the body, so no
 * transformed ancestor moves it). Opens on the pointer's rest (mouse and pen) and on keyboard focus; closes on leave, blur, Escape, or `dismiss()`
 * (call it on press). `describedBy` is the tip's id while it is open.
 */
export function useAnchoredTip(words: string | undefined, spacing?: TipSpacing, icon?: ReactNode) {
  const id = useId()
  const { activeTooltip, showTooltip, hideTooltip } = useTipDelay()
  // Two ways to be active, tracked apart: the tip closes only when neither is left (or on Escape / press / scroll / resize).
  const sources = useRef({ pointer: false, focus: false })
  const text = words ?? ''
  const open = (e: TipEvent) => { if (text !== '') showTooltip(text, e.currentTarget) }
  const release = (source: 'pointer' | 'focus') => { sources.current[source] = false; if (!sources.current.pointer && !sources.current.focus) hideTooltip() }
  const dismiss = () => { sources.current.pointer = false; sources.current.focus = false; hideTooltip() }
  const handlers = {
    onPointerEnter: (e: TipEvent & { pointerType?: string }) => { if (e.pointerType !== 'touch') { sources.current.pointer = true; open(e) } },
    onPointerLeave: () => release('pointer'),
    onFocus: (e: TipEvent) => { if (focusRing(e)) { sources.current.focus = true; open(e) } },
    onBlur: () => release('focus'),
    onKeyDown: (e: { key: string }) => { if (e.key === 'Escape') hideTooltip() },
  }
  const shown = activeTooltip !== null && text !== ''
  const anchor = activeTooltip?.element
  const element = closestAnchor(anchor)
  const cardTipOpen = shown && element !== null && element.closest('.react-flow__node') !== null
  useLayoutEffect(() => {
    if (!cardTipOpen) return
    useCanvasCardTip.setState({ tipId: id })
    return () => {
      if (useCanvasCardTip.getState().tipId === id) useCanvasCardTip.setState({ tipId: null })
    }
  }, [cardTipOpen, id])
  useTipDismissOnMove(shown, hideTooltip)
  const tip = shown && typeof document !== 'undefined' ? createPortal(<Tip id={id} text={text} anchorRect={activeTooltip.rect} anchor={anchor} spacing={spacing} icon={icon} />, document.body) : null
  return { handlers, tip, describedBy: shown ? id : undefined, dismiss }
}

/** What a menu row's tip says: its label WHOLE when the row cut it (one line per row), then its own note; just the note when the label fits. */
export function rowTipOf(row: HTMLElement, label: string, note: string | undefined): string | null {
  const drawn = row.querySelector<HTMLElement>('[data-menu-label]')
  const cut = drawn !== null && drawn.scrollWidth > drawn.clientWidth
  const said = note !== undefined && note !== '' ? note : null
  if (!cut) return said
  return said === null || said === label || said.startsWith(label) ? said ?? label : `${label}\n${said}`
}
