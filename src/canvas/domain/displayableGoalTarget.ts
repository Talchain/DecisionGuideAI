/**
 * ⛔⛔⛔ SUPERSEDED — `domain/goalTarget.ts` OWNED THIS QUESTION FIRST.
 *
 * This module was written for #1844 under the docblock below, which claims to be
 * "the ONE owner" of *"is there a target worth stating"*. It is not, and it never
 * was: `domain/goalTarget.ts` exports `resolveGoalTarget()`, documented as
 * returning "the figure, in the USER's units. Never a normalised 0-1", and
 * `GoalNode` — the goal CARD — has been using it all along. So #1844 created a
 * SECOND owner of one question: the hand-maintained mirror (CLAUDE.md trap 12),
 * committed by the very change that cites it. Found 22 Sep 2026 while checking
 * whether the card and the panel disagreed.
 *
 * `resolveGoalTarget` is also strictly better in ways that show on screen:
 *   · it prefers the reader's own `success_threshold` when
 *     `threshold_source === 'user'`, falling back to CEE's `goal_threshold_raw`.
 *     THIS MODULE KNOWS NOTHING OF `success_threshold`, so a surface using it
 *     shows CEE's figure back to someone who has just typed their own.
 *   · it returns `source: 'user' | 'unrecorded'` (was `'brief'` for any CEE
 *     raw until DESIGN-GAP-v31 #22 — an origin no carried field states), and
 *     those "are different claims about authorship".
 *   · it rejects a blank string, which `goal_threshold_raw` can be.
 *
 * ⛔ DO NOT ADD A CONSUMER. `inspector-v2/panels/GoalPanel.tsx` was moved off it
 * on 22 Sep. The only remaining importer is `ui/NodeInspector.tsx`, which has NO
 * REACHABLE RENDER SITE (`InspectorModal.tsx:160` returns unconditionally under
 * the module literal `const USE_INSPECTOR_V2 = true`, above that file's only
 * `<NodeInspector>` at `:226`; `PropertiesPanel` has zero non-test importers).
 *
 * ⭐ IT IS KEPT, NOT DELETED, FOR ONE REASON: its spec
 * `__tests__/aConstantIsNotATarget.spec.ts` carries the 989-bundle measurement
 * that motivated the whole line of work — 0.8 in 42 of 54, `cap/raw === 1.25` in
 * 18 of 18 — and that evidence should not be thrown away with the code. Removing
 * both, and folding the measurement into `goalTarget.ts`, is rowed.
 */

/**
 * ⭐⭐⭐ A CONSTANT IS NOT A TARGET.
 *
 * ## The measurement, and it is the whole reason this module exists
 *
 * Across **989 debug bundles** (contrast control: 209 carry `analysis_ready`, so
 * the probe can see the field), **54** carry a `goal_threshold`:
 *
 *   · `goal_threshold === 0.8` in **42 of 54**
 *   · every one of the **18** that also carry a cap has `cap / raw === 1.25`
 *     EXACTLY — targets as far apart as 20,000 (cap 25,000) and 1,300,000
 *     (cap 1,625,000), different units, identical ratio
 *   · 13 of those name the mechanism: `goal_threshold_cap_provenance:
 *     "target_derived_headroom"`
 *
 * The cap is derived FROM the target, so the normalised threshold is
 * `target / (target * 1.25) = 0.8` **by construction, for every decision.**
 *
 * ⛔ **A number that cannot vary carries no information**, and the product was
 * rendering it as a percentage beside a tick, where it reads as confidence. The
 * founder's own capture (21 Sep 2026) shows the result: a Goal panel displaying
 * **"✓ 80%"** directly above the sentence *"Adding a specific target unlocks
 * probability calculations"*, on a card badged **"Target not captured"**.
 *
 * ## Why it is a module and not another panel guard
 *
 * `GoalPanel` already guards this, and says in writing that its guard is
 * panel-only and NOT an estate-wide invariant, naming the exposure:
 *
 *   · `NodeInspector` (legacy inspector target line)
 *   · `SuccessTargetRow` — 0 references to the representation tag
 *   · `RangeVisualization`, via `effectiveGoalThreshold`
 *     (`useResultsSectionData.ts` — 0 references to the tag)
 *
 * Three readers of one scalar with no tag check is the hand-maintained mirror
 * this estate keeps paying for (CLAUDE.md trap 12). One owner, four readers.
 *
 * ## What it decides, precisely
 *
 * A normalised threshold is displayable ONLY when a raw anchor exists to
 * un-normalise it against. Without the raw, `0.8` is the constant above and the
 * honest screen shows **no target** — which also makes the card and the panel
 * agree, since the card reads the node and reports no target.
 *
 * ⚠ THIS DOES NOT WITHHOLD A REAL TARGET. A `raw` representation is returned
 * unchanged with its unit; that is a number the user or the producer actually
 * stated. The only thing withheld is a normalised magnitude with nothing to
 * anchor it — the case that is 0.8 every time.
 */

