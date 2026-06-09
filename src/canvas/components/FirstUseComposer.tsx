import { memo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { useFloatingPanelState, canAutoDock } from '../hooks/useFloatingPanelState'
import { useUIStore } from '../../stores/uiStore'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useTransitionReceipt } from '../hooks/useTransitionReceipt'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { registerFloatingFocus } from '../hooks/useFloatingFocus'
import { measureDockInset, clampPositionToViewport } from './FloatingOlumiPanel'
import { ThinkingIndicator } from '../conversation/zones/ThinkingIndicator'

interface FirstUseComposerProps {
  /** Cog popover handler. Receives the cog button element for anchoring. */
  onCogClick: (anchorEl: HTMLElement) => void
}

/** Hero container sizing — round-11 UX correction.
 *
 * The hero surface is now CHROMELESS: no panel background, no border, no
 * shadow, no ambient drift shapes, no standalone heading. It is just the
 * Olumi logo above a single-line composer that grows on type. The
 * surrounding container is invisible — only a positioning context.
 *
 * Width still caps so the composer doesn't stretch ungainly wide on
 * ultra-wide displays; the inner composer has its own narrower max-width
 * (max-w-2xl) so the readable line length stays tasteful.
 */
const PANEL_WIDTH = 960
const PANEL_MARGIN = 16

/** Reposition margin when post-graph auto-anchoring the floating panel. */
const REPOSITION_EDGE_MARGIN = 16

/**
 * FirstUseComposer — AI Panel v2 welcome hero.
 *
 * Renders a large centred surface when the canvas is empty (initial first
 * launch OR after a canvas reset). Sits above the canvas via portal. Holds
 * its position through the post-submit generation window so the experience
 * reads as the same surface transitioning, not a different component
 * popping in.
 *
 * Auto-reposition rule (replaces the old auto-close): once the first graph
 * appears (0 → N+ nodes) the hero unmounts, the floating panel slides to a
 * bottom-right anchor near the Analysis dock, and Analysis activates so the
 * user can see AI and analysis side by side. Skipped when the user already
 * dragged or resized the panel (`userRepositioned`).
 *
 * Reset rule: when the graph drops back to zero nodes (canvas reset), the
 * hero re-engages so the experience returns to a familiar starting state.
 *
 * Reduced motion: the auto-reposition fires synchronously without the
 * 300ms slide delay.
 */
