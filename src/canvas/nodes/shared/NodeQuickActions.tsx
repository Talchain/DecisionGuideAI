import { memo, useCallback } from 'react'
import { MessageSquare, PanelRight, MoreHorizontal } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useShowToastSafe } from '../../ToastContext'
import { askAI } from '../../contextMenu/actions'
import type { NodeType } from '../../domain/nodes'
import { openNodeInspector } from './openNodeInspector'

/**
 * NodeQuickActions — the contextual efficiency layer (R5, Paul, 16 Aug 2026).
 *
 * "nodes/edges carry a compact CONTEXTUAL EFFICIENCY LAYER — small clickable
 * icons and/or a hover menu giving one-click access to (a) ask Olumi about
 * THIS element and (b) open the precise analysis lens for THIS element —
 * powerful science-grounded shortcuts for practised users, balanced against
 * clutter. Full functionality stays in the inspector and may be DUPLICATED
 * there. Full buttons/instructional text on nodes: no. Efficiency principle:
 * minimise clicks to power functionality; nothing buried. Every hover action
 * has a click/tap/keyboard equivalent."
 *
 * Design notes, each answering a constraint from that ruling:
 *
 * - QUIET AT REST. Hidden by opacity, revealed on hover, on keyboard focus
 *   within the card, and whenever the node is SELECTED. Selection is what
 *   makes this reachable without a pointer at all: select with the keyboard,
 *   the actions appear, Tab to them.
 * - CLICK/TAP/KEYBOARD PARITY. Native <button>s, so Tab and Enter/Space work
 *   with no key handling of our own. `group-focus-within` keeps them visible
 *   while they hold focus — without it, a focused button would be invisible,
 *   which is the exact "hover action with no keyboard equivalent" the ruling
 *   forbids. Reveal is opacity-only, never `display`/`hidden`, so the buttons
 *   stay in the tab order and in the accessibility tree at rest.
 *   Touch devices (`pointer: coarse`) get them permanently visible: a touch
 *   device has no hover, so opacity-on-hover would be a tap target that never
 *   appears. So does a SELECTED node, via `alwaysVisible`.
 * - NOTHING BURIED, NOTHING DUPLICATED BADLY. Both actions route through the
 *   machinery that already exists — `askAI` (which selects the element so the
 *   turn carries `selected_elements`, reveals the Olumi surface, and toasts if
 *   the conversation never registers) and `openNodeInspector` (the node twin
 *   of `openEdgeStrengthEditor`). No new transport, no second grammar.
 * - NO DEAD CONTROLS, AND NO SILENT ONES. The ask button renders only when a
 *   conversation surface has registered the SEND channel `askAI` actually
 *   needs, and the click passes `showToast` through so a channel that dies
 *   between render and click surfaces as a message rather than as nothing. A
 *   review caught both halves: the gate was `_sendMessage || _prefillChat`
 *   (wider than what askAI needs) and the call omitted the toast, which made
 *   the PR body's failure-visibility claim false.
 *
 * `stopPropagation` is deliberate and, unlike the dead on-node pencil this
 * replaces, harmless: these buttons perform the selection themselves, so
 * suppressing the node click costs nothing.
 *
 * ⚠ PLACEMENT IS LOAD-BEARING — bottom-right, not top-right. The node's
 * TOP-right is an explicitly OWNED band: `node-corner-stack` sits at
 * `-top-2 -right-2 z-10` and exists precisely because three badges used to
 * collide there (a browser-confirmed P2 fix). This layer first shipped at
 * `top-1.5 right-1.5 z-[2]` — about 6px inside that band and at a LOWER z, so
 * the stack painted over these buttons whenever a rank badge, freshness dot or
 * coaching marker was present. Bottom-right is unowned once ActionIcons' single
 * Confirm icon moves to bottom-LEFT, which it has. The geometry is pinned in
 * this component's spec: change it there too, or leave it alone.
 */
export interface NodeQuickActionsProps {
  nodeId: string
  nodeType: NodeType
  /** The node's label, used in the button's accessible name. */
  label: string
  /** Keep the actions visible regardless of hover — used when the node is
   *  selected, which is what gives a keyboard-only user a way to reach them. */
  alwaysVisible?: boolean
}

