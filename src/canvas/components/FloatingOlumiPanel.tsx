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
 * Clamp a candidate position into the visible canvas area so the panel
 * never sits partially (or fully) off-screen AND never lands under the
 * OutputsDock (z-900, would obscure the floating panel at z-300).
 *
 * `rightInset` reserves space from the viewport's right edge inward —
 * callers pass the dock's measured offset (see `measureDockInset`). It
 * captures both the dock's width and any right-edge gap so the floating
 * panel cannot land in the strip between the dock and the viewport edge.
 */
export function clampPositionToViewport(
  pos: FloatingPanelPosition,
  size: FloatingPanelSize,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): FloatingPanelPosition {
  const maxX = Math.max(DEFAULT_MARGIN, viewportW - size.width - DEFAULT_MARGIN - rightInset)
  return {
    x: clamp(pos.x, DEFAULT_MARGIN, maxX),
    y: clamp(pos.y, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, viewportH - size.height - DEFAULT_MARGIN)),
  }
}

const PILL_W = 84
const PILL_H = 28
/**
 * Compute the maximum size a panel may grow to during a bottom-right
 * resize drag, given the current top-left position and dock inset. The
 * panel's x/y do not move during resize, so the right edge of the panel
 * cannot extend past `vw - dockInset - DEFAULT_MARGIN`.
 *
 * Returns raw geometry only (floored at 0). Callers compose this with
 * `MIN_WIDTH` / `MIN_HEIGHT`. See `fitsAtMinSize` — when the available
 * space is smaller than MIN, the safe UX is to auto-minimise to the
 * restore pill rather than render a too-narrow panel.
 */
export function computeResizeBudget(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): { widthBudget: number; heightBudget: number } {
  return {
    widthBudget: Math.max(0, viewportW - x - DEFAULT_MARGIN - rightInset),
    heightBudget: Math.max(0, viewportH - y - DEFAULT_MARGIN),
  }
}

/**
 * Returns true when the available canvas (viewport minus dock inset and
 * margins on both sides) can fit a panel at MIN_WIDTH × MIN_HEIGHT.
 * When false, the panel should auto-minimise to the pill — rendering at
 * a sub-MIN_WIDTH size would be unusable.
 */
export function fitsAtMinSize(
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): boolean {
  const availableW = viewportW - 2 * DEFAULT_MARGIN - rightInset
  const availableH = viewportH - 2 * DEFAULT_MARGIN
  return availableW >= MIN_WIDTH && availableH >= MIN_HEIGHT
}

export function clampPillPositionToViewport(
  pos: FloatingPanelPosition,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): FloatingPanelPosition {
  const maxX = Math.max(DEFAULT_MARGIN, viewportW - PILL_W - DEFAULT_MARGIN - rightInset)
  return {
    x: clamp(pos.x, DEFAULT_MARGIN, maxX),
    y: clamp(pos.y, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, viewportH - PILL_H - DEFAULT_MARGIN)),
  }
}

/**
 * Compute the reserved area at the right edge for the OutputsDock —
 * `vw - dock.left` captures the dock's width AND any right-edge gap
 * (e.g. `right: 12px`). The OutputsDock is the only element in the app
 * with this aria-label, so the selector is unambiguous.
 *
 * Returns 0 when the dock element is absent (FF-off path) or has zero
 * size (defensive — e.g. hidden via CSS). No half-viewport guard:
 * narrow viewports legitimately place a right-anchored dock with
 * `dock.left < vw/2`, and the inset must still be reserved so the
 * floating panel doesn't drift under it.
 */
