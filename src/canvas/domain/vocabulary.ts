/**
 * User-facing vocabulary for node kinds — ONE spelling, so a product rename is
 * one edit rather than nine.
 *
 * ⭐⭐ WHY THIS FILE EXISTS (Paul, 31 Aug 2026). The decision node's user-facing
 * word was re-typed as a bare `'Decision'` literal in NINE places: the node
 * registry, the plot toolbar, the model-tab row presentation, the inspector
 * strings, the graph vocabulary legend, the legacy node inspector, the context
 * menu, the pre-analysis health readout and the canvas legend popover. Renaming
 * it meant finding all nine and hoping none was missed — the hand-maintained
 * mirror this estate keeps paying for (CLAUDE.md trap 12), in a product noun.
 *
 * ⚠ THIS IS THE DISPLAY WORD ONLY. The node KIND is still `'decision'` and must
 * stay that way: it is a wire value on the CEE/schemas contract, a key in
 * `NODE_REGISTRY`, `TIER_BY_KIND` and every adapter's type union. Renaming the
 * identifier would be a contract change wearing a copy change's clothes.
 */

/**
 * The decision node, as a user reads it.
 *
 * ⭐ "Decision" was retired 31 Aug 2026. Paul: *"we agreed [it] should not be
 * called Decision anymore, as we're not solely focusing on decisions"*.
 *
 * WHY "Question" AND NOT THE ALTERNATIVES, since the next person will ask:
 *
 *   • The product is the strategic reasoning layer — teams "frame problems,
 *     strategise, ideate, challenge and debate". Not every model ends in a
 *     decision, and the anchor node should not assert that it does.
 *   • This node's children are OPTIONS, so it is the thing options are answers
 *     to. That is a question.
 *   • ⚠ "Challenge" was the closest rival and is REJECTED on collision: the
 *     product already uses "challenge" as a verb for contesting an estimate
 *     ("Challenge this result"). One word, two concepts, is trap 21 — and
 *     minting it deliberately would be worse than inheriting it.
 *   • "Choice" carries the same decide-only narrowing as "Decision".
 *
 * It also reads honestly when empty: a node labelled "Question" invites the
 * user to write theirs, which is the state a fresh model is actually in.
 */
export const DECISION_NODE_LABEL = 'Question'

/** One-line gloss, for legends and vocabulary surfaces. */
export const DECISION_NODE_DEFINITION =
  'What you are working out — the options below are the answers you are weighing.'
