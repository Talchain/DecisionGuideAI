/**
 * THE KEYBOARD SCOPE THAT STOPS A CONTROL INSIDE A NODE SELECTING THE NODE.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * React Flow attaches its own `onKeyDown` to EVERY focusable `.react-flow__node`
 * (`@xyflow/react@12.10.2`, `dist/esm/index.mjs:2240`). It selects the node on
 * `elementSelectionKeys = ['Enter', ' ', 'Escape']` (`@xyflow/system@0.0.76:27`)
 * and moves a selected node on the arrow keys (`:2186`). Its only guard is
 * `isInputDOMNode` (`:2174`), true only for `INPUT`/`SELECT`/`TEXTAREA`,
 * `[contenteditable]`, or a target with a `.nokey` ancestor.
 *
 * A `<button>` inside a node is none of those, so every in-node affordance also
 * selected the node and swung the dock to the Inspector. Measured across all
 * five starters: 390 focusable elements inside `.react-flow__node`, none gated.
 *
 * ── `.nokey` HAS TWO CONSUMERS, AND THE FIRST VERSION OF THIS FILE ENUMERATED
 *    ONE. COMPLETE MANIFEST, at the pinned versions, scope stated ────────────
 *
 * Swept: every `dist` build of `@xyflow/react@12.10.2` (esm/index.js,
 * esm/index.mjs, umd/index.js) and of `@xyflow/system@0.0.76` (same three).
 * Contrast control in the same sweep: `nodrag` reads non-zero in every file, so
 * the probe sees class names it is not looking for.
 *
 *   1. KEYBOARD — `@xyflow/system@0.0.76` `isInputDOMNode` (`esm:846-854`):
 *        `return isInput || !!target.closest('.nokey')`
 *      Consulted by the node keydown handler, and by `useKeyPress` (which is
 *      how Backspace deletes a node) — the latter only when no modifier is
 *      held, so Shift still registers for marquee.
 *
 *   2. POINTER — `@xyflow/react@12.10.2` `Pane.onPointerDownCapture`
 *      (`esm/index.mjs:1455-1456`):
 *        `const isNoKeyEvent = !eventTargetIsContainer && !!event.target.closest('.nokey')`
 *      ...and `isNoKeyEvent` returns early, i.e. NO MARQUEE STARTS.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS FIX PUT `.nokey` ON A WRAPPER AROUND ALL NODE
 * CONTENT, WHICH OPTED THE ENTIRE CANVAS OUT OF CONSUMER 2. Measured by an
 * independent reviewer, discriminating pair, same node and coordinates:
 * Shift-drag over a node went from "marquee, node not moved" to "NO MARQUEE,
 * NODE MOVED". A worse defect than the one being fixed, and the classic shape —
 * fixing one reader of a shared value without enumerating the others.
 *
 * ── THE CHOICE, PER CONSUMER ────────────────────────────────────────────────
 *
 * The class is added in the CAPTURE PHASE OF A KEYDOWN and removed in a
 * microtask, so it exists only for the duration of one key dispatch.
 *
 *   · Consumer 1 (keyboard) sees it: React's dispatch is synchronous, so the
 *     node's own keydown handler — which runs later in the same dispatch —
 *     reads `closest('.nokey')` and bails. Intended.
 *   · Consumer 2 (pointer) can NEVER see it: a pointerdown is not a keydown, so
 *     at pointerdown time no `.nokey` element exists anywhere in the document.
 *     That is asserted directly, at rest, rather than argued.
 *
 * ── WHY NOT `stopPropagation`, WHICH WAS THE OTHER CANDIDATE ────────────────
 *
 * Because it was MEASURED and it is wrong for this codebase. React's
 * `stopPropagation` also stops the NATIVE event past the React root container,
 * and `src/` registers ~30 `document`/`window` keydown listeners. The
 * overwhelming majority are Escape-closes-this handlers — and one of them is
 * `nodes/shared/ScienceIcon.tsx:56`, i.e. an IN-NODE control's own
 * Escape-to-close. Stopping the event would have broken the exact user intent
 * ("Escape means close this popover") that suppressing Escape was supposed to
 * serve. `.nokey` does not stop anything; every one of those listeners still
 * fires.
 *
 * ── WHY THE SEAM AND NOT THIRTEEN COMPONENTS ────────────────────────────────
 *
 * This is a property of the canvas, not of any node component, and a
 * hand-maintained list of `nokey`-bearing controls is the mirror that drifts
 * (CLAUDE.md trap 12). `GhostOptionNode` also has no inner element to put a
 * class on: its ROOT is the control. So the scope is applied once, DERIVED over
 * the node-type registry — coverage is a property of the map, not of anyone's
 * memory.
 *
 * ── WHY IT DOES NOT KILL KEYBOARD NODE SELECTION ────────────────────────────
 *
 * The scope element is a DESCENDANT of `.react-flow__node`. A keydown from the
 * NODE ITSELF never enters the scope, so `onKeyDownCapture` never fires, no
 * class is ever added, and React Flow's handler runs exactly as before. The
 * node div is also the tab stop a keyboard user reaches BEFORE its contents, so
 * Tab-then-Enter still selects a node and opens the Inspector. Both directions
 * are measured.
 *
 * ── ESCAPE ─────────────────────────────────────────────────────────────────
 *
 * Escape from inside a control no longer deselects the node, because the guard
 * is key-agnostic once armed. That is the intended reading — inside a control
 * Escape means "close this" — and it is now compatible with the app's ~30
 * Escape listeners rather than in conflict with them. Escape AT the node still
 * deselects it.
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
import { useCallback, useEffect, useRef } from 'react'
import type { NodeTypes } from '@xyflow/react'

/**
 * Exactly what React Flow will accept in `nodeTypes`, taken FROM React Flow's
 * own type rather than restated — so a library change to the renderer contract
 * surfaces here as a type error instead of as a silent cast.
 */