export const FirstUseComposer = memo(function FirstUseComposer({ onCogClick }: FirstUseComposerProps) {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const { messages, isThinking } = useConversationContext()
  const realMessageCount = messages.filter((m) => !m.synthetic).length
  // Round-12: during the first-use generating window (user submitted a
  // brief, no graph yet) the composer freezes, its placeholder swaps to
  // "Generating your decision model…", and the chromeless hero would
  // otherwise sit silent. Overlay the existing ThinkingIndicator (six
  // node shapes pulsing in a horizontal wave — main → light → main, 3s
  // loop, 0.5s stagger) on top of the composer so the user has visual
  // evidence Olumi is working on it and doesn't try to type. The
  // indicator unmounts as soon as the first graph appears (nodeCount > 0
  // → hero unmounts entirely).
  const isGenerating = isThinking && nodeCount === 0

  const isOpen = useFloatingPanelState((s) => s.isOpen)
  const source = useFloatingPanelState((s) => s.source)
  const userRepositioned = useFloatingPanelState((s) => s.userRepositioned)
  const openFloating = useFloatingPanelState((s) => s.open)

  const prefersReducedMotion = usePrefersReducedMotion()
  const inputBarRef = useRef<AIInputBarHandle | null>(null)

  // Two separate previous-node-count cursors: the reset effect watches
  // N → 0 transitions, the reposition effect watches 0 → N+ transitions.
  // Keeping the cursors local to their effects avoids cross-effect coupling.
  const resetPrevNodeCountRef = useRef(nodeCount)
  const repositionPrevNodeCountRef = useRef(nodeCount)

  // Tracks whether the user actually submitted via THIS composer instance.
  // Set in handleAfterSend (AIInputBar callback). Used by the reposition
  // effect to distinguish a real first-use submission from a 0→N+ node
  // bump caused by scenario hydration, import, or session resume.
  const userSentFromFirstUseRef = useRef(false)
  const handleAfterSend = useCallback(() => {
    userSentFromFirstUseRef.current = true
  }, [])

  // Open the hero on first mount when the canvas is empty and no real
  // conversation has begun. Fires once unless a canvas reset re-engages it.
  const hasAutoOpenedRef = useRef(false)
  useEffect(() => {
    if (hasAutoOpenedRef.current) return
    if (nodeCount === 0 && realMessageCount === 0 && !isOpen) {
      hasAutoOpenedRef.current = true
      openFloating('system-first-use')
    }
  }, [nodeCount, realMessageCount, isOpen, openFloating])

  // Canvas reset → re-engage the hero, but ONLY when the empty state is
  // stable. Transient N → 0 transitions happen during scenario switches,
  // graph imports, and session hydration — the canvas store briefly
  // reports zero nodes before the new graph populates. Re-opening the
  // hero on those would flicker the welcome surface over the loading
  // graph. Debounce: wait 500ms and re-check; if a new graph has loaded
  // by then, the reset was transient and we skip the re-engage.
  useEffect(() => {
    const prev = resetPrevNodeCountRef.current
    resetPrevNodeCountRef.current = nodeCount
    if (prev <= 0 || nodeCount > 0) return // only fires on N → 0 (reset)
    const id = window.setTimeout(() => {
      // Re-read live state — if a new graph loaded during the debounce
      // window, the reset was transient and we bail out silently.
      if (useCanvasStore.getState().nodes.length === 0) {
        userSentFromFirstUseRef.current = false
        openFloating('system-first-use') // resets userRepositioned + source
      }
    }, 500)
    return () => window.clearTimeout(id)
  }, [nodeCount, openFloating])

  // Auto-reposition on 0 → N+ transition (the legitimate first graph being
  // drafted from the user's brief). Replaces the previous auto-close: per
  // the brief, AI must remain visible alongside Analysis. The floating
  // panel slides to a bottom-right anchor; the right-hand dock activates
  // its Analysis tab; the "Model drafted. Review readiness." receipt fires.
  useEffect(() => {
    const prev = repositionPrevNodeCountRef.current
    repositionPrevNodeCountRef.current = nodeCount
    if (prev !== 0 || nodeCount === 0) return // only on 0 → N+
    if (!isOpen) return
    if (!canAutoDock({ source, userRepositioned })) return
    if (!userSentFromFirstUseRef.current) return // hydration/import guard

    const performReposition = () => {
      // Activate Analysis tab so the user sees readiness guidance next to
      // the floating AI panel. forceActivateOutputTab bumps the version
      // counter so the dock syncs even when global tab was already 'results'.
      useUIStore.getState().forceActivateOutputTab('results')

      // 3-second "Model drafted. Review readiness." banner at the top of
      // the Analysis tab. Self-clears via the store's internal timer.
      useTransitionReceipt.getState().show('model-drafted', 3000)

      // Compute the bottom-right anchor near the Analysis dock. Anchor is
      // clamped via the existing viewport+dock-inset rules so it never
      // lands under the dock or off-canvas.
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      const dockInset = measureDockInset()
      const { size, performAutoReposition } = useFloatingPanelState.getState()
      const anchorRaw = {
        x: vw - dockInset - size.width - REPOSITION_EDGE_MARGIN,
        y: vh - size.height - REPOSITION_EDGE_MARGIN,
      }
      const anchor = clampPositionToViewport(anchorRaw, size, vw, vh, dockInset)

      // Delegate the rAF + slide-flag-clear orchestration to the store
      // action so the timers live outside any component lifecycle. This
      // composer's effect cleanup cannot accidentally cancel them on a
      // dependency change (e.g. another node-count tick during the 450ms
      // clear window).
      performAutoReposition(anchor, { reducedMotion: prefersReducedMotion })
    }
    if (prefersReducedMotion) {
      performReposition()
      return
    }
    // 300ms delay so the user perceives the hero settling before the
    // floating panel slides into place. Skipped under prefers-reduced-motion.
    // Only the outer trigger timeout is cancelled on dep changes — the
    // store action's internal rAF + clear run independently.
    const id = window.setTimeout(performReposition, 300)
    return () => window.clearTimeout(id)
  }, [nodeCount, isOpen, source, userRepositioned, prefersReducedMotion])

  // Hero renders whenever the canvas is empty AND the floating panel is
  // system-opened. Includes the initial welcome state, the post-submit /
  // pre-graph generation window, and any post-reset state. Once nodeCount
  // > 0 the hero unmounts and the floating panel takes over.
  const shouldRender = isOpen && source === 'system-first-use' && nodeCount === 0

  // Register the floating-focus channel from THIS surface when the hero is
  // active. FloatingOlumiPanel yields to us in the same window, so its
  // registration would point at a null input ref.
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
      className="fixed flex flex-col items-center"
      style={{
        zIndex: 300,
        // Responsive width: cap at PANEL_WIDTH on wide viewports, shrink to
        // viewport - 2*margin on narrow ones. The container itself is
        // invisible (no bg, no border, no shadow) — it only provides
        // positioning context for the logo + composer.
        width: `min(${PANEL_WIDTH}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
        // Horizontal centre when there's room; left margin on narrow viewports.
        left: `max(${PANEL_MARGIN}px, calc(50% - ${PANEL_WIDTH / 2}px))`,
        // Vertical centre via transform — content height is unknown because
        // the composer grows on type. translateY(-50%) keeps the centre
        // stable regardless of how tall the composer becomes.
        top: '50%',
        transform: 'translateY(-50%)',
        gap: 24,
      }}
    >
      {/* Olumi logo — round-11 UX: just the logo and the textbox on the
          canvas. The brand wordmark sits above the composer as a quiet
          identity cue. No heading, no subtitle, no ambient drift — the
          composer is the focal point. */}
      <img
        src="/olumi-logo.png"
        alt=""
        aria-hidden="true"
        width={280}
        className="block select-none"
        style={{ height: 'auto' }}
        draggable={false}
      />
      <div className="relative w-full max-w-2xl">
        <AIInputBar
          ref={inputBarRef}
          variant="welcome"
          onCogClick={onCogClick}
          hideChevron
          placeholder="Describe your decision, goal, options, and any assumptions, risks or constraints you’re aware of."
          ariaLabel="Describe your decision"
          testId="first-use-input-bar"
          onAfterSend={handleAfterSend}
        />
        {isGenerating ? (
          // Overlay positioned to mirror the welcome variant's known
          // geometry: pr-24 (96px) matches AIInputBar's icon-stack inset
          // (cog + send) so the shapes never collide with them; pt-9
          // (36px = 8 outer pt-2 + 8 textarea py-2 + 18 line-height +
          // 2 gap) drops the shape row onto line 2 of the textbox,
          // immediately below the "Generating your decision model…"
          // placeholder. If the welcome variant's padding or line
          // height ever changes in AIInputBar, update these classes.
          <div
            role="status"
            aria-live="polite"
            data-testid="first-use-thinking"
            className="pointer-events-none absolute inset-0 flex items-start justify-center pt-9 pr-24"
          >
            <ThinkingIndicator />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
})
