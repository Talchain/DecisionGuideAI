/**
 * fitTargets — which nodes a whole-graph `fitView` is allowed to frame.
 *
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` §5.1 / step 2: exclude the
 * `__ghost-option__` placeholder from every whole-graph fit.
 *
 * ⚠ PRICED HONESTLY, because the brief that commissioned this priced it wrong.
 * The ghost is NOT free width nobody is taking. Three lanes measured its cost at
 * 220, 76, 60, 32 and **zero** flow units on different models, and the
 * load-bearing correction is that the two models where it costs width are
 * HEIGHT-bound — so removing it changes their fit zoom by nothing. On the
 * measured corpus it adds 9% to the width of one starter (vendor-selection,
 * 820 → 896 units) whose fit verdict has ~5% of headroom. So: one line, honest,
 * costless, and **not a win to bank**. It stops a UI affordance from being
 * framed as though it were part of the user's model.
 *
 * ⭐ S4 (24 Sep 2026) REVERSES THIS FOR THE LANDING FIT, BY RULING. Experience
 * Design: the row-end prompts "count inside the row budget" and "the WHOLE graph
 * (all rows plus the prompt cards) is visible at landing". So the landing fit
 * reads `fitFrameNodes` (below), which keeps the four row-end prompts, while
 * every COUNT keeps `excludeNonModelNodes`. The user-initiated fits
 * (`ReactFlowGraph.handleFitView`, the palette's Zoom to Fit, Show whole model)
 * still frame the model alone — a follow-up for the lanes that own them.
 */

/**
 * The prefix every frontier affordance's id carries, spelled ONCE for the whole
 * codebase — and this file is where it lives because this file owns exclusion.
 *
 * ⚠ IT WAS SPELLED THREE TIMES, WHICH IS HOW IT DRIFTED. `ghostTiers.ts` kept
 * its own `GHOST_ID_PREFIX` and a SECOND `export const GHOST_OPTION_NODE_ID`
 * with the same value, under a comment here claiming the id was "spelled ONCE
 * for the whole codebase" — a hand-maintained mirror inside the sentence
 * denying there was one. Meanwhile `excludeNonModelNodes` matched a bare
 * `'__ghost-'` literal, so nothing tied the filter to the ids it was filtering.
 */
export const GHOST_ID_PREFIX = '__ghost-'

/** The options affordance's id. */
export const GHOST_OPTION_NODE_ID = `${GHOST_ID_PREFIX}option__`

/**
 * Is this a frontier affordance rather than part of the user's model?
 *
 * The one predicate. `excludeNonModelNodes` is its filter form; the
 * `ModelExtentNotice` count and the e2e geometry measures resolve to it too, so
 * "the model" cannot mean three different sets in three places.
 */
export function isGhostNode(id: string): boolean {
  return id.startsWith(GHOST_ID_PREFIX)
}

/**
 * Drop UI placeholders from a fit target list.
 *
 * Generic over the node shape so it serves both `Node[]` from the store and
 * ReactFlow's `getNodes()` without either caller casting.
 */
export function excludeNonModelNodes<T extends { id: string }>(nodes: readonly T[]): T[] {
  // ⚠ PREFIX, NOT ONE ID. The frontier affordance now exists on every tier,
  // and an exclusion keyed on a single id silently stops excluding the moment a
  // second one is added — the hand-maintained-mirror defect, in a filter.
  return nodes.filter((n) => !isGhostNode(n.id))
}

/**
 * ⭐⭐ THE ROW-END PROMPTS, BY ID — the four frontier affordances S4 restored to
 * the end of each family's row (Experience Design, #63 5806207128 / 5806266691).
 * Spelled from the one prefix, never restated.
 */
export const ROW_END_PROMPT_IDS: ReadonlySet<string> = new Set(
  // v3.1 WS1 #27: + the consequence row's ONE shared door (outcomes AND risks,
  // one prompt per row — `ghostTiers` `CONSEQUENCE_DOOR_ID`, spelled from here).
  ['option', 'factor', 'outcome', 'risk', 'consequence'].map((kind) => `${GHOST_ID_PREFIX}${kind}__`),
)

/** The consequence row's shared door (v3.1 WS1 #27). */
export const CONSEQUENCE_PROMPT_ID = `${GHOST_ID_PREFIX}consequence__`

/** Is this id a row-end reasoning prompt (and so part of the landing frame)? */
export function isRowEndPromptId(id: string): boolean {
  return ROW_END_PROMPT_IDS.has(id)
}

/**
 * ⭐⭐ WHAT THE LANDING FIT FRAMES: the model AND its row-end prompts.
 *
 * NODE-ANATOMY-v32 L4 / ED S4: "the WHOLE graph (all rows plus the prompt cards)
 * is visible at landing" and the prompts "count inside the row budget". Before
 * S4 the fit framed the model alone, and the prompts — attached to each row's
 * right-most card — landed under the dock (FIT-DIAGNOSIS-20260924 §2: the option
 * door at 1042–1122px against a dock edge at 1012).
 *
 * ⚠ THIS IS NOT `excludeNonModelNodes`, AND THE TWO MUST NOT BE MERGED. The fit
 * is a question about what the user should SEE; a count is a question about
 * what the model CONTAINS. A prompt belongs in the first and never in the
 * second — `ModelExtentNotice`'s "Showing X of Y" still reads the model-only
 * list. A ghost that is not a row-end prompt (none exists today) stays out.
 */
export function fitFrameNodes<T extends { id: string }>(nodes: readonly T[]): T[] {
  return nodes.filter((n) => !isGhostNode(n.id) || isRowEndPromptId(n.id))
}

/**
 * ⭐ WHAT A USER-INVOKED FIT FRAMES — the same set as the landing fit (S5,
 * 24 Sep 2026). The toolbar's "Fit to view", the palette's "Zoom to Fit" and
 * the extent notice's "Show whole model" framed `excludeNonModelNodes`, which
 * drops the row-end prompts, so the prompts fell outside the frame — measured
 * under the Olumi dock at 1440×900. An empty model frames nothing, so the
 * caller falls back to every node, as the landing fit does.
 */
export function userFitNodes<T extends { id: string }>(nodes: readonly T[]): T[] {
  return excludeNonModelNodes(nodes).length > 0 ? fitFrameNodes(nodes) : []
}
