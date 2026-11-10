import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { PanelRight } from 'lucide-react'
import { useUIStore, type OutputTab } from '../../stores/uiStore'

// Previous OlumiTabBody's pop-out labels (A2 stop/float, DL 10 Nov).
export const CHAT_POPOUT_LABEL = 'Open Olumi in floating panel'
export const CHAT_POPOUT_TITLE = 'Open in floating window'
// Previous FloatingOlumiPanel's dock control (A2 stop/float, DL 10 Nov).
const DOCK_LABEL = 'Dock to panel'
const TARGET = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

type Position = { x: number; y: number }
type Viewport = { width: number; height: number }
type Box = { left: number; top: number; right: number; bottom: number }
const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight })
/** Clear space kept between the window and the canvas's edge, and below the question card or the Model · Explore · Team row (regions.ts REGION_GAP). */
const GAP = 12
/** The least height the default window is shrunk to when it starts lower to clear the question card. */
const MIN_HEIGHT = 280
// Read from the page, never imported: the board's element (ViewCanvas), the dock's column (as regions.ts measures it), the question card
// (React Flow's class for canvas.ts VIEW_QUESTION) and the Model · Explore · Team row (LensBar's LENS_BAR_TESTID).
const CANVAS = '[data-testid="view-canvas"]', DOCK = 'aside[aria-label="Outputs dock"]'
const KEEP_CLEAR = ['.react-flow__node-viewQuestion', '[data-testid="lens-bar"]'] as const
const drawn = (selector: string): Box[] => [...document.querySelectorAll(selector)].flatMap((element) => {
  const r = element.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? [{ left: r.left, top: r.top, right: r.right, bottom: r.bottom }] : []
})
/**
 * THE CANVAS the window stays inside (Build 2 UI, 10 Nov): the board's own element less the dock's column, within the browser window. With no
 * board drawn (a page without the canvas) it is the browser window, as before.
 */
function canvasBox(screen: Viewport): Box {
  const board = drawn(CANVAS)[0], dock = drawn(DOCK)[0]
  const box = board === undefined ? { left: 0, top: 0, right: screen.width, bottom: screen.height }
    : { left: Math.max(0, board.left), top: Math.max(0, board.top), right: Math.min(screen.width, board.right), bottom: Math.min(screen.height, board.bottom) }
  if (dock !== undefined && dock.left > box.left && dock.left < box.right) box.right = dock.left
  return box.right > box.left && box.bottom > box.top ? box : { left: 0, top: 0, right: screen.width, bottom: screen.height }
}
const sizeOf = (box: Box, height: number | null = null) => ({ width: Math.min(380, box.right - box.left), height: Math.min(height ?? 520, box.bottom - box.top) })
const contained = (position: Position, box: Box, height: number | null = null): Position => {
  const size = sizeOf(box, height)
  return {
    x: Math.max(box.left, Math.min(position.x, box.right - size.width)),
    y: Math.max(box.top, Math.min(position.y, box.bottom - size.height)),
  }
}
/**
 * THE DEFAULT PLACE: the canvas's lower right, wholly inside it. Opened at the top left the window covered the question card (10 Nov). Where
 * the lower-right rectangle would still reach the question card or the Model · Explore · Team row, it starts just below them and is that
 * much shorter (never under MIN_HEIGHT). A window the person has dragged keeps the place they gave it.
 */
function defaultPlace(box: Box): Position & { height: number } {
  const size = sizeOf(box)
  const at = contained({ x: box.right - size.width - GAP, y: box.bottom - size.height - GAP }, box)
  const foot = Math.min(box.bottom, at.y + size.height)
  let top = at.y
  for (const r of KEEP_CLEAR.flatMap(drawn)) if (r.right > at.x && r.left < at.x + size.width && r.bottom + GAP > top && r.top < foot) top = r.bottom + GAP
  const height = Math.min(size.height, Math.max(MIN_HEIGHT, foot - top))
  return { x: at.x, y: Math.max(box.top, foot - height), height }
}

// The core chat's geometry only; no previous conversation data (A2 stop/float, DL 10 Nov). `position` null: not yet moved by the person, so
// the window stands at its default place. `height`: the default place's own height when it was shortened to clear the question card, kept
// once the person drags the window from there (a drag moves the window; it never makes it taller over the card).
export const useChatFloat = create<{ floating: boolean; position: Position | null; height?: number | null }>()(() => ({ floating: false, position: null, height: null }))
/**
 * THE DOCK IS NEVER LEFT ON AN EMPTY PANEL: when the chat floats, the dock shows its next tab (the one after Olumi in its own row; the one
 * before it when Olumi is last), by the store's forced activation, which the dock already follows. A dock with no other tab stays as it is.
 */
function showNextDockTab(): void {
  if (useUIStore.getState().activeOutputTab !== 'olumi') return
  const ids = [...document.querySelectorAll('[role="tab"][data-testid^="outputs-dock-tab-"]')].map((tab) => tab.getAttribute('data-testid')!.slice('outputs-dock-tab-'.length))
  const at = ids.indexOf('olumi'), next = at < 0 ? undefined : ids[at + 1] ?? ids[at - 1]
  if (next !== undefined) useUIStore.getState().forceActivateOutputTab(next as OutputTab)
}
export const popOutChat = () => {
  useChatFloat.setState((s) => ({ floating: true, position: s.position === null ? null : contained(s.position, canvasBox(viewport()), s.height ?? null) }))
  showNextDockTab()
}
export function dockChat() {
  useChatFloat.setState({ floating: false })
  useUIStore.getState().forceActivateOutputTab('olumi')
}

