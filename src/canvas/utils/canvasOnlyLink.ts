/**
 * ⭐ A LINK THAT IS ON THE CANVAS ONLY — one reader, one mark, one way in.
 *
 * A link the user draws (drag-to-connect, or "Add … from this" / "Add connected
 * factor") is built from `USER_EDGE_DEFAULTS`, which states no strength. The
 * capture therefore stands down at `strength_not_stated` and RECORDS that on
 * the edge (`EdgeData.structuralAddStandDown`); nothing is sent, and the link is
 * durable only once somebody states how strong it is. That stand-down is the
 * designed outcome (never send the 0.3 default: `mutations/structuralAddEdge.ts`).
 *
 * ⛔ WHAT WAS WRONG WAS THE DISCLOSURE (canvas audit edit-structure/F3, 27 Sep
 * 2026). The only place the canvas said so was a toast that faded; the link
 * then looked identical to a saved one (measured: 1px grey, solid, no label),
 * and on reload it vanished under a line blaming "another tab". Contract v3.1
 * §02: "Edit-state words stay visible … Not saved."
 *
 * So this module owns the three things every surface needs to say it:
 *  · `isCanvasOnlyLink` — the ONE predicate, off the recorded receipt (the
 *    exact value, never "some marker is present") AND the server not holding
 *    the link's pair (see below);
 *  · `CANVAS_ONLY_LINK_MARK` — the words on the link itself;
 *  · and, in `openEdgeStrengthEditor.ts`, `openStrengthForNewCanvasOnlyLink`
 *    — after a gesture draws such a link, put the control that states its
 *    strength (EdgePanel's `edge-state-strength-for-save`) in front of the user.
 *
 * ⛔ NOT A DASH. Paul, 23 Sep contract feedback point 4: "dash remains existence
 * certainty only" (`edges/edgePresentation.ts` `EDGE_DASH_RULES`). The state is
 * carried by WORDS, which is what the contract's state vocabulary is.
 */
// ⚠ A LEAF MODULE ON PURPOSE: the reload merge (`mergeServerGraph`), the store's
// capture retry and the hold wording read the predicate, so it must not drag the
// store or the camera helpers in with it (`graphIdentity` is itself a leaf). The
// openers live beside `openEdgeStrengthEditor`.
import { canvasEdgePairKey } from './graphIdentity'

/**
 * The link pairs the server is known to hold: `store.lastAuthoritativeGraph`,
 * passed as it is (null/undefined = no evidence, so nothing is held).
 */
export type ServerHeldEdgePairs = { readonly edgePairs: ReadonlyArray<string> } | null | undefined

/**
 * The raw receipt: the edge recorded that its capture stood down for want of a
 * stated strength. Bound by the exact value, never "some marker is present".
 *
 * ⚠ NOT THE DISPLAY PREDICATE. A receipt says the link was not sent WHEN IT WAS
 * DRAWN; it cannot know the server came to hold the same pair later (the chat
 * added it, or a registration carried it). Every surface, and the capture
 * retry, reads `isCanvasOnlyLink` below. The one reader of this alone is the
 * reload merge's naming of links it removes, which are by construction on
 * pairs the server does not hold.
 */
export function recordsStrengthStandDown(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    (data as { structuralAddStandDown?: unknown }).structuralAddStandDown === 'strength_not_stated'
  )
}

/**
 * True exactly when the edge stood down for want of a stated strength AND the
 * server is not known to hold its pair.
 *
 * ⛔ THE SECOND CONDITION (review r06 blocker 2, 28 Sep 2026). The receipt used
 * to be the whole predicate, and nothing cleared it when the server came to
 * hold the same pair: `overlayEdge` kept the canvas data, on the chat-turn
 * receipt and on the boot readback. Reachable: draw a link, then add it
 * through the chat (the route the old toast named). The link was in CEE and
 * the canvas said "Not saved" on it for good, and its add-control would send a
 * second `structural_add_edge` for a pair CEE already held. The ROOT fix is in
 * `overlayEdge` (a wire edge on the pair drops the receipt); this condition is
 * the second guard, for a server-held pair that no overlay has visited (e.g. a
 * registration CEE acknowledged).
 *
 * ⚠ KNOWN LIMIT: `lastAuthoritativeGraph` is SEEDED from the loaded canvas on
 * a cold load or scenario switch (`store.ts` `loadScenario`/`hydrateGraphSlice`),
 * so until CEE's readback replaces it, a canvas-only link loaded from the
 * autosave counts as held here and is not marked. The readback then either
 * removes that link (the reload line names it) or records the server's real
 * pairs, which brings the mark back.
 */
export function isCanvasOnlyLink(
  edge: { readonly source?: unknown; readonly target?: unknown; readonly data?: unknown } | null | undefined,
  serverHeld: ServerHeldEdgePairs,
): boolean {
  if (!edge || !recordsStrengthStandDown(edge.data)) return false
  const key = canvasEdgePairKey(edge)
  return key === null || !(serverHeld?.edgePairs ?? []).includes(key)
}

/**
 * The edit-state word on the link (contract v3.1 `.state-word`: "Not saved"),
 * and the one move that clears it. "Send", never "save": the sender has no
 * revert lifecycle, so dispatch is all the product can promise
 * (`INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON` holds the same rule).
 */
export const CANVAS_ONLY_LINK_MARK = {
  word: 'Not saved',
  action: 'set strength',
  title: 'This connection is on your canvas only. Set its strength to send it to the model.',
} as const
