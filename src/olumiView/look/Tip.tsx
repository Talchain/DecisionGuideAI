/**
 * THE LANE'S ONE TIP (surfaces step B, 18 Nov): the small box that says what a row cannot fit or why it cannot act. On the lane it stands in for the
 * right-click menu's own tooltip (canvas/contextMenu/MenuTooltip, a second look: rounded-lg, 11 px, grey on the page ground), which the older look,
 * off the lane, keeps until that look has been pictured. One look: the panel's ground and border, 12/16 text,
 * 240 px at most, read only (the pointer passes through). It stands right of its row, or left of it at the window's edge, and never below the
 * window's foot; where it stands is written to two custom properties, never an inline style.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../canvas/layers'

export const TIP_GAP = 8
export const TIP_CLASS = `pointer-events-none fixed left-[var(--tip-x,0px)] top-[var(--tip-y,0px)] ${CANVAS_LAYER_CLASS.menuTooltip} max-w-[240px] whitespace-pre-line break-words rounded-sm border border-panel-border bg-panel px-2 py-1 shadow-1 ${typography.viewPanelMeta} text-text-body`

export function Tip({ id, text, anchorRect }: { id?: string; text: string; anchorRect: DOMRect | null }): JSX.Element | null {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = el.current
    if (t === null || anchorRect === null) return
    const r = t.getBoundingClientRect()
    let left = anchorRect.right + TIP_GAP, top = anchorRect.top
    if (left + r.width > window.innerWidth) left = anchorRect.left - r.width - TIP_GAP
    if (top + r.height > window.innerHeight) top = window.innerHeight - r.height - TIP_GAP
    t.style.setProperty('--tip-x', `${Math.max(TIP_GAP, left)}px`)
    t.style.setProperty('--tip-y', `${Math.max(TIP_GAP, top)}px`)
  }, [anchorRect, text])
  if (anchorRect === null || text === '') return null
  return <div ref={el} id={id} role="tooltip" data-testid="lane-tip" className={TIP_CLASS}>{text}</div>
}

/** The tip's delay: shown 300 ms after the pointer comes to rest on a row, gone at once when it leaves. */
export function useTipDelay(delay = 300) {
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

/** What a menu row's tip says: its label WHOLE when the row cut it (one line per row), then its own note; just the note when the label fits. */
export function rowTipOf(row: HTMLElement, label: string, note: string | undefined): string | null {
  const drawn = row.querySelector<HTMLElement>('[data-menu-label]')
  const cut = drawn !== null && drawn.scrollWidth > drawn.clientWidth
  const said = note !== undefined && note !== '' ? note : null
  if (!cut) return said
  return said === null || said === label || said.startsWith(label) ? said ?? label : `${label}\n${said}`
}
