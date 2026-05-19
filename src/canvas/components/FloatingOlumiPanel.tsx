import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, Minus, PanelRight } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'
import {
  useFloatingPanelState,
  type FloatingPanelPosition,
  type FloatingPanelSize,
} from '../hooks/useFloatingPanelState'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { registerFloatingFocus } from '../hooks/useFloatingFocus'

interface FloatingOlumiPanelProps {
  /** Called when the user clicks the Dock button. The host should switch the
   *  active tab to 'olumi' and ensure the dock is open. */
  onDock: () => void
  /** Called when the user clicks the cog icon in the floating composer. */
  onCogClick: (anchorEl: HTMLElement) => void
}

const MIN_WIDTH = 320
const MIN_HEIGHT = 300
const DEFAULT_MARGIN = 16

const noop = () => {}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function computeMaxSize(viewportW: number, viewportH: number): FloatingPanelSize {
  return {
    width: Math.floor(viewportW * 0.6),
    height: Math.floor(viewportH * 0.8),
  }
}

function defaultCentredPosition(size: FloatingPanelSize, viewportW: number, viewportH: number): FloatingPanelPosition {
  return {
    x: Math.max(DEFAULT_MARGIN, Math.floor((viewportW - size.width) / 2)),
    y: Math.max(DEFAULT_MARGIN, Math.floor((viewportH - size.height) / 2)),
  }
}

/**
 * FloatingOlumiPanel — portaled draggable/resizable Olumi conversation window.
 *
 * Performance: pointer-move handlers update the panel's CSS via direct style
 * writes on the underlying DOM ref (NOT React state) and coalesce into one
 * rAF tick per frame. The Zustand store is updated only on pointerup so we
 * never re-render the React tree during a drag/resize. This keeps drags at
 * 60fps even with hundreds of conversation messages mounted.
 *
 * Portals to document.body to escape React Flow's CSS transforms — inside a
 * transformed ancestor, `position: fixed` is relative to that ancestor and
 * breaks alignment.
 *
 * Z-index: 300. Below popovers (400) and modals so a CogPopover or modal
 * stays on top.
 */
