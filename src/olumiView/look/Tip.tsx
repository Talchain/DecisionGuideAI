import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { FLOAT_CLASS } from './float'
import { menuLaneForTarget } from './menuArbiter'
import { currentTipGeneration, registerPopup, tipBlocked } from './popupLayers'
import { typography } from '../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../canvas/layers'
import { placeNear } from './placeNear'
import { placeHost } from './placeHost'

export const TIP_GAP = 8
/** The one open delay for every hover (ms). */
export const TIP_DELAY = 150
const OLDER_TIP = `rounded-sm border border-panel-border bg-panel shadow-1 ${typography.viewPanelMeta}`
export const TIP_CLASS = `pointer-events-none fixed left-[var(--tip-x,0px)] top-[var(--tip-y,0px)] ${CANVAS_LAYER_CLASS.menuTooltip} ok-tip whitespace-pre-line break-words text-text-body`

export type TipSpacing = 'peek' | 'list'

function anchorElement(anchor: HTMLElement | undefined): HTMLElement | undefined {
  return typeof anchor?.closest === 'function' ? anchor : undefined
}

export function Tip({ id, text, anchorRect, anchor, spacing, icon }: { id?: string; text: string; anchorRect: DOMRect | null; anchor?: HTMLElement; spacing?: TipSpacing; icon?: ReactNode }): JSX.Element | null {
  const el = useRef<HTMLDivElement>(null)
  const lane = isOlumiCoreLane()
  useLayoutEffect(() => {
    const t = el.current
    if (t === null || anchorRect === null) return
    const element = anchorElement(anchor) ?? null
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
    <div ref={el} id={id} role="tooltip" data-testid="lane-tip" className={`${TIP_CLASS} ${lane ? FLOAT_CLASS : `${OLDER_TIP} ${stacked ? `flex flex-col p-3 ${spacing === 'list' ? 'gap-2' : 'gap-3'}` : 'px-2 py-1'}`}`}>
      <span data-tip-title="" className={[body === '' ? '' : 'ok-tip-title', icon ? 'flex items-start gap-1.5' : ''].filter(Boolean).join(' ')}>
        {icon ? <><span className="shrink-0">{icon}</span><span className="min-w-0">{head}</span></> : head}
      </span>
      {body === '' ? null : <>{lane ? null : '\n'}<span data-tip-body="" className={stacked ? (lane ? 'flex flex-col gap-2' : 'flex flex-col gap-3') : undefined}>
        {stacked ? rest.map((line, i) => <Fragment key={i}>{lane || i === 0 ? null : '\n'}<span>{line}</span></Fragment>) : body}
      </span></>}
    </div>
  )
}

/** One tip on the screen at a time (Codex round 4: a card's tip and an icon's tip inside it opened together). The newest tip to open closes the
 *  one before; since pointerenter reaches an ancestor before its child, the innermost element's tip is the one left open. */
let openTip: (() => void) | null = null

/** The tip's delay (default TIP_DELAY, 150 ms): shown that long after the pointer comes to rest on a row, gone at once when it leaves. */
export function useTipDelay(delay = TIP_DELAY) {
  const [active, setActive] = useState<{ text: string; rect: DOMRect; element: HTMLElement } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unregister = useRef<(() => void) | null>(null)
  const close = useRef<() => void>(() => {})
  close.current = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    unregister.current?.()
    unregister.current = null
    setActive(null)
  }
  const mine = useRef(() => close.current())
  const showTooltip = (text: string, element: HTMLElement) => {
    const menuLane = element.hasAttribute?.('data-menu-row') ? menuLaneForTarget(element) : undefined
    const lane = menuLane ?? isOlumiCoreLane()
    const menuRow = menuLane === true
    const blocked = () => menuRow ? menuLaneForTarget(element) !== true : tipBlocked()
    if (lane && blocked()) return
    if (timer.current) clearTimeout(timer.current)
    const generation = currentTipGeneration()
    timer.current = setTimeout(() => {
      timer.current = null
      if (lane) {
        if (generation !== currentTipGeneration() || blocked()) return
        unregister.current = registerPopup('tip', mine.current, null, null, { parentOwnsEscape: menuRow })
      } else {
        if (openTip !== null && openTip !== mine.current) openTip()
        openTip = mine.current
      }
      setActive({ text, rect: element.getBoundingClientRect(), element })
    }, delay)
  }
  const hideTooltip = useCallback(() => {
    close.current()
    if (openTip === mine.current) openTip = null
  }, [])
  useEffect(() => {
    const legacyTip = mine.current
    return () => {
      if (timer.current) clearTimeout(timer.current)
      unregister.current?.()
      if (openTip === legacyTip) openTip = null
    }
  }, [])
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
export function useAnchoredTip(words: string | undefined, spacing?: TipSpacing, icon?: ReactNode) {
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
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Escape' && !isOlumiCoreLane()) hideTooltip() },
  }
  useLayoutEffect(() => {
    if (text === '' && isOlumiCoreLane()) hideTooltip()
  }, [hideTooltip, text])
  const shown = activeTooltip !== null && text !== ''
  const anchor = anchorElement(activeTooltip?.element)
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
