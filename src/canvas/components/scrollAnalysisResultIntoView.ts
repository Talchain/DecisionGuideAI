/**
 * scrollAnalysisResultIntoView — ROADMAP 2.204-R3.
 *
 * Brings the TOP of the most recently rendered `v5_analysis_result` card to the
 * top of its scroll container. The decision to call this is 2.204's own
 * `shouldReturnToOlumiAfterRun`, taken verbatim at the OutputsDock call site —
 * this file only performs it, so the DOM work stays testable without the dock
 * and the policy stays a single, already-adjudicated predicate.
 *
 * ## Why a document query rather than a ref
 * The card is rendered by `V5AnalysisResultBlock` inside `InlineBlocks` inside
 * `ChatMessage` inside `ChatThread` inside `ConversationPanel` inside
 * `OlumiTabBody` — six components below the effect that knows the tab has just
 * become visible. Threading a ref up through them would break two `memo`
 * boundaries to deliver one scroll. The codebase already scrolls by testid on the
 * same grounds (`model-tab/StatusBar.tsx:28`, and `ConversationPanel.tsx:451`
 * says so explicitly: *"ChatThread manages its own scroll ref; fall back to
 * document query"*). Testids are not stripped from this build.
 *
 * ## Why the LAST card
 * Derived from the DOM at call time, never remembered (platform trap 12). On a
 * rerun the previous run's card is still in the transcript above the new one; a
 * remembered element — or `querySelector`'s first match — would park the tester
 * on stale numbers.
 *
 * ## Why `block: 'start'`
 * The card measured 1,218.8 px tall in a 676 px scrollport
 * (`probe-2204-pixel-walk.md` §7). Any alignment other than its top leaves the
 * five 2.154 prose fields below the fold, which is the residual being closed.
 */

/** The card element `V5AnalysisResultBlock.tsx:303` renders. */
export const ANALYSIS_RESULT_CARD_SELECTOR = '[data-testid="v5-analysis-result"]'

/**
 * Scroll the newest analysis-result card's top into view.
 *
 * Returns whether a card was found, so a caller can tell "nothing to scroll to"
 * apart from "scrolled" rather than failing silently. Fail-closed: absent card,
 * or an environment without `scrollIntoView`, is a no-op.
 */
export function scrollAnalysisResultIntoView(root: ParentNode = document): boolean {
  const cards = root.querySelectorAll(ANALYSIS_RESULT_CARD_SELECTOR)
  const card = cards[cards.length - 1]
  if (!card) return false
  if (typeof (card as HTMLElement).scrollIntoView !== 'function') return false
  ;(card as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}
