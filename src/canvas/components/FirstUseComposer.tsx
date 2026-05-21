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
import { measureDockInset, clampPositionToViewport } from './FloatingOlumiPanel'
import { NodeShape } from '../conversation/primitives/NodeShape'
import type { NodeType } from '../domain/nodes'

interface FirstUseComposerProps {
  /** Cog popover handler. Receives the cog button element for anchoring. */
  onCogClick: (anchorEl: HTMLElement) => void
}

/** Hero panel sizing. Width caps so very wide viewports don't dilute the focal
 *  point; height has a generous floor so the hero reads as the primary surface
 *  even at small viewports, and a 70vh cap so it never dominates tall screens. */
const PANEL_WIDTH = 640
const PANEL_MARGIN = 16
const PANEL_MIN_HEIGHT = 460

/** Reposition margin when post-graph auto-anchoring the floating panel. */
const REPOSITION_EDGE_MARGIN = 16

/** Six DS v5 node shapes that drift ambient atmosphere behind the hero. */
const AMBIENT_LAYOUT: ReadonlyArray<{
  kind: NodeType
  top: string
  left: string
  size: number
  delay: string
  duration: string
}> = [
  { kind: 'goal',     top: '10%',  left: '8%',  size: 40, delay: '0s',    duration: '18s' },
  { kind: 'decision', top: '20%',  left: '82%', size: 44, delay: '-3s',   duration: '22s' },
  { kind: 'option',   top: '70%',  left: '12%', size: 36, delay: '-7s',   duration: '20s' },
  { kind: 'factor',   top: '78%',  left: '78%', size: 32, delay: '-11s',  duration: '24s' },
  { kind: 'risk',     top: '45%',  left: '4%',  size: 30, delay: '-5s',   duration: '19s' },
  { kind: 'outcome',  top: '50%',  left: '88%', size: 34, delay: '-13s',  duration: '21s' },
]

/** Light-fill colours mirror the legacy EmptyState palette so the hero shapes
 *  read as the same vocabulary used inside the canvas itself. */
const AMBIENT_FILLS: Record<string, string> = {
  goal:     'var(--goal-light, #F4DB92)',
  decision: 'var(--info-light, #BAD7E4)',
  option:   'var(--option-light, #DDDCF5)',
  factor:   'var(--factor-light, #EEE6D8)',
  risk:     'var(--danger-light, #FFB393)',
  outcome:  'var(--success-light, #B8E2D0)',
}

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
 * Reduced motion: ambient drift shapes freeze, the auto-reposition fires
 * synchronously without the 300ms slide delay.
 */
export const FirstUseComposer = memo(function FirstUseComposer({ onCogClick }: FirstUseComposerProps) {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const { draft, messages } = useConversationContext()
  const realMessageCount = messages.filter((m) => !m.synthetic).length

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

  // Drift recedes once the user starts typing so the composer becomes the
  // visual focal point. Reduced-motion users see static faded shapes.
  const hasDraft = draft.trim().length > 0

  return createPortal(
    <div
      role="dialog"
      aria-label="Describe your decision"
      data-testid="first-use-composer"
      className="fixed bg-panel border border-panel-border rounded-lg shadow-2 flex flex-col overflow-hidden"
      style={{
        zIndex: 300,
        // Responsive width: cap at PANEL_WIDTH on wide viewports, shrink to
        // viewport - 2*margin on narrow ones so the hero never overflows.
        width: `min(${PANEL_WIDTH}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
        // Min-height floor so the hero always reads as a prominent surface.
        // Cap at 70vh so it doesn't dominate tall screens; content-fit
        // between floor and cap keeps the layout responsive.
        minHeight: PANEL_MIN_HEIGHT,
        maxHeight: '70vh',
        // Horizontal centre when there's room; left margin on narrow viewports.
        left: `max(${PANEL_MARGIN}px, calc(50% - ${PANEL_WIDTH / 2}px))`,
        // Vertical centre. max() floor prevents overflow at very short viewports.
        top: `max(${PANEL_MARGIN}px, calc(50vh - ${PANEL_MIN_HEIGHT / 2}px))`,
      }}
    >
      <AmbientDriftShapes settled={hasDraft} reducedMotion={prefersReducedMotion} />
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-8 py-10 gap-4">
        <img
          src="/olumi-logo.png"
          alt=""
          aria-hidden="true"
          width={64}
          height={64}
          className="block select-none"
          draggable={false}
        />
        <h2
          className={typo('welcomeHeading', 'text-text-body text-center m-0')}
          data-testid="first-use-heading"
        >
          What are you deciding?
        </h2>
        <p
          className={typo('panelBody', 'text-text-light text-center max-w-md')}
          data-testid="first-use-guidance"
        >
          Describe the decision, options, goal and constraints.
        </p>
        <div className="w-full max-w-md mt-2">
          <AIInputBar
            ref={inputBarRef}
            variant="welcome"
            onCogClick={onCogClick}
            hideChevron
            placeholder="Describe your decision…"
            ariaLabel="Describe your decision"
            testId="first-use-input-bar"
            onAfterSend={handleAfterSend}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
})

/**
 * AmbientDriftShapes — six low-opacity DS node shapes drifting subtly behind
 * the hero content. CSS-only animation (no JS loop), settled state when the
 * user starts typing, fully suppressed under prefers-reduced-motion.
 *
 * The shapes act as ambient atmosphere — never interactive, never on top of
 * content, always aria-hidden. Opacity stays low (8-15%) so they read as
 * texture rather than as discrete shapes competing for attention.
 */
function AmbientDriftShapes({ settled, reducedMotion }: { settled: boolean; reducedMotion: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none ${settled ? 'ambient-drift-settled' : ''}`}
      data-testid="first-use-ambient-shapes"
    >
      {AMBIENT_LAYOUT.map(({ kind, top, left, size, delay, duration }) => (
        <div
          key={kind}
          className={reducedMotion ? 'ambient-drift-static' : 'ambient-drift-shape'}
          style={{
            position: 'absolute',
            top,
            left,
            width: size,
            height: size,
            animationDelay: delay,
            animationDuration: duration,
          }}
          data-shape={kind}
        >
          <NodeShape kind={kind} size={size} fill={AMBIENT_FILLS[kind]} />
        </div>
      ))}
      <style>{`
        @keyframes ambientDrift {
          0%   { transform: translate(0, 0);       opacity: 0.14; }
          25%  { transform: translate(6px, -4px);  opacity: 0.18; }
          50%  { transform: translate(-2px, 6px);  opacity: 0.12; }
          75%  { transform: translate(-6px, -2px); opacity: 0.16; }
          100% { transform: translate(0, 0);       opacity: 0.14; }
        }
        .ambient-drift-shape {
          opacity: 0.14;
          animation-name: ambientDrift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        /* Once the user starts typing, drop opacity further so the composer
           takes visual priority. Animation continues at the reduced level. */
        .ambient-drift-settled .ambient-drift-shape {
          opacity: 0.06;
        }
        /* Static fallback for reduced-motion users: faded, no animation. */
        .ambient-drift-static {
          opacity: 0.12;
        }
        .ambient-drift-settled .ambient-drift-static {
          opacity: 0.06;
        }
        @media (prefers-reduced-motion: reduce) {
          .ambient-drift-shape {
            animation: none !important;
            opacity: 0.12 !important;
          }
          .ambient-drift-settled .ambient-drift-shape {
            opacity: 0.06 !important;
          }
        }
      `}</style>
    </div>
  )
}