export const NodeQuickActions = memo(function NodeQuickActions({
  nodeId,
  nodeType,
  label,
  alwaysVisible = false,
}: NodeQuickActionsProps) {
  // The gate must ask the question `askAI` actually asks. It polls for
  // `_sendMessage` and gives up with a toast if that never registers — so a
  // gate of `_sendMessage || _prefillChat` would show the button on a surface
  // that registered only the prefill channel, i.e. exactly the dead control
  // this gate exists to prevent (trap 21: two predicates, one name).
  const canAsk = useGuidanceStore(s => s._sendMessage !== null)
  // …and if the channel dies between the render and the click, the user is told
  // rather than left with a button that did nothing. `Safe` because nodes also
  // render in headless hosts, where a missing ToastProvider must not throw.
  const showToast = useShowToastSafe()

  const handleAsk = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const node = useCanvasStore.getState().nodes.find(n => n.id === nodeId)
    if (!node) return
    askAI(
      { kind: 'node', nodeId, nodeType, node, screenPos: { x: 0, y: 0 } },
      'explain_element',
      showToast,
    )
  }, [nodeId, nodeType, showToast])

  const handleInspect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openNodeInspector(nodeId)
  }, [nodeId])

  /**
   * Open this node's own menu — the SAME menu right-click opens, by the same
   * code path.
   *
   * ## The gap this closes
   *
   * ⚠ THIS LIST WAS WRONG WHEN FIRST WRITTEN, and the correction matters more
   * than the list does. It named six invitations including "Add risk from
   * this", "Add outcome from this" and "Add connected factor" — **none of which
   * can render, for any node type, in any state.** All three are stripped by
   * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` (`useMenuItems.ts:82-96`) because
   * `mutationAuthority.ts:70` sets `canvasSemanticMutations: 'disabled'`, and
   * that strip is test-locked as a permanent audit rather than a runtime
   * toggle. No user was misled — the label is `More actions for {label}` and
   * promises nothing specific — but the false claim sat in shipped source,
   * which is where the next session inherits it. **A comment that overstates
   * what a thing does teaches the next reader to stop checking.**
   *
   * WHAT THIS BUTTON ACTUALLY UNBURIES, derived rather than recalled:
   * "Challenge this" (gated `isFull || isGoal`), "Explore ▸ Trace to goal" and
   * "Select path to goal" (gated `isFull`), "Explain this", Copy and Delete —
   * plus two Graph Lens items, "Isolate this option's paths"
   * (`lens-isolate-option`, option nodes) and "Show sensitivity view"
   * (`lens-sensitivity`, factor nodes carrying `factor_sensitivity`), both
   * post-analysis and both behind `isGraphLensEnabled()`
   * (`contextMenu/useMenuItems.ts:470-500`).
   *
   * ⚠ THE LIST ABOVE WAS SHORT BY THOSE TWO, WHICH IS THE SAME DEFECT AS THE
   * ONE THIS BLOCK OPENS BY CONFESSING. The first version named three
   * invitations that cannot render; the correction then omitted two that can.
   * Over-claiming and under-claiming are the same failure — a list in shipped
   * source that does not match what the code produces — and I made both in one
   * comment, having written "derived rather than recalled" above it.
   *
   * ⚠ AND WHAT I STILL CANNOT SAY: whether those two are on for a real user.
   * `VITE_FEATURE_GRAPH_LENS` is absent from `netlify.toml`, so its deployed
   * value is a Render/Netlify dashboard question and not derivable from this
   * tree (CLAUDE.md trap 18 — YAML is not the deployed env). They are
   * unstripped and reachable BY CONSTRUCTION when the flag is on; that is the
   * precise claim, and "the menu contains them by default" is not.
   *
   * Until this button there were exactly two doors to them: RIGHT-CLICK, which
   * has no equivalent on a touch device, and SHIFT+F10, which nobody discovers.
   * So the part of the product that invites a team to challenge its model was,
   * in practice, unreachable — not disabled, not missing, just behind a
   * gesture. The ruling this component implements says "nothing buried".
   *
   * ⚠ AND ONE LIMIT THE RATIONALE MUST NOT DENY: this whole layer unmounts at
   * low zoom (`showQuickActions = !lodActive && …`, `BaseNode.tsx`), which is a
   * plausible touch posture. Right-click still works there, so it is a gap
   * rather than a regression — but the button does not reach every state the
   * argument for it implies, and saying so here is cheaper than the next reader
   * discovering it.
   *
   * ## Why it DISPATCHES a contextmenu event rather than calling a handler
   *
   * The menu's target is assembled in `ReactFlowGraph.onNodeContextMenu`, which
   * also handles multi-selection and selects the node when it is not already
   * selected. Reaching in to call that would mean either lifting a callback
   * through every node type or duplicating the target-assembly here — and a
   * second assembler is how two authorities on one question get created
   * (CLAUDE.md trap 21). Re-emitting the event React Flow already listens for
   * means this button CANNOT diverge from right-click: there is one handler,
   * one target shape, one menu. If right-click's behaviour changes, this
   * changes with it, including any gating added later.
   *
   * ⚠ `bubbles: true` IS LOAD-BEARING, not boilerplate. React attaches its
   * listeners at the root container, so a non-bubbling dispatch would reach
   * nothing at all and the button would be silently inert — a dead control,
   * which is the specific failure this component's own header records catching
   * once already.
   *
   * Coordinates are the button's own bottom-right corner, so the menu opens
   * where the finger or cursor already is rather than at the node's origin.
   */
  const handleOpenMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    el.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(rect.right),
        clientY: Math.round(rect.bottom),
      }),
    )
  }, [])

  const stopPointer = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className={`node-quick-actions absolute bottom-1.5 right-1.5 z-[2] flex gap-0.5 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 motion-reduce:transition-none ${alwaysVisible ? 'opacity-100' : 'opacity-0'}`}
      data-testid={`node-quick-actions-${nodeId}`}
    >
      {canAsk && (
        <button
          type="button"
          onClick={handleAsk}
          onPointerDown={stopPointer}
          className="nodrag inline-flex h-5 w-5 items-center justify-center rounded bg-panel/90 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          aria-label={`Ask Olumi about ${label}`}
          title={`Ask Olumi about ${label}`}
          data-testid={`node-action-ask-${nodeId}`}
        >
          <MessageSquare size={11} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={handleInspect}
        onPointerDown={stopPointer}
        className="nodrag inline-flex h-5 w-5 items-center justify-center rounded bg-panel/90 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        aria-label={`Open details for ${label}`}
        title={`Open details for ${label}`}
        data-testid={`node-action-inspect-${nodeId}`}
      >
        <PanelRight size={11} aria-hidden="true" />
      </button>
      {/* ⭐ THE DOOR TO EVERYTHING ELSE THIS NODE CAN DO.
          Deliberately LAST: the two named shortcuts above are the ruling's
          "powerful science-grounded shortcuts", and this is the overflow, not a
          third peer. It adds no new capability and makes no claim about the
          model — it re-emits the gesture that already opens this node's menu,
          for the input classes that cannot perform it.

          The title names right-click on purpose. A user who learns the gesture
          from it stops needing the button, which is the right direction for an
          affordance whose job is discoverability. */}
      <button
        type="button"
        onClick={handleOpenMenu}
        onPointerDown={stopPointer}
        /* ⭐ 20px VISUAL, 24px TARGET. `h-5 w-5` keeps it identical to its two
           siblings, and the `before:-inset-[2px]` pseudo-element expands the
           hit area to 24×24 — WCAG 2.2 AA 2.5.8's minimum. A button whose
           entire purpose is touch reachability shipping a sub-minimum touch
           target would be self-undermining, which is why this is fixed here
           rather than rowed. The siblings share the shortfall and are left
           alone: widening their targets is a change to controls this PR is not
           about. */
        className="nodrag relative inline-flex h-5 w-5 items-center justify-center rounded bg-panel/90 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info before:absolute before:-inset-[2px] before:content-['']"
        aria-label={`More actions for ${label}`}
        /* Announces that a menu follows. `aria-haspopup` is used by five other
           canvas components, so its absence here was a real gap rather than a
           repo convention. ⛔ NO `aria-expanded`: this button dispatches an
           event and does not own the menu's open state, so it could not keep
           that attribute truthful — and a stale `aria-expanded` is worse than
           none. */
        aria-haspopup="menu"
        title={`More actions for ${label} — the same menu as right-click`}
        data-testid={`node-action-menu-${nodeId}`}
      >
        <MoreHorizontal size={11} aria-hidden="true" />
      </button>
    </div>
  )
})
