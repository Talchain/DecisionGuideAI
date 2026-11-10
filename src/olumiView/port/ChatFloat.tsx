import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { PanelRight } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

// Previous OlumiTabBody's pop-out labels (A2 stop/float, DL 10 Nov).
export const CHAT_POPOUT_LABEL = 'Open Olumi in floating panel'
export const CHAT_POPOUT_TITLE = 'Open in floating window'
// Previous FloatingOlumiPanel's dock control (A2 stop/float, DL 10 Nov).
const DOCK_LABEL = 'Dock to panel'
const TARGET = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

type Position = { x: number; y: number }
type Viewport = { width: number; height: number }
const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight })
const sizeOf = ({ width, height }: Viewport) => ({ width: Math.min(380, width), height: Math.min(520, height) })
const contained = (position: Position, screen: Viewport): Position => {
  const size = sizeOf(screen)
  return {
    x: Math.max(0, Math.min(position.x, screen.width - size.width)),
    y: Math.max(0, Math.min(position.y, screen.height - size.height)),
  }
}

// The core chat's geometry only; no previous conversation data (A2 stop/float, DL 10 Nov).
export const useChatFloat = create<{ floating: boolean; position: Position }>()(() => ({ floating: false, position: { x: 52, y: 78 } }))
export const popOutChat = () => useChatFloat.setState((s) => ({ floating: true, position: contained(s.position, viewport()) }))
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
  const { floating, position } = useChatFloat()
  const [screen, setScreen] = useState(viewport)
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
      const next = viewport()
      setScreen(next)
      useChatFloat.setState((s) => ({ position: contained(s.position, next) }))
    }
    const move = (event: globalThis.PointerEvent) => {
      const start = drag.current
      if (start === null || start.id !== event.pointerId) return
      useChatFloat.setState({ position: contained({ x: start.from.x + event.clientX - start.pointer.x, y: start.from.y + event.clientY - start.pointer.y }, viewport()) })
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
    resize()
    panel.current?.querySelector('textarea')?.focus()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    window.addEventListener('keydown', escape, true)
    return () => {
      end()
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
    drag.current = { id: event.pointerId, from: useChatFloat.getState().position, pointer: { x: event.clientX, y: event.clientY } }
  }
  const conversation = createPortal(children, thread)
  if (!floating) return <><div ref={attach} className="flex flex-1 min-h-0 flex-col" />{conversation}</>
  const size = sizeOf(screen), placed = contained(position, screen)
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
