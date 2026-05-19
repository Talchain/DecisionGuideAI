import { memo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { useFloatingPanelState, canAutoDock } from '../hooks/useFloatingPanelState'
import { useUIStore } from '../../stores/uiStore'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useTransitionReceipt } from '../hooks/useTransitionReceipt'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { registerFloatingFocus } from '../hooks/useFloatingFocus'

interface FirstUseComposerProps {
  /** Cog popover handler. Receives the cog button element for anchoring. */
  onCogClick: (anchorEl: HTMLElement) => void
}

const PANEL_WIDTH = 480
const PANEL_HEIGHT = 200

/**
 * FirstUseComposer — centred composer that auto-opens when the canvas is
 * empty AND no conversation has begun. Sits above the canvas via portal.
 *
 * Auto-dock rule: when the graph first gains nodes AND the panel was opened
 * by the system (source === 'system-first-use') AND the user has NOT
 * dragged/resized it, the floating panel docks: switches the dock to the
 * Olumi tab and closes the floating window. If the user manually opened or
 * moved the panel, this is skipped.
 *
 * Reduced motion: animation duration is 0ms when
 * window.matchMedia('(prefers-reduced-motion: reduce)').matches.
 */
export const FirstUseComposer = memo(function FirstUseComposer({ onCogClick }: FirstUseComposerProps) {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const { messages } = useConversationContext()
  const realMessageCount = messages.filter((m) => !m.synthetic).length

  const isOpen = useFloatingPanelState((s) => s.isOpen)
  const source = useFloatingPanelState((s) => s.source)
  const userRepositioned = useFloatingPanelState((s) => s.userRepositioned)
  const openFloating = useFloatingPanelState((s) => s.open)
  const closeFloating = useFloatingPanelState((s) => s.close)

  const prefersReducedMotion = usePrefersReducedMotion()
  const prevNodeCountRef = useRef(nodeCount)
  const inputBarRef = useRef<AIInputBarHandle | null>(null)

  // Open the first-use composer when the canvas is empty AND no real
  // messages exist. Only once per session — we don't reopen if the user
  // closed it explicitly.
  const hasAutoOpenedRef = useRef(false)
  useEffect(() => {
    if (hasAutoOpenedRef.current) return
    if (nodeCount === 0 && realMessageCount === 0 && !isOpen) {
      hasAutoOpenedRef.current = true
      openFloating('system-first-use')
    }
  }, [nodeCount, realMessageCount, isOpen, openFloating])

  // Auto-dock requires positive evidence that the user actually submitted
  // via THIS composer — otherwise any 0→N+ node transition (scenario
  // hydration, import, session-resume, restored snapshot, programmatic
  // graph load) would mis-fire the auto-dock.
  //
  // The signal is explicit: AIInputBar fires `onAfterSend` only when a
  // submit is dispatched from this composer instance. No inference from
  // message counts — hydration cannot fake the callback, so historic
  // real (non-synthetic) messages restored before graph nodes do NOT
  // unlock auto-dock.
  const userSentFromFirstUseRef = useRef(false)
  const handleAfterSend = useCallback(() => {
    userSentFromFirstUseRef.current = true
  }, [])

  // Auto-dock: when the graph FIRST gains nodes, dock the panel if
  // (a) it's still open, (b) it was opened by the system, (c) the user
  // has not pointer-dragged or resized it, AND (d) the user has actually
  // submitted via this composer (so hydration/import paths can't trigger).
  useEffect(() => {
    const prev = prevNodeCountRef.current
    prevNodeCountRef.current = nodeCount
    if (prev !== 0 || nodeCount === 0) return // only fires on the 0 → N+ transition
    if (!isOpen) return
    if (!canAutoDock({ source, userRepositioned })) return
    if (!userSentFromFirstUseRef.current) return // hydration/import guard

    const performDock = () => {
      // Brief: after auto-dock, the right panel expands and Analysis (not
      // Olumi) becomes the active tab so the user sees readiness guidance.
      //
      // forceActivateOutputTab (not setActiveOutputTab) guarantees the
      // OutputsDock sync fires even when the global activeOutputTab value
      // is unchanged — e.g. global was already 'results' but the dock had
      // another tab persisted to localStorage from a prior session.
      useUIStore.getState().forceActivateOutputTab('results')
      closeFloating()
      // 3-second "Model drafted. Review readiness." banner at the top of
      // the Analysis tab. Self-clears via the store's internal timer.
      useTransitionReceipt.getState().show('model-drafted', 3000)
    }
    if (prefersReducedMotion) {
      performDock()
      return
    }
    // 300ms delay so the user perceives the transition before the panel
    // closes and Analysis activates. Skipped under prefers-reduced-motion
    // (handled above). The receipt banner appears once performDock fires.
    const id = window.setTimeout(performDock, 300)
    return () => window.clearTimeout(id)
  }, [nodeCount, isOpen, source, userRepositioned, prefersReducedMotion, closeFloating])

  // First-use is rendered when ALL of:
  //  - the panel is open
  //  - source is system-first-use (NOT a user-driven open)
  //  - the canvas has no nodes and no real messages (still empty)
  // Otherwise the regular FloatingOlumiPanel handles rendering.
  const shouldRender = isOpen && source === 'system-first-use' && nodeCount === 0 && realMessageCount === 0

  // Register the floating-focus channel from THIS surface when first-use is
  // active. FloatingOlumiPanel yields rendering to us during first-use, so
  // its registration would point at a null input ref. Owning the channel
  // here means focusFloating() lands in the first-use composer's textarea.
  useEffect(() => {
    if (!shouldRender) return
    return registerFloatingFocus(() => inputBarRef.current?.focus())
  }, [shouldRender])

  if (!shouldRender) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-label="Describe your decision"
      data-testid="first-use-composer"
      className="fixed bg-panel border border-panel-border rounded-lg shadow-2 flex flex-col"
      style={{
        zIndex: 300,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        left: `calc(50% - ${PANEL_WIDTH / 2}px)`,
        top: `calc(50% - ${PANEL_HEIGHT / 2}px)`,
      }}
    >
      <div className="flex flex-col items-center justify-center px-6 pt-5 pb-3 gap-2">
        <p className={typo('panelBody', 'text-text-light text-center')}>
          Describe your decision, the options you're weighing, and what a good outcome looks like.
        </p>
      </div>
      <div className="flex-1" />
      <AIInputBar
        ref={inputBarRef}
        variant="first-use"
        onCogClick={onCogClick}
        hideChevron
        placeholder="Describe your decision…"
        ariaLabel="Describe your decision"
        testId="first-use-input-bar"
        onAfterSend={handleAfterSend}
      />
    </div>,
    document.body,
  )
})
