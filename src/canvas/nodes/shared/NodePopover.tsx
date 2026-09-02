/**
 * NodePopover — portal-rendered card below a canvas node.
 * Contains Layer 2 content (bars, ConnRows, bias notes).
 * Renders via createPortal to escape ReactFlow's stacking context,
 * ensuring popovers always appear above adjacent nodes.
 *
 * ⚠ AND THAT PORTAL IS A KEYBOARD-SCOPE BOUNDARY — which is why this file
 * carries a scope of its own. React propagates events through the React TREE,
 * so a keydown in here still reaches React Flow's node handler
 * (`@xyflow/react@12.10.2` `dist/esm/index.mjs:2240`, whose only guard is
 * `isInputDOMNode`); `isInputDOMNode` walks the DOM TREE
 * (`@xyflow/system@0.0.76` `esm:846-854`: `target.closest('.nokey')` from
 * `composedPath()[0]`), so it can never reach `nodes/nodeKeyboardScope.tsx`'s
 * scope, which lives inside `.react-flow__node`. A portalled element is not a
 * descendant of that.
 *
 * MEASURED, before the fix: Enter at "Add mitigation" inside a portalled
 * popover selected the anchor node (`["fac_ae_headcount"]`) and swung the dock
 * to the Inspector, with the contrast key `q` and a plain click both reading
 * `[]` — i.e. keyboard-only, which is the bleed's signature — while
 * `node.contains(button)` was false.
 *
 * ── THE FIX: THE SAME SCOPE, ARMED HERE ─────────────────────────────────────
 *
 * `useNodeKeyboardScope` (`nodes/nodeKeyboardScope.tsx`) is the ONE mechanism,
 * imported rather than restated. It adds `.nokey` in the CAPTURE phase of a key
 * dispatch and removes it on a timer task, so:
 *
 *   · React Flow's KEYBOARD consumer sees it — our capture handler sits on an
 *     ancestor of the control in the React tree, so it runs before the node's
 *     bubble-phase `onKeyDown` in the same synchronous dispatch;
 *   · React Flow's POINTER consumer (`Pane.onPointerDownCapture`,
 *     `esm/index.mjs:1455-1456`, which REFUSES to start a marquee over a
 *     `.nokey` target) can never see it, because no `.nokey` element exists at
 *     rest. That matters more here than it does for the node scope: this
 *     popover is portalled in the DOM but is still a REACT descendant of the
 *     pane, so a permanent `.nokey` on it would be visible to that consumer
 *     through React's own tree propagation.
 *
 * ⛔ NOT `stopPropagation`. `src/` registers ~30 document/window keydown
 * listeners, overwhelmingly Escape-closes-this — one of them is
 * `shared/ScienceIcon.tsx:56`, an in-node control's own Escape-to-close.
 * Stopping the event would break the exact intent. `.nokey` stops nothing.
 *
 * ── WHY THE SCOPE IS AN INNER WRAPPER AND NOT THE CARD ITSELF ───────────────
 *
 * The card divs below carry a `className` prop. React rewrites `className`
 * whenever it renders one, so a class this component adds imperatively would be
 * racing React's own DOM write — and this component re-renders on an rAF loop
 * that tracks the anchor. The scope is therefore a separate element with NO
 * `className` prop, exactly as in `nodeKeyboardScope.tsx`, and `display:
 * contents` so it generates no box: the card's padding, scrolling and width are
 * untouched, while `closest()` — which walks the DOM tree, not the box tree —
 * still finds it.
 *
 * It wraps `children` in BOTH branches. The inline fallback is already a DOM
 * descendant of its node and so already covered by the node scope; wrapping it
 * too means the coverage is a property of this component rather than of which
 * branch a caller happens to hit.
 *
 * `data-node-popover` exists so the census and the driven portalled arm in
 * `e2e/geometry/nodeKeyboardBleed.measure.ts` can find what sits beyond that
 * boundary rather than returning a clean zero for a class they cannot see.
 * Tracks anchor position via rAF to stay aligned during pan/zoom.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNodeKeyboardScope, NODE_KEYBOARD_SCOPE_ATTR } from '../nodeKeyboardScope'

interface NodePopoverProps {
  visible: boolean
  width?: number
  children: ReactNode
  onMouseEnter: () => void
  onMouseLeave: () => void
  /** Ref to the anchor element (node wrapper) for positioning */
  anchorRef?: React.RefObject<HTMLElement | null>
}

/** No box, no layout effect — see the header. */
const SCOPE_STYLE = { display: 'contents' } as const

export function NodePopover({ visible, width, children, onMouseEnter, onMouseLeave, anchorRef }: NodePopoverProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // ⚠ BEFORE EVERY EARLY RETURN. This component returns null on three separate
  // paths; a hook called after any of them would break the rules of hooks.
  const scope = useNodeKeyboardScope<HTMLDivElement>()

  // Track anchor position continuously while visible (handles pan/zoom)
  useEffect(() => {
    if (!visible || !anchorRef?.current) {
      setPos(null)
      return
    }

    let rafId: number
    const track = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPos(prev => {
        if (prev && Math.abs(prev.top - (rect.bottom + 4)) < 0.5 && Math.abs(prev.left - rect.left) < 0.5) {
          return prev // avoid re-render if position unchanged
        }
        return { top: rect.bottom + 4, left: rect.left }
      })
      rafId = requestAnimationFrame(track)
    }
    track()

    return () => cancelAnimationFrame(rafId)
  }, [visible, anchorRef])

  /*
   * ⚠ NO `className` PROP ON THIS ELEMENT, DELIBERATELY — see the header. React
   * only writes `className` when it renders one, so leaving it off means React
   * never clobbers the class the scope handler adds.
   */
  const scoped = (
    <div
      ref={scope.ref}
      style={SCOPE_STYLE}
      onKeyDownCapture={scope.onKeyDownCapture}
      {...{ [NODE_KEYBOARD_SCOPE_ATTR]: '' }}
    >
      {children}
    </div>
  )

  if (!visible) return null

  // Fallback: if no anchorRef, render inline (backward compat)
  if (!anchorRef) {
    return (
      <div
        data-node-popover=""
        className="absolute left-0 z-[9999] bg-panel border border-panel-border rounded-lg shadow-2 nodrag nopan nowheel"
        style={{ top: '100%', marginTop: 4, width: width ?? 280, maxHeight: 250, overflowY: 'auto', padding: '10px 12px' }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {scoped}
      </div>
    )
  }

  if (!pos) return null

  return createPortal(
    <div
      data-node-popover=""
      className="fixed z-[9999] bg-panel border border-panel-border rounded-lg shadow-2 nodrag nopan nowheel"
      style={{ top: pos.top, left: pos.left, width: width ?? 280, maxHeight: 250, overflowY: 'auto', padding: '10px 12px' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {scoped}
    </div>,
    document.body
  )
}
