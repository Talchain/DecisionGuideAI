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

/**
 * The state a factor is in when it carries a number and nobody has confirmed it
 * — `factorIsConfirmable` in `./valueProvenance`, the write authority's own
 * condition and the predicate behind every live "N to verify" surface.
 *
 * ⭐ WHY IT MOVED HERE (1 Sep 2026). It was authored inside
 * `model-tab-v2/rowPresentation.ts` as one row of `ATTENTION_LABEL`, which was
 * fine while the Model tab was its only reader. The Analysis (New) model strip
 * now names the same state on the same predicate, and `model-tab-v2/` is a
 * SEALED namespace: its boundary guard permits exactly one outside reference —
 * its named mount host — because a second reference is a second mount path.
 * So the choice was to reach through a sealed door, or to keep a second copy of
 * a user-facing string on another surface. Both are wrong, and this file exists
 * for exactly the second one: a product word re-typed per surface is the mirror
 * this estate keeps paying for (see the header).
 *
 * ⚠ IT IS NOT A PROVENANCE CLAIM. "Nobody has confirmed it" is a weaker and
 * different statement from "Olumi wrote it" — the predicate joins a value the
 * producer invented with a value that arrived carrying no source at all, and
 * separates neither by author. Any surface tempted to render this as a
 * whose-value-is-this badge is reading it wrong.
 */
export const UNCONFIRMED_ESTIMATE_LABEL = 'Estimate not yet confirmed'

/**
 * The goal node, as a user reads it.
 *
 * ⚠ WHY THIS EXISTS NOW. `ghostTiers` needs to name the KIND of node a model's
 * subject came from, because the frontier's prompt used to call every subject a
 * "decision" — including a subject read off a GOAL node, in a sentence that
 * lands in the user's own transcript under the user's own name. Naming the kind
 * means spelling its word, and this file is where a product word is spelled.
 *
 * ⚠ IT IS NOT YET THE ONLY SPELLING, and saying so is the point. Three surfaces
 * still carry a bare `'Goal'` literal — `NODE_REGISTRY` (`domain/nodes.ts`),
 * `getTypeLabel` (`inspector-v2/inspectorStrings.ts`) and `KIND_LABEL`
 * (`model-tab-v2/rowPresentation.ts`) — exactly as nine surfaces carried
 * `'Decision'` before the header above was written. Rewiring them is a separate
 * change with its own review; what this constant buys today is that the fourth
 * reader does not add a fourth loose literal.
 */
export const GOAL_NODE_LABEL = 'Goal'
