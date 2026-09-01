/**
 * THE KEYBOARD SCOPE THAT STOPS A CONTROL INSIDE A NODE SELECTING THE NODE.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * React Flow attaches its own `onKeyDown` to EVERY focusable `.react-flow__node`
 * (`@xyflow/react@12.10.2`, `dist/esm/index.mjs:2240` —
 * `onKeyDown: isFocusable ? onKeyDown : undefined`). That handler selects the
 * node on any of `elementSelectionKeys = ['Enter', ' ', 'Escape']`
 * (`@xyflow/system@0.0.76:27`), and its ONLY guard is `isInputDOMNode`
 * (`index.mjs:2174`), which is true only for `INPUT`/`SELECT`/`TEXTAREA`,
 * `[contenteditable]`, or a target with a `.nokey` ancestor
 * (`@xyflow/system@0.0.76:846-854`).
 *
 * A `<button>` or a `div[role="button"]` inside a node is none of those. So its
 * keydown bubbles to the node, and pressing ANY in-node affordance from the
 * keyboard also selects the node behind it and swings the right-hand dock to the
 * Inspector. Measured in a real browser on all five starters: 390 focusable
 * elements inside `.react-flow__node`, NONE of them gated
 * (`e2e/geometry/nodeKeyboardBleed.measure.ts`).
 *
 * On the ghost doors the two actions actively fight: the user asks to add an
 * option and also gets a selection they did not ask for.
 *
 * ── WHY THE FIX IS HERE AND NOT IN THIRTEEN COMPONENTS ──────────────────────
 *
 * This is a property of the canvas, not of any node component — every node type
 * has it, and a node type added tomorrow would have it too. A hand-maintained
 * list of `nokey`-bearing controls is exactly the mirror that drifts silently
 * (CLAUDE.md trap 12), and one of the affected components — `GhostOptionNode` —
 * has no inner element to put a class on: its ROOT is the control.
 *
 * So the scope is applied once, DERIVED, over the node-type registry: every
 * entry in `nodeTypes` is wrapped, so coverage is a property of the map rather
 * than of anyone's memory. `registry.keyboardScope.spec.tsx` asserts that by
 * iterating the registry itself.
 *
 * ── WHY IT DOES NOT KILL KEYBOARD NODE SELECTION ────────────────────────────
 *
 * `isInputDOMNode` tests `event.target.closest('.nokey')`. The scope element is
 * a DESCENDANT of `.react-flow__node`, so:
 *   - keydown from an in-node CONTROL  -> target is inside the scope -> gated;
 *   - keydown from the NODE ITSELF     -> target is the node div, which is an
 *     ANCESTOR of the scope, so `closest` finds nothing -> React Flow's handler
 *     runs exactly as before.
 *
 * That distinction is the whole point. React Flow's element-selection keys are a
 * real accessibility feature and the node div is the tab stop a keyboard user
 * reaches BEFORE its contents (it precedes its descendants in DOM order), so
 * Tab-then-Enter still selects a node and opens the Inspector. Disabling
 * `nodesFocusable` or setting `disableKeyboardA11y` would have closed this
 * defect by opening a worse one. Both directions are measured.
 *
 * ── ESCAPE IS SUPPRESSED TOO, DELIBERATELY ──────────────────────────────────
 *
 * `Escape` is in `elementSelectionKeys` (it deselects). Inside a control,
 * Escape means "close this / cancel", not "deselect the node behind it" — a
 * user dismissing a menu is not asking to change the selection, and a menu that
 * closes AND drops the selection has done two things when asked for one.
 * Escape pressed at the NODE still deselects it, because the node is outside the
 * scope. This is a choice, not a side effect of the implementation.
 *
 * ── WHY `display: contents` ─────────────────────────────────────────────────
 *
 * The scope must be an ELEMENT (a class is what `closest` looks for) but must
 * not be a BOX: React Flow sizes `.react-flow__node` from its content and this
 * repo's layout is computed from measured node sizes, so a wrapper that
 * generated a box could move the graph. `display: contents` generates no box at
 * all, while `closest()` — which walks the DOM tree, not the box tree — still
 * finds it.
 */
import type { NodeTypes } from '@xyflow/react'

/**
 * Exactly what React Flow will accept in `nodeTypes`, taken FROM React Flow's
 * own type rather than restated — so a library change to the renderer contract
 * surfaces here as a type error instead of as a silent cast.
 */
type NodeRenderer = NodeTypes[string]

/**
 * React Flow's own opt-out class. NOT configurable: unlike `noDragClassName` /
 * `noPanClassName` / `noWheelClassName`, this string is hardcoded inside
 * `isInputDOMNode`, so it cannot be renamed from the `<ReactFlow>` props and
 * must be spelled exactly.
 */
export const NODE_KEYBOARD_SCOPE_CLASS = 'nokey'

/** No box, no layout effect — see the header. */
const SCOPE_STYLE = { display: 'contents' } as const

/**
 * Wrap one node renderer so that key presses originating INSIDE it never reach
 * React Flow's node-level handler.
 */
export function withNodeKeyboardScope(NodeComponent: NodeRenderer): NodeRenderer {
  const Scoped: NodeRenderer = (props) => (
    <div className={NODE_KEYBOARD_SCOPE_CLASS} style={SCOPE_STYLE}>
      <NodeComponent {...props} />
    </div>
  )
  const inner = NodeComponent.displayName ?? NodeComponent.name ?? 'Node'
  Scoped.displayName = `NodeKeyboardScope(${inner})`
  return Scoped
}