export function ChatDockBack({ inWindow = false }: { inWindow?: boolean }) {
  return <button type="button" onClick={dockChat} className={TARGET} aria-label={DOCK_LABEL} title={DOCK_LABEL}
    data-testid={inWindow ? 'view-chat-dockback' : 'view-chat-return'}><PanelRight size={16} aria-hidden="true" /></button>
}

/** One View thread, portalled above the canvas (A2 stop/float, DL 10 Nov). */
export function ChatFloatHost({ children, composer }: { children: ReactNode; composer: ReactNode }) {
  const { floating, position, height } = useChatFloat()
  const [box, setBox] = useState(() => canvasBox(viewport()))
  // The default place, worked out when the window opens and when the browser window changes size: not on every draw, so a board that pans
  // under the window does not move it.
  const [standing, setStanding] = useState<(Position & { height: number }) | null>(null)
  // Move a stable portal target, retaining the thread's state (A2 stop/float, DL 10 Nov).
  const [thread] = useState(() => {
    const element = document.createElement('div')
    element.className = 'flex flex-1 min-h-0 flex-col'
    return element
  })
  const attach = useCallback((slot: HTMLDivElement | null) => { slot?.appendChild(thread) }, [thread])
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; from: Position; pointer: Position } | null>(null)
  useEffect(() => {
    if (!floating) return
    const resize = () => {
      const next = canvasBox(viewport())
      setBox(next)
      setStanding(defaultPlace(next))
      useChatFloat.setState((s) => ({ position: s.position === null ? null : contained(s.position, next, s.height ?? null) }))
    }
    const move = (event: globalThis.PointerEvent) => {
      const start = drag.current
      if (start === null || start.id !== event.pointerId) return
      useChatFloat.setState((s) => ({ position: contained({ x: start.from.x + event.clientX - start.pointer.x, y: start.from.y + event.clientY - start.pointer.y }, canvasBox(viewport()), s.height ?? null) }))
    }
    const end = () => { drag.current = null }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      // Heard first (capture): on screen another Escape handler swallowed the key and the window never docked (probe, 10 Nov). Only
      // when the key is pressed in the window or on the page itself, so a menu or dialog elsewhere keeps its own Escape.
      const at = event.target as Node | null
      if (at !== document.body && !(at !== null && panel.current?.contains(at))) return
      event.stopPropagation()
      event.preventDefault()
      dockChat()
    }
    // THE OLUMI TAB IS NEVER SHOWN AS AN EMPTY PANEL while the chat floats. A press on the dock's Olumi tab (a plain tab choice: the store's
    // version does not move) brings the chat back to the dock. Anything that FRONTS Olumi by forced activation (a card's ask revealing the
    // chat) is answered where the chat is: the window keeps its place and takes focus, and the dock goes back to its next tab.
    const fronted = useUIStore.subscribe((now, before) => {
      if (!useChatFloat.getState().floating || now.activeOutputTab !== 'olumi' || before.activeOutputTab === 'olumi') return
      if (now.activeOutputTabVersion === before.activeOutputTabVersion) { useChatFloat.setState({ floating: false }); return }
      showNextDockTab()
      // No other tab to show: the chat comes back to the dock, as for a press on the tab.
      if (useUIStore.getState().activeOutputTab === 'olumi') useChatFloat.setState({ floating: false })
      else panel.current?.querySelector('textarea')?.focus()
    })
    resize()
    // A dock reopened on its Olumi tab while the chat still floats (the dock was folded away meanwhile) moves on to its next tab too.
    showNextDockTab()
    panel.current?.querySelector('textarea')?.focus()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    window.addEventListener('keydown', escape, true)
    return () => {
      end()
      fronted()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      window.removeEventListener('keydown', escape, true)
    }
  }, [floating])
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('button')) return
    event.preventDefault()
    const moved = useChatFloat.getState().position
    const place = standing ?? defaultPlace(canvasBox(viewport()))
    const from = moved ?? place
    // Dragged from its default place, the window keeps that place's height.
    if (moved === null) useChatFloat.setState({ height: place.height })
    drag.current = { id: event.pointerId, from: { x: from.x, y: from.y }, pointer: { x: event.clientX, y: event.clientY } }
  }
  const conversation = createPortal(children, thread)
  if (!floating) return <><div ref={attach} className="flex flex-1 min-h-0 flex-col" />{conversation}</>
  const kept = height ?? null
  const still = position === null ? standing ?? defaultPlace(box) : null
  const size = still === null ? sizeOf(box, kept) : { ...sizeOf(box), height: still.height }, placed = still ?? contained(position!, box, kept)
  // Previous shell: radius 10, --border-default and --shadow-2 (A2 stop/float, DL 10 Nov).
  return <>{createPortal(
    <div ref={panel} role="dialog" aria-label="Olumi conversation" data-testid="view-chat-float"
      className="fixed flex flex-col overflow-hidden bg-panel text-text-body"
      style={{ zIndex: 300, left: placed.x, top: placed.y, ...size, borderRadius: 10, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-2)' }}>
      <div data-testid="view-chat-float-header" onPointerDown={startDrag}
        className="flex min-h-[44px] shrink-0 select-none items-center justify-end border-b border-panel-border px-1"
        style={{ cursor: 'grab', touchAction: 'none' }}>
        <ChatDockBack inWindow />
      </div>
      <div ref={attach} className="flex flex-1 min-h-0 flex-col" />
      <div className="shrink-0">{composer}</div>
    </div>, document.body,
  )}{conversation}</>
}