export type GoalThresholdRepresentation = 'raw' | 'normalised' | null

export interface DisplayableGoalTargetInput {
  /** `store.goalThreshold` — may be raw or normalised; the tag below says which. */
  readonly goalThreshold: number | null | undefined
  /** `store.goalThresholdRepresentation`. */
  readonly representation: GoalThresholdRepresentation
  /** The producer's raw anchor, when it sent one. */
  readonly thresholdRaw?: number | string | null
  /** The producer's unit for the raw anchor. */
  readonly thresholdUnit?: string | null
}

export interface DisplayableGoalTarget {
  readonly value: number
  /** `null` when no unit may honestly be attached to this magnitude. */
  readonly unit: string | null
}

/** Does a usable raw anchor exist? A blank string and a non-finite number do not count. */
function hasRawAnchor(raw: number | string | null | undefined): boolean {
  if (typeof raw === 'number') return Number.isFinite(raw)
  if (typeof raw === 'string') return raw.trim() !== '' && Number.isFinite(Number(raw))
  return false
}

/**
 * The target a reader may show, or `null` when the product has none worth
 * stating. Every reader of `store.goalThreshold` goes through here.
 */
export function resolveDisplayableGoalTarget(
  input: DisplayableGoalTargetInput,
): DisplayableGoalTarget | null {
  const { goalThreshold, representation, thresholdRaw, thresholdUnit } = input
  if (typeof goalThreshold !== 'number' || !Number.isFinite(goalThreshold)) return null

  if (representation === 'normalised') {
    // ⛔ THE CONSTANT. No raw anchor means this magnitude is `target / (target *
    // 1.25)` and is 0.8 whatever the decision. Withhold it rather than paint it.
    if (!hasRawAnchor(thresholdRaw)) return null
    // ⭐⭐ WITH AN ANCHOR, SHOW THE ANCHOR — corrected 22 Sep 2026 by CEE, which
    // measured the seam and answered this module's own ask. `goal_threshold_raw`
    // and `goal_threshold_unit` are declared in the `analysis_ready` schema and
    // ship on 24 of 24 goal-threshold-bearing nodes; the schema's comment
    // instructs exactly this: "Render the user's figure from `goal_threshold_raw`
    // + `goal_threshold_unit`."
    //
    // ⛔ This module previously returned `{ value: goalThreshold, unit: null }`
    // here — the worst available answer. It painted the 0.8 constant this file
    // exists to suppress AND dropped the unit, so the screen showed a meaningless
    // magnitude wearing no label at all. The "≥ 0.8 £" defect `GoalPanel`
    // documents is cured by dropping the NORMALISED MAGNITUDE, not the unit: the
    // unit was always honest, it simply never described that number.
    return { value: Number(thresholdRaw), unit: thresholdUnit ?? null }
  }

  // A raw representation is a number somebody actually stated. Show it, with
  // its unit when one was sent.
  return { value: goalThreshold, unit: thresholdUnit ?? null }
}