type NodeRenderer = NodeTypes[string]

/**
 * React Flow's own opt-out class. NOT configurable: unlike `noDragClassName` /
 * `noPanClassName` / `noWheelClassName`, this string is hardcoded inside both
 * consumers below, so it cannot be renamed from the `<ReactFlow>` props and
 * must be spelled exactly.
 */
export const NODE_KEYBOARD_SCOPE_CLASS = 'nokey-DELIBERATELY-BROKEN-REVERT-ME'

/** No box, no layout effect — see the header. */
const SCOPE_STYLE = { display: 'contents' } as const

/**
 * An inert identity handle for the scope element.
 *
 * ⚠ TESTS MUST NOT BIND TO `.nokey`, because the class is absent except during
 * a key dispatch — that absence IS the fix. Binding to it would make a guard
 * that passes only when the pointer consumer is broken.
 */
export const NODE_KEYBOARD_SCOPE_ATTR = 'data-node-keyboard-scope'

/**
 * Wrap one node renderer so that key presses originating INSIDE it never reach
 * React Flow's node-level handler — and so that NOTHING ELSE changes.
 */
export function withNodeKeyboardScope(NodeComponent: NodeRenderer): NodeRenderer {
  const Scoped: NodeRenderer = (props) => {
    const ref = useRef<HTMLDivElement>(null)

    /*
     * CAPTURE PHASE, so the class is on the element before the event reaches
     * either the control's own handler or React Flow's node handler; MICROTASK
     * removal, so it is gone the instant the dispatch finishes. React's event
     * dispatch is synchronous, so every handler in this keydown — including the
     * document-level ones the app relies on — runs before the microtask.
     */
    const disarmTimer = useRef<number | undefined>(undefined)

    /*
     * ⚠ ONE LISTENER FOR THE LIFETIME OF THE NODE, NOT ONE PER KEYSTROKE.
     *
     * This was registered inside the keydown handler with `{ once: true }`,
     * which self-removes ONLY IF A POINTERDOWN EVER ARRIVES. Typing thirty
     * characters with no click in between left thirty listeners on `document`,
     * for every mounted node. A real leak, and it grew with use.
     *
     * Registered here it is one per node, removed on unmount, and disarming an
     * already-disarmed scope is a no-op — so nothing is lost by it being
     * unconditional.
     *
     * It stays on `document` in the CAPTURE phase because that is what makes it
     * run before `Pane.onPointerDownCapture` (the pane is a descendant of
     * document): React Flow decides whether to start a marquee having seen no
     * `.nokey`, whatever a pending timer is doing.
     */
    useEffect(() => {
      const disarm = () => ref.current?.classList.remove(NODE_KEYBOARD_SCOPE_CLASS)
      document.addEventListener('pointerdown', disarm, { capture: true })
      return () => {
        document.removeEventListener('pointerdown', disarm, { capture: true })
        window.clearTimeout(disarmTimer.current)
      }
    }, [])

    const onKeyDownCapture = useCallback(() => {
      const el = ref.current
      if (!el) return
      el.classList.add(NODE_KEYBOARD_SCOPE_CLASS)

      /*
       * ⚠⚠ `queueMicrotask` WAS THE FIRST IMPLEMENTATION AND IT IS WRONG —
       * caught by execution, not by reading. A microtask checkpoint runs every
       * time the JS stack empties, and the browser empties it BETWEEN listener
       * invocations of a single dispatch. So for a REAL key press the class was
       * added during React's capture phase at the root container and removed
       * again before the event bubbled back to React's node handler: the guard
       * armed and disarmed without ever being read, and the bleed survived.
       *
       * It looked correct under a synthetic `dispatchEvent`, because calling
       * `dispatchEvent` from script keeps the stack non-empty for the whole
       * dispatch — AN INSTRUMENT THAT SHARED THE CODE'S OWN ASSUMPTION AND SO
       * COULD NOT CONTRADICT IT. Only a real, trusted key press in a browser
       * could see it.
       *
       * A timer task cannot run until the entire dispatch, including every
       * document-level listener, has finished. The previous timer is cleared so
       * a stale one cannot disarm a scope a later keystroke has just armed.
       */
      window.clearTimeout(disarmTimer.current)
      disarmTimer.current = window.setTimeout(() => el.classList.remove(NODE_KEYBOARD_SCOPE_CLASS), 0)
    }, [])

    /*
     * ⚠ NO `className` PROP, DELIBERATELY. React only writes `className` when it
     * renders one, so leaving it off means React never clobbers the class this
     * handler adds. Passing `className={undefined}` would be the same thing;
     * passing a computed one would create a race between React's DOM write and
     * this handler.
     */
    return (
      <div ref={ref} style={SCOPE_STYLE} onKeyDownCapture={onKeyDownCapture} {...{ [NODE_KEYBOARD_SCOPE_ATTR]: '' }}>
        <NodeComponent {...props} />
      </div>
    )
  }
  const inner = NodeComponent.displayName ?? NodeComponent.name ?? 'Node'
  Scoped.displayName = `NodeKeyboardScope(${inner})`
  return Scoped
}
