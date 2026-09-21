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
    // With an anchor the magnitude is still on the NORMALISED scale, so the
    // producer's unit describes the raw and must not be pinned to it — the
    // "≥ 0.8 £" defect `GoalPanel` already documents.
    return { value: goalThreshold, unit: null }
  }

  // A raw representation is a number somebody actually stated. Show it, with
  // its unit when one was sent.
  return { value: goalThreshold, unit: thresholdUnit ?? null }
}
