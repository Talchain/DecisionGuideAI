/**
 * ⭐ AN ASK STAYS ABOUT WHAT IT ASKED ABOUT — Codex post-merge finding 5810867282
 * on DGAI #1934 (24 Sep 2026).
 *
 * Every Ask door prefills and waits for the person's Send (`ASK_SEMANTIC`). Send
 * derives `selected_elements` from the LIVE canvas selection, so an Ask about A
 * followed by a click on B grounded A's named question in B. `requestAsk` binds
 * the ask's target here; the payload builder takes it for the FIRST send whose
 * message still OPENS with the prefilled question, and consumes it. A message
 * whose opening the person replaced follows the live selection, like any typed
 * question.
 *
 * Module state, deliberately: exactly one draft is pending at a time (a new ask
 * replaces the draft and so the binding), and the builder is not a component.
 */

export interface AskTargetBinding {
  readonly draft: string
  readonly nodeIds: ReadonlySet<string>
  readonly edgeIds: ReadonlySet<string>
}

/** How much of the prefilled question must still open the message for the ask to stand. */
export const ASK_BINDING_PREFIX_CHARS = 24

let pending: AskTargetBinding | null = null

/** Bind the next send to this ask's target. An ask with no target binds nothing. */
export function bindAskTarget(draft: string, nodeIds: Iterable<string>, edgeIds: Iterable<string>): void {
  const text = draft.trim()
  const nodes = new Set(nodeIds)
  const edges = new Set(edgeIds)
  pending = text.length > 0 && nodes.size + edges.size > 0 ? { draft: text, nodeIds: nodes, edgeIds: edges } : null
}

/**
 * The ask this message was sent under — iff it still opens with the prefilled
 * question — consumed on use. `null` leaves any pending binding in place.
 */
export function takeAskTargetBinding(message: string): AskTargetBinding | null {
  const bound = pending
  if (!bound) return null
  if (!message.trim().startsWith(bound.draft.slice(0, ASK_BINDING_PREFIX_CHARS))) return null
  pending = null
  return bound
}

/** Drop any pending binding (test isolation; a new ask replaces it anyway). */
export function clearAskTargetBinding(): void {
  pending = null
}