function measureDockInset(): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0
  const dock = document.querySelector('aside[aria-label="Outputs dock"]') as HTMLElement | null
  if (!dock) return 0
  const rect = dock.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return 0
  const inset = window.innerWidth - rect.left
  return inset > 0 ? inset : 0
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
    const dockInset = measureDockInset()
    // If the dock + margins leave less room than MIN_WIDTH × MIN_HEIGHT,
    // auto-minimise to the pill instead of rendering an unusably narrow
    // panel. User can close the dock to restore. This preserves the
    // brief's "MIN_WIDTH whenever possible, otherwise minimise" rule.
    if (!fitsAtMinSize(vw, vh, dockInset)) {
      minimise()
      return
    }
    const max = computeMaxSize(vw, vh)
    const w = clamp(size.width, MIN_WIDTH, max.width)
    const h = clamp(size.height, MIN_HEIGHT, max.height)
    // Restored / stored positions can land outside the visible canvas when
    // the window has shrunk OR when the OutputsDock is open. Clamp so the
    // header is always visible, grabbable, and not under the dock. Mirrors
    // handlePointerMove's drag-time clamp so the same bounds apply across
    // entry points.
    const rawPos = position ?? defaultCentredPosition({ width: w, height: h }, vw - dockInset, vh)
    const pos = clampPositionToViewport(rawPos, { width: w, height: h }, vw, vh, dockInset)
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.left = `${pos.x}px`
    el.style.top = `${pos.y}px`
    // Commit the centred default the FIRST time the panel opens so the
    // minimise pill anchor isn't null. Stored-position clamping is reapplied
    // on every render via this same effect, so we don't need to write back —
    // the DOM is always correct.
    if (position === null) {
      setInitialPosition(pos)
    }
  }, [isOpen, isMinimised, position, size, setInitialPosition, minimise])

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

  // Clamp on viewport resize AND on dock resize/open/close so the panel
  // never leaves the visible area and never lands under the dock. The
  // ResizeObserver watches the dock element: it fires when the dock
  // mounts, unmounts (via the cleanup re-evaluation pass), expands, or
  // collapses to its rail width. Without this, a panel placed when the
  // dock was closed would be stranded under the dock when the user opens
  // it, since the layout effect's deps don't include dock state.
  useEffect(() => {
    if (!isOpen) return
    const handle = () => {
      const el = containerRef.current
      if (!el) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const dockInset = measureDockInset()
      // Same MIN_WIDTH-or-minimise rule as the layout effect: if the
      // viewport-or-dock resize leaves no room for a MIN_WIDTH panel,
      // auto-minimise to the pill.
      if (!fitsAtMinSize(vw, vh, dockInset)) {
        useFloatingPanelState.getState().minimise()
        return
      }
      const max = computeMaxSize(vw, vh)
      const w = clamp(parseFloat(el.style.width || '0') || size.width, MIN_WIDTH, max.width)
      const h = clamp(parseFloat(el.style.height || '0') || size.height, MIN_HEIGHT, max.height)
      const x = clamp(parseFloat(el.style.left || '0'), DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vw - w - DEFAULT_MARGIN - dockInset))
      const y = clamp(parseFloat(el.style.top || '0'), DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vh - h - DEFAULT_MARGIN))
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    window.addEventListener('resize', handle)
    // Track the dock element across mounts/unmounts so we re-clamp when
    // it appears, expands (rail → full), or collapses (full → rail).
    let dockObs: ResizeObserver | null = null
    let dockEl: Element | null = null
    const watchDock = () => {
      const next = typeof document !== 'undefined'
        ? document.querySelector('aside[aria-label="Outputs dock"]')
        : null
      if (next === dockEl) return
      if (dockObs && dockEl) dockObs.unobserve(dockEl)
      dockEl = next
      if (next && dockObs) dockObs.observe(next)
    }
    if (typeof ResizeObserver !== 'undefined') {
      dockObs = new ResizeObserver(handle)
      watchDock()
    }
    // Re-evaluate the watched element shortly after mount in case the
    // dock renders asynchronously (CSR boot, conditional rendering).
    const mountCheckId = typeof window !== 'undefined' ? window.setTimeout(watchDock, 100) : 0
    // The dock dispatches this event on tab clicks; piggy-back to also
    // recheck whether the watched element has changed.
    const onDockOpened = () => { watchDock(); handle() }
    window.addEventListener('outputs-dock-opened', onDockOpened)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('outputs-dock-opened', onDockOpened)
      if (mountCheckId) window.clearTimeout(mountCheckId)
      if (dockObs) dockObs.disconnect()
    }
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
      const dockInset = measureDockInset()
      const max = computeMaxSize(vw, vh)

      if (drag) {
        const w = parseFloat(el.style.width || '400')
        const h = parseFloat(el.style.height || '500')
        const x = clamp(e.clientX - drag.offsetX, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vw - w - DEFAULT_MARGIN - dockInset))
        const y = clamp(e.clientY - drag.offsetY, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vh - h - DEFAULT_MARGIN))
        el.style.left = `${x}px`
        el.style.top = `${y}px`
      } else if (resize) {
        // If the dock leaves no room for a MIN_WIDTH × MIN_HEIGHT panel,
        // auto-minimise instead of rendering a too-narrow surface. Cancel
        // the in-flight resize so pointerup doesn't commit a bad size.
        if (!fitsAtMinSize(vw, vh, dockInset)) {
          resizeStateRef.current = null
          useFloatingPanelState.getState().minimise()
          return
        }
        const dw = e.clientX - resize.startX
        const dh = e.clientY - resize.startY
        // Resize comes from the bottom-right handle, so x/y stay fixed
        // and we grow width/height. Cap the maximum width by the
        // remaining space from the panel's current x to the dock's left
        // edge (or viewport right - margin when no dock). MIN_WIDTH is
        // preserved — the auto-minimise branch above handles the case
        // where the dock leaves less room than MIN_WIDTH.
        const x = parseFloat(el.style.left || '0')
        const y = parseFloat(el.style.top || '0')
        const { widthBudget, heightBudget } = computeResizeBudget(x, y, vw, vh, dockInset)
        const requestedW = Math.max(MIN_WIDTH, resize.startW + dw)
        const requestedH = Math.max(MIN_HEIGHT, resize.startH + dh)
        const w = Math.max(MIN_WIDTH, Math.min(max.width, widthBudget, requestedW))
        const h = Math.max(MIN_HEIGHT, Math.min(max.height, heightBudget, requestedH))
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
    // Clamp the pill anchor too — a stored position from when the panel
    // was full-sized may sit too close to the right/bottom edge for the
    // small pill to remain fully visible after the viewport changes.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const dockInset = measureDockInset()
    const pillPos = position ? clampPillPositionToViewport(position, vw, vh, dockInset) : null
    return createPortal(
      <button
        type="button"
        onClick={restore}
        className="fixed inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-panel border border-panel-border shadow-2 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        style={{
          zIndex: 300,
          left: pillPos ? pillPos.x : '50%',
          top: pillPos ? pillPos.y : '50%',
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
          /* Staging's ConversationPanel has no ChatTopBar render, so
             onAttach is never invoked at runtime here — pass no-op. */
          onAttach={noop}
          hideComposer
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
