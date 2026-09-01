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
 * "drew on"): NO USAGE EVIDENCE IS CARRIED ON THIS WIRE PATH — `element_ids` is
 * sourced from the SELECTION alone. `projectGroundedSelection` has three call
 * sites in CEE's `turn-executor.ts` (10048, 10071, 14078) and EVERY ONE passes
 * `(focus, context.selection)`; the one that attaches the sidecar to the
 * response is 14078, whose focus is `capturedFocus = contextPack.focus`, taken
 * off the pack BEFORE the model answers. The answer's text is therefore not an
 * input to this field on any of them. `GroundedOnNotice.claimHonesty.spec.tsx`
 * REDs if a usage verb returns.
 *
 * ⚠⚠ AND THE SENTENCE THAT USED TO STAND HERE WAS A FALSE ABSENCE CLAIM —
 * corrected 1 Sep 2026, at CEE staging `d5455355`, on review. It read: *"nothing
 * on either side of the wire CAN license one"*. That is a claim about the whole
 * estate, not about this path, and it is REFUTED: CEE compares answer text
 * against an element label today —
 *
 *     answerContainsLabel(answerText: string, label: string): boolean
 *     src/orchestrator-v5/coaching/validation-priority.ts:182
 *
 * live and reachable via `decideValidationBeat` ←
 * `src/orchestrator-v5/tools/handlers/explain-results.ts:183`. The sweep that
 * produced the "zero such functions" figure keyed on a *selection/focus*
 * parameter, while this one takes a bare `label: string` — so THE PROBE CARRIED
 * THE BLIND SPOT OF THE CONCLUSION IT SUPPORTED (CLAUDE.md trap 13e).
 *
 * ⚠ SCOPE, so this correction does not become the next inherited overclaim: the
 * REVIEWER's re-run, with a contrast control that saw its known positives,
 * reported **13** such functions — that figure is the reviewer's and is NOT
 * re-derived here. What IS verified here, at the CEE bytes, is the single
 * material one named above and its reachability. One live counter-example is
 * all a universal "nothing CAN" claim needs to fall.
 *
 * WHAT SURVIVES THE REFUTATION, AND IT IS WHAT THE COPY RESTS ON: that
 * comparison feeds a coaching-beat DEDUP decision (`__validation_beat`, and
 * whether a validation paragraph is appended to the answer text). It never
 * reaches `_grounded_selection`. So the narrow claim above holds and the copy is
 * safe on it; the universal claim was never true and must not be restored.
 * Whether a real usage source is worth wiring is a separate question — ROW it,
 * do not build it here, and do not weaken this copy on the strength of a source
 * that is not on this path.
 *
 * ── WHAT IT STILL NEVER CLAIMS ─────────────────────────────────────────────
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
 *
 * ⭐⭐ BOTH SENTENCES NAME THE SELECTION, BECAUSE BOTH DESCRIBE ONE FIELD.
 * These read *"something you ASKED ABOUT"* until the referent fix, and that put
 * two referents in one box: the line above says what the user SELECTED, and
 * this one said what they asked. It is the same conflation the elements line
 * had just stopped making, and the producer settles it — `deriveUnresolved`
 * (CEE `context-pack-assembler.ts:1213-1225`, staging `d5455355`) takes a
 * `TurnSelection` and nothing else, so THE USER'S QUESTION IS NOT AN INPUT to
 * this state at all. Before the fix both sentences were consistently wrong;
 * after it they contradicted each other, which is worse, because the box
 * visibly disagrees with itself and the reader cannot tell which half to trust.
 * `GroundedOnNotice.oneReferent.spec.tsx` REDs if either sentence drifts back.
 *
 * ⚠ THE REFERENT IS THE ONLY THING THAT CHANGED. The `not_in_model` /
 * `could_not_check` discrimination is byte-untouched: one still ASSERTS the
 * absence, the other still claims nothing about presence. Collapsing them is a
 * different and wrong change, and both this spec and the sibling
 * `GroundedOnNotice.spec.tsx` RED on it.
 */
const DISCLOSURE: Readonly<Record<GroundedUnresolved, string | null>> = {
  none: null,
  not_in_model: "Something you selected isn't in this model.",
  could_not_check: "I couldn't read your model to check what you selected.",
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
