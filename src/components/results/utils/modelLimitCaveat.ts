/**
 * modelLimitCaveat — the single honest caveat about what a model can and
 * cannot tell you.
 *
 * LIFTED OUT OF `v7/v7GuidanceCopy.ts` when the V7 fork and its "Alt view"
 * dock tab were retired. It moved rather than died because its consumer is
 * NOT part of that fork: `coaching/AskOlumiDrawer` renders it on EVERY tab,
 * so deleting `v7/` with this sentence still inside it would have taken a
 * live, always-mounted surface down with the fork.
 *
 * It was renamed off the `V7_` prefix at the same time: a symbol whose name
 * points at a deleted fork tells the next reader to go looking for a
 * directory that is not there.
 *
 * The rest of `v7GuidanceCopy` (the `V7_GUIDANCE_COPY` block — guidance list,
 * held-proposal card and bias-section copy) was consumed ONLY by v7 components
 * and was deleted with them. It is deliberately not carried here: lifting copy
 * that has no consumer would just relocate dead weight.
 *
 * Copy only — no thresholds, no data, no inference lives here.
 * British English, sentence case, no all-caps, no em dashes in prose.
 */

/**
 * The single model-limit caveat.
 *
 * Historically kept byte-identical with the sentence `V7SharpenLine` shipped,
 * so the two honest-caveat surfaces read as one voice. `V7SharpenLine` is now
 * deleted, leaving `AskOlumiDrawer` as the sole consumer — but the wording is
 * unchanged on purpose. It is a claim a user has already seen, and this
 * retirement is not the place to restate it.
 */
export const MODEL_LIMIT_CAVEAT =
  'Olumi can point to what the model implies, but not guarantee the real world behaves the same.'
