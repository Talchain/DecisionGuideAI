/**
 * buildV7Guidance — pure passthrough builder for the V7 L6 guidance list +
 * held-proposal card (V6-RESPEC-2026-07-23 rows 8/9/10).
 *
 * PASSTHROUGH ONLY. It reads the guidance store's `guidanceItems` and does two
 * things, both without inventing a value:
 *
 *   1. SPLIT. `approve_patch` items are the analysis-panel's held proposals
 *      (spec row 10). By the established single-owner doctrine (GuidanceStrip's
 *      approve_patch handler SCROLLS to the conversation GraphPatchBlock — the
 *      one live confirm — it never applies), an approve_patch guidance item is
 *      a POINTER to that owner, never a confirm surface. So we promote them to
 *      the held-proposal card and EXCLUDE them from the guidance list: exactly
 *      one L6 surface per proposal, and no second confirm anywhere (the hard
 *      invariant; UI PR #424).
 *
 *   2. ORDER. The remaining guidance items are ordered by the store's ONE
 *      canonical comparator, `compareGuidanceDisplayOrder` (category severity
 *      major → producer `priorityRank` ascending → coarse `priority`
 *      descending). We never hand-roll a priority sort — that is exactly how
 *      the UI-SEM-085 `100 - rank` inversion happened. The source array is
 *      sliced before sorting so the shared store array is never mutated.
 *
 * The per-item affordance (spec row 9) is derived here as a discriminated kind
 * so the component renders each action type's HONEST affordance and an unknown
 * action type renders NONE (fail closed, no guessing).
 */

import {
  compareGuidanceDisplayOrder,
  type GuidanceItem,
} from '../../../canvas/stores/guidanceStore'

/** The affordance a guidance item's `primary_action` maps to (spec row 9). */
export type V7GuidanceAffordance =
  /** open_inspector → Focus the target node on canvas. */
  | { kind: 'focus'; nodeId: string; field?: string }
  /** discuss → open the work-through drawer with the producer prompt. */
  | { kind: 'work_through'; prompt: string }
  /** run_exercise → send the exercise command (pre-mortem etc.). */
  | { kind: 'run_exercise'; exercise: string }
  /** Unknown / navigate / approve_patch (promoted) → no affordance. */
  | { kind: 'none' }

export interface V7GuidanceModel {
  /** approve_patch items — rendered as held-proposal cards (row 10). */
  heldProposals: GuidanceItem[]
  /** Everything else, ordered by the canonical display-order doctrine. */
  guidance: GuidanceItem[]
}

const isApprovePatch = (i: GuidanceItem): boolean => i.primary_action?.type === 'approve_patch'

/**
 * Map a guidance item's `primary_action` to its honest affordance. Only the
 * four action types the spec names (row 9) render an affordance; `navigate`,
 * `approve_patch` (promoted to the card), and any UNKNOWN type fall through to
 * `none` — the fail-closed default, never a guessed control.
 */
export function deriveGuidanceAffordance(item: GuidanceItem): V7GuidanceAffordance {
  const action = item.primary_action
  if (!action || typeof action.type !== 'string') return { kind: 'none' }
  switch (action.type) {
    case 'open_inspector':
      return typeof action.node_id === 'string' && action.node_id.length > 0
        ? { kind: 'focus', nodeId: action.node_id, field: action.field }
        : { kind: 'none' }
    case 'discuss':
      return typeof action.prompt === 'string' && action.prompt.trim().length > 0
        ? { kind: 'work_through', prompt: action.prompt }
        : { kind: 'none' }
    case 'run_exercise':
      return typeof action.exercise === 'string' && action.exercise.length > 0
        ? { kind: 'run_exercise', exercise: action.exercise }
        : { kind: 'none' }
    // 'approve_patch' is promoted to the held-proposal card; 'navigate' and any
    // unknown/future action type render no affordance (fail closed).
    default:
      return { kind: 'none' }
  }
}

export function buildV7Guidance(items: readonly GuidanceItem[] = []): V7GuidanceModel {
  const list = Array.isArray(items) ? items : []
  const heldProposals = list.filter(isApprovePatch)
  const guidance = list
    .filter((i) => !isApprovePatch(i))
    .slice()
    .sort(compareGuidanceDisplayOrder)
  return { heldProposals, guidance }
}
