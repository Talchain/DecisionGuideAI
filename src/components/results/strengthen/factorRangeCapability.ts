/**
 * ⭐⭐ CAN A RANGE ACTUALLY BE SET FOR THIS FACTOR? — asked once, here, because
 * a coaching card was answering "yes" for every factor and it is true for
 * roughly one in seven.
 *
 * ── THE DEFECT THIS CLOSES, MEASURED ───────────────────────────────────────
 * `strengthen:lehi` shipped titled *"Give {factor} a realistic range"* with a
 * button labelled **"Set a range"**, over a `canvas-focus` route that selects
 * the node and moves the camera. For most factors there is no range editor at
 * the end of it — on any surface.
 *
 * ── WHERE A RANGE CAN BE SET, DERIVED AT THE BYTES ─────────────────────────
 *   · canvas inspector → `InspectorRouter` → **`FactorExternalPanel`** →
 *     quick-set buttons → `setPriorRange` → `prior_range_edit`, which
 *     `mutationAuthority` classes `server_fact`. **3 call sites.**
 *   · `InspectorRouter` sends every OTHER category to `factor-controllable`,
 *     which has **0** `setPriorRange` call sites.
 *   · all of `model-tab-v2` (19 non-test files): **0**. Its `proposePriorRange`
 *     contract is declared once and has **zero implementations** — a paper
 *     contract, and NOT the same thing as the inspector's live emitter.
 *
 * So the capability is gated on `category === 'external'`, and
 * `canvas/nodes/shared/factorPriorRange.ts` already states the same rule from
 * the other side: *"`data.category` — only `'external'` factors carry a
 * displayable prior."* This agrees with that authority rather than minting a
 * second one.
 *
 * ⚠ AND THE RECORD SAID THE OPPOSITE. Four files asserted *"no range editor is
 * reachable anywhere in the product"* — false since 10 Sep 2026 by **nine
 * minutes** (#1454 landed 22:19:53, the claim 22:28:39, and #1515 copied it two
 * days later). Corrected separately; noted here because it is why this card
 * went unexamined for eleven days and why two sessions re-derived the
 * capability from scratch.
 *
 * ⛔ THE NAME IS THE QUESTION, NOT THE IMPLEMENTATION. The engine must not
 * learn what a canvas `category` is; it asks whether an act exists. If the
 * capability ever moves — a range editor for controllable factors, a Model-tab
 * implementation of `proposePriorRange` — one predicate changes and every
 * caller follows. (CLAUDE.md trap 21: name the question.)
 */

import { useCanvasStore } from '../../../canvas/store'

/** The one category whose factors have a reachable range editor. */
const CATEGORY_WITH_A_RANGE_EDITOR = 'external'

/**
 * ⛔ FAILS CLOSED. An unknown or missing category answers `false`, so a caller
 * never promises the act on a factor it could not resolve. A wrongly-named act
 * spends the trust the finding just earned; an unnamed one costs only wording.
 */
export function rangeIsSettableForCategory(category: unknown): boolean {
  return category === CATEGORY_WITH_A_RANGE_EDITOR
}

/**
 * ⚠ A NON-REACTIVE READ, DELIBERATELY, AND THE REASON IS BOTH CORRECTNESS AND
 * COST.
 *
 * COST: the two builders that call this are mirrored and deep-equalled by
 * `strengthenInputsMirror.drift.spec.tsx`. Giving each a `nodes` SUBSCRIPTION
 * would re-render both panels on every node drag — the hazard
 * `FactorValueControl` records in its own docblock — to track a field that only
 * changes on a structural graph edit.
 *
 * CORRECTNESS: both builders read the same store at the same instant, so they
 * cannot disagree about a factor's category. A subscription in one and not the
 * other is precisely the divergence that spec exists to catch.
 *
 * ⚠ A category change IS a graph edit, which invalidates the analysis and
 * rebuilds these inputs, so there is no state in which a stale answer survives
 * a run the reader is looking at.
 */
export function factorCategoryOf(nodeId: string): unknown {
  if (nodeId.length === 0) return undefined
  const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
  return (node?.data as { category?: unknown } | undefined)?.category
}

/** The two composed, which is how both builders should ask. */
export function rangeIsSettableForFactor(nodeId: string): boolean {
  return rangeIsSettableForCategory(factorCategoryOf(nodeId))
}
