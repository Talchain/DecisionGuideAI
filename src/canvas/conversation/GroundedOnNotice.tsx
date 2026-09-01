/**
 * GroundedOnNotice — "this answer was produced using these elements of your
 * model", rendered inside the assistant bubble the claim is about.
 *
 * THE CONSUMER HALF of CEE's `_grounded_selection` sidecar (hop 4b). The
 * producer contract, its exact semantics and the fail-closed rules are
 * documented once, at the wire binding: see `groundedSelection.ts`. Read that
 * header before changing any copy here — two of the three states in this
 * component exist to honour a producer ruling, not a design preference.
 *
 * ── WHY THIS SURFACE, AND NOT THE CANVAS ───────────────────────────────────
 * A grounding is a fact about ONE TURN's answer ("which elements was THIS
 * turn's answer grounded on?"). It therefore belongs with that turn's answer,
 * and three things follow that a canvas-marking treatment cannot give:
 *
 *  1. HISTORY STAYS TRUE. The bubble is per-message, so scrolling back shows
 *     each answer with its OWN grounding. A canvas mark is global and
 *     single-slot: the latest turn's marks would sit beside every older answer
 *     in the transcript, which is a mis-attribution the user cannot detect.
 *  2. THE TWO UNRESOLVED STATES BECOME VISIBLE AT ALL. `not_in_model` and
 *     `could_not_check` MUST NOT COLLAPSE (producer ruling). Under node
 *     marking alone BOTH mark nothing, so the distinction is unrenderable and
 *     needs a second surface anyway. Here all three states render in ONE place,
 *     under one authority.
 *  3. NO SECOND FOCUS AUTHORITY ON THE CANVAS (CLAUDE.md trap 21). The canvas's
 *     `highlightedNodes` / `highlightedEdges` channel is already read by
 *     focus-mode and applied-edit treatments; adding a third writer with
 *     different semantics is how two questions end up under one name. This
 *     component writes NO store state at all — it is a pure read.
 *
 * ── ⭐⭐ WHY THE COPY IS ABOUT THE SELECTION, NOT ABOUT THE ANSWER ──────────
 * This surface shipped reading **"Answered using X"** and that was FALSE on a
 * reachable and ordinary path. Witnessed on deployed staging (CEE `18b84b0`,
 * UI `6e58c921`, 1 Sep 2026): a user asked about **co-founder equity** and the
 * answer was footered *"Answered using Warm Connection Density"* — a node the
 * answer never touched. It was simply the node they had selected, and it
 * persisted across several turns.
 *
 * The mechanism, derived at both producers' bytes rather than inferred:
 *   · the UI attaches `selected_elements` from the LIVE canvas store on EVERY
 *     send (`buildPayload.ts` `deriveSelectedElements`) — a typed question and
 *     the SelectionPill are byte-identical on the wire;
 *   · nothing clears that selection when a turn is sent (`clearSelection` has
 *     exactly one caller, `FocusModeChip`), and creating a node auto-selects
 *     it (`store.ts` `addNodeWithEdge`) — so a selection is STICKY by default;
 *   · CEE re-projects that same selection back out unchanged
 *     (`projectGroundedSelection`: `element_ids` = the selected ids).
 *
 * So `element_ids` is the user's SELECTION, on every path there is. It is never
 * derived from what the answer drew on — the producer says so itself: *"no code
 * here reads the model's output"*. Two questions were living under one name
 * (CLAUDE.md trap 21):
 *
 *   · what the producer computes → "what did the user have selected?"
 *   · what "Answered using" asserts → "what did this answer draw on?"
 *
 * The remedy that trap prescribes is to NAME THE CONCEPTS APART and let the
 * surface consume the one that is true, which is what the copy now does. It
 * states the user's own selection at send time and makes no provenance claim of
 * any kind. Do not reintroduce a usage verb here ("answered using", "based on",
 * "drew on") — nothing on either side of the wire can license one, and
 * `GroundedOnNotice.claimHonesty.spec.tsx` REDs if one returns.
 * · Never a COUNT of grounded elements. The id→label join below is fail-closed
 *   and can legitimately name FEWER elements than the producer sent (an id for
 *   a node not on this canvas cannot be named without fabricating a label).
 *   Stating "2 elements" while naming one would be exactly that fabrication, so
 *   no quantity is ever stated. Do not add one without revisiting the join.
 * · Never anything at all on a turn that carried no sidecar. `null` in ⇒ this
 *   component is not rendered (enforced at the call site in MessageBubble).
 */
