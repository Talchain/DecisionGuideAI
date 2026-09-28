/**
 * ⛔ THE QUESTION'S ONE LINK — the single rule for every writer that can make a
 * link at the Question (canvas audit edit-structure/F7; Delivery Lead, #2235 r1).
 *
 * CEE's `ALLOWED_EDGES` (`olumi-assistants-service`,
 * `src/validators/graph-validator.types.ts`) admits exactly one rule at a
 * decision, `decision → option`, and has no rule with a decision as its
 * target. So a link with the Question at EITHER end is refused unless it runs
 * Question → option. Any other pair, once a strength is stated, would be sent
 * as `structural_add_edge` and saved as a causal claim that the Question
 * itself moves a factor, outcome or risk.
 *
 * ONE RULE, TWO CALLERS, so the menu and the drawn link cannot disagree:
 *   - `contextMenu/actions.ts` `isQuestionTarget` — the connected adds. Each of
 *     them makes the clicked card one end of a new factor / outcome / risk
 *     link, so on a Question every one of them is a refused pair.
 *   - `hooks/useConnectGesture.ts` — the drawn link: the drag validator
 *     (`isValidConnection`), the handle drop (`onConnect`) and the card-body
 *     drop (`onConnectEnd`).
 */

type CardLike = { type?: string; data?: unknown } | null | undefined

/** A card's kind, read as the menu guard always read it: `data.kind`, else the React Flow `type`. */
function cardKind(node: CardLike): string | undefined {
  if (!node) return undefined
  return ((node.data as { kind?: string } | undefined)?.kind as string | undefined) ?? node.type
}

/** Is this card the Question (kind `decision`)? */
export function isQuestionCard(node: CardLike): boolean {
  return cardKind(node) === 'decision'
}

/**
 * Would a link `source → target` put the Question at one end of a pair CEE's
 * `ALLOWED_EDGES` forbids? `false` for Question → option, the Question's one
 * legitimate link, and for every link that does not touch the Question.
 */
export function isRefusedQuestionLink(source: CardLike, target: CardLike): boolean {
  const fromQuestion = isQuestionCard(source)
  if (!fromQuestion && !isQuestionCard(target)) return false
  return !(fromQuestion && cardKind(target) === 'option')
}
