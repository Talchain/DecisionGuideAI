/**
 * THE ONE HOVER (panel-and-visual system rule 4, 20 Nov): every hover on the lane is this Tip. 150 ms after the pointer comes to rest or keyboard focus arrives
 * (a focus ring, not a mouse press); beside its anchor (right, else left), clamped inside the window on both axes; one layout, a title line (the
 * words' first line) and an optional body (the rest), in the 12/16 type scale. `useAnchoredTip` is the one way an icon or a control gets it, so no
 * site writes a native `title` for a hover.
 *
 * THE LANE'S ONE TIP (surfaces step B, 18 Nov): the small box that says what a row cannot fit or why it cannot act. On the lane it stands in for the
 * right-click menu's own tooltip (canvas/contextMenu/MenuTooltip, a second look: rounded-lg, 11 px, grey on the page ground), which the older look,
 * off the lane, keeps until that look has been pictured. One look: the panel's ground and border, 12/16 text,
 * 240 px at most, read only (the pointer passes through, no scroll: the whole text is always drawn). It stands right of its row, or left of it at the window's edge, and never below the
 * window's foot; where it stands is written to two custom properties, never an inline style.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { typography } from '../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../canvas/layers'

export const TIP_GAP = 8
/** The one open delay for every hover (ms). */
export const TIP_DELAY = 150
export const TIP_CLASS = `pointer-events-none fixed left-[var(--tip-x,0px)] top-[var(--tip-y,0px)] ${CANVAS_LAYER_CLASS.menuTooltip} ok-tip whitespace-pre-line break-words rounded-sm border border-panel-border bg-panel px-2 py-1 shadow-1 ${typography.viewPanelMeta} text-text-body`

export function Tip({ id, text, anchorRect }: { id?: string; text: string; anchorRect: DOMRect | null }): JSX.Element | null {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = el.current
    if (t === null || anchorRect === null) return
    const r = t.getBoundingClientRect()
    let left = anchorRect.right + TIP_GAP, top = anchorRect.top
    if (left + r.width > window.innerWidth) left = anchorRect.left - r.width - TIP_GAP
    // Neither side has room (a narrow window, a wide tip): stay inside the window rather than off its edge.
    left = Math.min(left, window.innerWidth - r.width - TIP_GAP)
    // A tip is never interactive and never scrolls: its whole text is always drawn (olumiLook.css `.ok-tip` caps only the width, so the text wraps).
    // Below the window's foot it flips up (its foot level with the anchor's), and a box taller than the window stays at the margin.
    if (top + r.height > window.innerHeight - TIP_GAP) top = Math.min(anchorRect.bottom - r.height, window.innerHeight - r.height - TIP_GAP)
    t.style.setProperty('--tip-x', `${Math.max(TIP_GAP, left)}px`)
    t.style.setProperty('--tip-y', `${Math.max(TIP_GAP, top)}px`)
  }, [anchorRect, text])
  if (anchorRect === null || text === '') return null
  const [head = '', ...rest] = text.split('\n')
  const body = rest.join('\n')
  // Inline spans with the newline kept between them: the words read the same as one string, and the pre-line break is the only line break.
  return (
    <div ref={el} id={id} role="tooltip" data-testid="lane-tip" className={TIP_CLASS}>
      <span data-tip-title="" className={body === '' ? '' : 'ok-tip-title'}>{head}</span>
      {body === '' ? null : <>{'\n'}<span data-tip-body="">{body}</span></>}
    </div>
  )
}

/** The tip's delay (default TIP_DELAY, 150 ms): shown that long after the pointer comes to rest on a row, gone at once when it leaves. */
export function useTipDelay(delay = TIP_DELAY) {
  const [active, setActive] = useState<{ text: string; rect: DOMRect; itemId?: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTooltip = (text: string, element: HTMLElement, itemId?: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setActive({ text, rect: element.getBoundingClientRect(), itemId }) }, delay)
  }
  const hideTooltip = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setActive(null)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { activeTooltip: active, showTooltip, hideTooltip }
}

export const focusRing = (e: SyntheticEvent<HTMLElement>): boolean => {
  try { return e.currentTarget.matches(':focus-visible') } catch { return true }
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
export function useAnchoredTip(words: string | undefined) {
  const id = useId()
  const { activeTooltip, showTooltip, hideTooltip } = useTipDelay()
  // Two ways to be active, tracked apart: the tip closes only when neither is left (or on Escape / press / scroll / resize).
  const sources = useRef({ pointer: false, focus: false })
  const text = words ?? ''
  const open = (e: SyntheticEvent<HTMLElement>) => { if (text !== '') showTooltip(text, e.currentTarget) }
  const release = (source: 'pointer' | 'focus') => { sources.current[source] = false; if (!sources.current.pointer && !sources.current.focus) hideTooltip() }
  const dismiss = () => { sources.current.pointer = false; sources.current.focus = false; hideTooltip() }
  const handlers = {
    onPointerEnter: (e: SyntheticEvent<HTMLElement> & { pointerType?: string }) => { if (e.pointerType !== 'touch') { sources.current.pointer = true; open(e) } },
    onPointerLeave: () => release('pointer'),
    onFocus: (e: SyntheticEvent<HTMLElement>) => { if (focusRing(e)) { sources.current.focus = true; open(e) } },
    onBlur: () => release('focus'),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Escape') hideTooltip() },
  }
  const shown = activeTooltip !== null && text !== ''
  useTipDismissOnMove(shown, hideTooltip)
  const tip = shown && typeof document !== 'undefined' ? createPortal(<Tip id={id} text={text} anchorRect={activeTooltip.rect} />, document.body) : null
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