import { memo, useMemo } from 'react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { resolveElementLabel } from './utils/resolveElementLabel'
import type { GroundedSelection, GroundedUnresolved } from './groundedSelection'

/** A grounded element this canvas can actually name, bound to its canonical id. */
export interface NamedGroundedElement {
  id: string
  label: string
}

/**
 * ID-FIRST, FAIL-CLOSED join from the producer's canonical ids to display
 * labels — the same direction and the same failure posture as CEE's own focus
 * join, which is id-first *precisely because* "labels collide".
 *
 * ⭐ NAMING IS DELEGATED, NOT RE-DERIVED. `resolveElementLabel` is this repo's
 * existing, tested authority for "what is this canvas element called" (nodes
 * first, then edges composed from their endpoints, `undefined` when it cannot
 * say). An earlier draft of this function re-implemented that traversal, which
 * would have made a SECOND authority on the name of an element — the trap-21
 * shape this estate has already paid for. Only the id-binding and the
 * fail-closed dropping below belong to this module.
 *
 * ⚠ AN ID THAT MATCHES NOTHING ON THIS CANVAS CONTRIBUTES NOTHING. That is the
 * fail-closed half: a graph can legitimately be out of step with a turn (an
 * element deleted since the answer, or a hydrated transcript read against a
 * different model), and inventing a name — or echoing a raw uuid at the user —
 * would be a fabrication. Order is preserved as received: it is
 * persisted-graph order and matches the order CEE gave the model.
 */
export function resolveGroundedLabels(
  elementIds: readonly string[],
  nodes: Parameters<typeof resolveElementLabel>[1],
  edges: Parameters<typeof resolveElementLabel>[2],
): NamedGroundedElement[] {
  const named: NamedGroundedElement[] = []
  for (const id of elementIds) {
    const label = resolveElementLabel(id, nodes, edges)?.trim()
    if (label === undefined || label.length === 0) continue
    named.push({ id, label })
  }
  return named
}

/**
 * The disclosure sentence per unresolved state — and the whole reason this is a
 * lookup rather than a conditional is that the two non-`none` members must
 * NEVER share copy.
 *
 *  · `not_in_model`    — the graph WAS read and does not contain what the turn
 *                        pointed at. Asserting absence is honest here.
 *  · `could_not_check` — the graph could NOT be read. This says only that, and
 *                        claims NOTHING about whether the element exists.
 *                        Rendering "not found" here is the exact conflation the
 *                        producer's contract exists to prevent.
 *  · `none`            — nothing is missing, so there is nothing to disclose.
 */
const DISCLOSURE: Readonly<Record<GroundedUnresolved, string | null>> = {
  none: null,
  not_in_model: "Something you asked about isn't in this model.",
  could_not_check: "I couldn't read your model to check what you asked about.",
}

export const GroundedOnNotice = memo(function GroundedOnNotice({
  groundedSelection,
}: {
  groundedSelection: GroundedSelection
}) {
  // Single-field selectors: a bare object selector here would be the React #185
  // landmine `ci:guard:zustand` exists to catch.
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  const named = useMemo(
    () => resolveGroundedLabels(groundedSelection.element_ids, nodes, edges),
    [groundedSelection.element_ids, nodes, edges],
  )

  const disclosure = DISCLOSURE[groundedSelection.unresolved]

  // Nothing nameable and nothing to disclose ⇒ render nothing. Silence is the
  // honest output, not an empty container.
  if (named.length === 0 && disclosure === null) return null

  return (
    <div
      className={typo('panelMeta', 'mt-1.5 flex flex-col gap-0.5 text-text-muted')}
      data-testid="grounded-on-notice"
      data-unresolved={groundedSelection.unresolved}
    >
      {named.length > 0 && (
        <p data-testid="grounded-on-elements">
          <span>You had </span>
          {named.map((element, index) => (
            <span key={element.id} data-testid="grounded-on-element" data-element-id={element.id}>
              {index > 0 ? ', ' : ''}
              <span className="text-text-body">{element.label}</span>
            </span>
          ))}
          <span> selected when you asked.</span>
        </p>
      )}
      {disclosure !== null && <p data-testid="grounded-on-unresolved">{disclosure}</p>}
    </div>
  )
})
