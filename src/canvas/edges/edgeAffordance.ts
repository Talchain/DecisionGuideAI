/**
 * ⭐⭐ WHAT A DOUBLE-CLICK ON THIS EDGE ACTUALLY DOES — one derivation, both
 * channels, and testable by EXECUTION rather than by reading the source.
 *
 * WHY IT IS A FUNCTION AND NOT A TERNARY IN THE JSX, which is where it started:
 * the first guard written for it was a SOURCE SCAN, and a mutant that forced
 * the predicate to `true` — promising an edit on every edge, including the ones
 * whose write cannot land — **left the source text unchanged and the guard
 * GREEN**. A scan proves the code SAYS the right thing and can never prove it
 * DOES it. That is CLAUDE.md's "a guard agreeing with itself", and the over-
 * promise is the worse of the two failures it has to catch.
 *
 * THE COST OF THE WORD IT REPLACES, measured on the founder's session
 * (19 Sep 2026): 27 actions over 34 minutes, every one a chat message or a chip
 * click, and not one direct edit — while `edgeStrengthEditIsAssertable` returns
 * true for 24 of his 26 edges. The control worked the whole time; the product's
 * only standing word for it was "inspect", which says read-only.
 *
 * ⚠ THE WORD WAS STALE, NOT WRONG WHEN WRITTEN. Its justification cited a panel
 * fenced behind an unconditional `<fieldset disabled>`. That fence was removed
 * and the word was not — the same stale-doc defect that caused a `techMode`
 * misdiagnosis hours earlier, except this one is user-facing.
 *
 * ⛔ IT PROMISES ONLY WHERE THE EDIT CAN LAND. Same predicate the panel fences
 * on, CALLED rather than restated, so the label and the control cannot drift
 * into offering different things.
 *
 * ⚠⚠ THE CAUSE THIS BLOCK ORIGINALLY GAVE IS WITHDRAWN, AND IT IS STRUCK RATHER
 * THAN DELETED. It read: *"Every risk -> goal edge is refused today (an unsigned
 * magnitude beside a separate direction, which the contract cannot carry)."*
 * That rested on reading `full_graph.edges[].strength_mean` in a debug bundle as
 * a WIRE fact. It is not one: `applyDraftResult.ts:99` stores
 * `Math.max(0, Math.min(2, Math.abs(rawWeight)))`, and `exportBundle.ts:2280`
 * manufactures `strength_mean` back out of that absolute `weight` — so a server
 * edge that arrived CORRECTLY SIGNED (`-0.35`, `direction: 'negative'`) is
 * byte-identical in the export to one that did not. The evidence could not
 * distinguish the two cases, so it never supported the claim.
 *
 * ⭐ WHAT IS TRUE, taken from the predicate itself rather than from a symptom:
 * `edgeStrengthEditIsAssertable` returns whatever `buildEdgeStrengthEditEvent`
 * can build, and that refuses on canonical endpoint ids, a server-stated
 * `expected` tuple, and the magnitude bound — the rules that module owns. The
 * MEASURED outcome on the founder's 19 Sep model stands unchanged and is what
 * this change rests on: **24 of 26 edges assertable.** The two refusals are not
 * attributed here, because attributing them needs the canvas `Edge` the
 * predicate actually takes, and inferring them from an export-shaped tuple is
 * precisely the mistake the struck sentence made.
 */
import { edgeStrengthEditIsAssertable } from '../conversation/edgeStrengthEdit'

/** What the reader is offered when the strength can be set here. */
export const EDGE_AFFORDANCE_EDITABLE = 'Double-click to set its strength'
/** And when it cannot — accurate, and all the panel can honestly offer. */
export const EDGE_AFFORDANCE_READ_ONLY = 'Double-click to inspect'

/**
 * ⭐ THE DIRECT CONTROL'S LABEL, for the surface that offers a BUTTON rather
 * than describing a gesture.
 *
 * A tooltip teaches a gesture; a button performs the task. The founder needed
 * the second — he had the edge under the pointer for 34 minutes. Kept here with
 * the sentences so one datum has one spelling (CLAUDE.md trap 21).
 */
export const EDGE_AFFORDANCE_DIRECT_ACTION = 'Set strength'

/**
 * And what the CHAT route is called once the direct one is on screen beside it.
 *
 * ⛔ IT IS RENAMED, NOT REMOVED. Asking Olumi is a legitimate route and the only
 * one on an edge whose write is refused — but two controls a pixel apart both
 * reading "Adjust strength" is a worse defect than the one being fixed: the user
 * cannot tell the fast route from the slow one. Where the direct control is
 * absent, the chip keeps its plain name, because there it is not the slow route,
 * it is the only route.
 */
export const EDGE_AFFORDANCE_CHAT_ALTERNATIVE = 'Ask Olumi to adjust it'

export function edgeDoubleClickAffordance(
  edge: Parameters<typeof edgeStrengthEditIsAssertable>[0],
): string {
  return edgeStrengthEditIsAssertable(edge)
    ? EDGE_AFFORDANCE_EDITABLE
    : EDGE_AFFORDANCE_READ_ONLY
}