export const FloatingOlumiPanel = memo(function FloatingOlumiPanel({ onDock, onCogClick }: FloatingOlumiPanelProps) {
  const conversation = useConversationContext()
  // Subscribe to primitive slices to avoid re-render churn (returning a new
  // object from a selector breaks Zustand's referential equality check).
  const isOpen = useFloatingPanelState((s) => s.isOpen)
  const isMinimised = useFloatingPanelState((s) => s.isMinimised)
  const source = useFloatingPanelState((s) => s.source)
  const position = useFloatingPanelState((s) => s.position)
  const size = useFloatingPanelState((s) => s.size)
  const setPosition = useFloatingPanelState((s) => s.setPosition)
  const setInitialPosition = useFloatingPanelState((s) => s.setInitialPosition)
  const setSize = useFloatingPanelState((s) => s.setSize)
  const close = useFloatingPanelState((s) => s.close)
  const minimise = useFloatingPanelState((s) => s.minimise)
  const restore = useFloatingPanelState((s) => s.restore)
  // First-use composer takes over rendering when the system opened the panel
  // on an empty canvas with no real messages — yield to that surface so
  // exactly one composer is mounted at a time.
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const realMessageCount = conversation.messages.filter((m) => !m.synthetic).length
  const yieldToFirstUse = source === 'system-first-use' && nodeCount === 0 && realMessageCount === 0

  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputBarRef = useRef<AIInputBarHandle | null>(null)
  const rafRef = useRef<number | null>(null)
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const resizeStateRef = useRef<{ pointerId: number; startX: number; startY: number; startW: number; startH: number } | null>(null)

  // Apply position/size to DOM whenever isOpen flips to true OR the store
  // commits a new value (drag/resize end). During drag/resize this is bypassed
  // — handlers write directly to el.style.
  //
  // `isMinimised` is in the deps so this effect re-runs when restoring from
  // the pill: while minimised, the full panel isn't rendered (containerRef is
  // null) so the previous DOM-write is lost; on restore the panel remounts
  // with the JSX default styles (0, 0, 400, 500) and we need to reapply the
  // stored position/size or the user sees the panel jump back to default.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !isOpen || isMinimised) return
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const max = computeMaxSize(vw, vh)
    const w = clamp(size.width, MIN_WIDTH, max.width)
    const h = clamp(size.height, MIN_HEIGHT, max.height)
    const pos = position ?? defaultCentredPosition({ width: w, height: h }, vw, vh)
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.left = `${pos.x}px`
    el.style.top = `${pos.y}px`
    // Commit the computed centred default into the store the first time the
    // panel opens. Without this, the minimise pill would fall back to its
    // 50%/50% CSS placeholder because store.position is still null.
    if (position === null) {
      setInitialPosition(pos)
    }
  }, [isOpen, isMinimised, position, size, setInitialPosition])

  // Register a focus channel so the persistent status strip and Olumi-tab
  // click (when floating is open) can imperatively focus the input.
  //
  // - Skip when yielding to FirstUseComposer — that surface owns its own
  //   registration so focus lands in its textarea (otherwise our input ref
  //   would be null because the JSX below never mounts in yield mode).
  // - When the panel is minimised the input is unmounted; restore first and
  //   schedule the focus on the next frame so React can remount before we
  //   call .focus() on the ref.
  useEffect(() => {
    if (!isOpen || yieldToFirstUse) return
    return registerFloatingFocus(() => {
      const state = useFloatingPanelState.getState()
      if (state.isMinimised) {
        state.restore()
        requestAnimationFrame(() => inputBarRef.current?.focus())
      } else {
        inputBarRef.current?.focus()
      }
    })
  }, [isOpen, yieldToFirstUse])

  // Clamp on viewport resize so the panel never leaves the visible area.
  useEffect(() => {
    if (!isOpen) return
    const handle = () => {
      const el = containerRef.current
      if (!el) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const max = computeMaxSize(vw, vh)
      const w = clamp(parseFloat(el.style.width || '0') || size.width, MIN_WIDTH, max.width)
      const h = clamp(parseFloat(el.style.height || '0') || size.height, MIN_HEIGHT, max.height)
      const x = clamp(parseFloat(el.style.left || '0'), DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vw - w - DEFAULT_MARGIN))
      const y = clamp(parseFloat(el.style.top || '0'), DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vh - h - DEFAULT_MARGIN))
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [isOpen, size])

  // Pointer-driven drag from the header bar.
  const handleHeaderPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Ignore drags initiated from header buttons.
    if ((e.target as HTMLElement).closest('button')) return
    const el = containerRef.current
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    dragStateRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Some test envs don't implement pointer capture — fall back to window listeners.
    }
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const el = containerRef.current
    if (!el) return
    const drag = dragStateRef.current
    const resize = resizeStateRef.current
    if (!drag && !resize) return

    // Coalesce all pointer-move work into one rAF tick.
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const vw = window.innerWidth
      const vh = window.innerHeight
      const max = computeMaxSize(vw, vh)

      if (drag) {
        const w = parseFloat(el.style.width || '400')
        const h = parseFloat(el.style.height || '500')
        const x = clamp(e.clientX - drag.offsetX, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vw - w - DEFAULT_MARGIN))
        const y = clamp(e.clientY - drag.offsetY, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vh - h - DEFAULT_MARGIN))
        el.style.left = `${x}px`
        el.style.top = `${y}px`
      } else if (resize) {
        const dw = e.clientX - resize.startX
        const dh = e.clientY - resize.startY
        const w = clamp(resize.startW + dw, MIN_WIDTH, max.width)
        const h = clamp(resize.startH + dh, MIN_HEIGHT, max.height)
        el.style.width = `${w}px`
        el.style.height = `${h}px`
      }
    })
  }, [])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const el = containerRef.current
    const drag = dragStateRef.current
    const resize = resizeStateRef.current
    if (drag && drag.pointerId === e.pointerId) {
      dragStateRef.current = null
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (el) {
        // Commit the final position to the store (single render).
        setPosition({
          x: parseFloat(el.style.left || '0'),
          y: parseFloat(el.style.top || '0'),
        })
      }
    }
    if (resize && resize.pointerId === e.pointerId) {
      resizeStateRef.current = null
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (el) {
        setSize({
          width: parseFloat(el.style.width || '0'),
          height: parseFloat(el.style.height || '0'),
        })
      }
    }
  }, [setPosition, setSize])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isOpen, handlePointerMove, handlePointerUp])

  // Resize handle pointer-down.
  const handleResizePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    resizeStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
    }
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // pointer capture optional
    }
  }, [])

  const handleMinimise = useCallback(() => {
    minimise()
  }, [minimise])

  if (!isOpen || yieldToFirstUse) return null
  if (typeof document === 'undefined') return null

  // Minimised: render a small restore pill at the panel's last position.
  // Position is initialised on open via setInitialPosition, so this should
  // never fall back to 50%/50% in normal flow. Defensive fallback kept for
  // edge cases (SSR rehydrate, etc.).
  if (isMinimised) {
    const pos = position
    return createPortal(
      <button
        type="button"
        onClick={restore}
        className="fixed inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-panel border border-panel-border shadow-2 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        style={{
          zIndex: 300,
          left: pos ? pos.x : '50%',
          top: pos ? pos.y : '50%',
        }}
        data-testid="floating-olumi-panel-pill"
        aria-label="Restore Olumi"
        title="Restore Olumi"
      >
        <MessageSquare className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
        <span className={typo('panelMeta', 'text-text-body')}>Olumi</span>
      </button>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Olumi conversation"
      data-testid="floating-olumi-panel"
      className="fixed bg-panel border border-panel-border rounded-lg shadow-2 flex flex-col"
      style={{
        zIndex: 300,
        width: 400,
        height: 500,
        left: 0,
        top: 0,
        overflow: 'hidden',
      }}
    >
      <div
        onPointerDown={handleHeaderPointerDown}
        className="flex items-center justify-between px-3 h-8 bg-panel border-b border-panel-border select-none"
        style={{ cursor: 'grab' }}
        data-testid="floating-olumi-panel-header"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MessageSquare className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
          <span className={typo('panelHeader', 'text-text-body truncate')}>Olumi</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleMinimise}
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            aria-label="Minimise"
            data-testid="floating-olumi-panel-minimise"
            title="Minimise"
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDock}
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            aria-label="Dock to panel"
            data-testid="floating-olumi-panel-dock"
            title="Dock to panel"
          >
            <PanelRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col">
        <ConversationPanel
          conversation={conversation}
          onCollapse={close}
          /* hideTopBar means ChatTopBar's onAttach is never called — pass no-op. */
          onAttach={noop}
          hideComposer
          hideTopBar
        />
      </div>

      <AIInputBar ref={inputBarRef} variant="floating" onCogClick={onCogClick} hideChevron />

      <div
        onPointerDown={handleResizePointerDown}
        className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize"
        data-testid="floating-olumi-panel-resize-handle"
        aria-hidden="true"
      >
        <span
          aria-hidden="true"
          className="absolute right-0.5 bottom-0.5 w-1.5 h-1.5 border-r-2 border-b-2 border-text-light opacity-60"
        />
      </div>
    </div>,
    document.body,
  )
})
