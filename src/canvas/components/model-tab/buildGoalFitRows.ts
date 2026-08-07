/**
 * buildGoalFitRows — per-option goal-fit rows for the Model tab's goal card
 * (journey-walk 2026-08-03 §10.4 tab-parity: goal probability rendered on the
 * Analysis tab only; the report data was already in ModelTabBody's hands).
 *
 * Discipline, matching the Analysis-tab surfaces exactly:
 *  · ONE chooser — every figure resolves through `selectGoalProbability`
 *    (the claim-ownership registered owner of goal_probability /
 *    probability_of_goal / probability_of_joint_goal). This module never
 *    reads those fields itself; it hands each `option_probabilities` entry
 *    to the owner and reads the decision.
 *  · Complete-field rule (the V7 goal lens / OptionCards "Hits target"
 *    gate): rows are returned ONLY when every option node has an admissible
 *    figure. A partial list would be a ranking over a subset presented as a
 *    ranking over the options — return null instead and render nothing.
 *  · Producer order preserved — rows follow the caller's option order; no
 *    re-sorting, no winner designation minted here.
 */

import type { Node } from '@xyflow/react'
import {
  selectGoalProbability,
  type GoalProbabilityInput,
} from '../../../components/results/utils/selectGoalProbability'

export interface GoalFitRow {
  id: string
  label: string
  /** The chosen producer probability in [0,1] — see `selectGoalProbability`. */
  probability: number
  /** Possessive gate: basis 'joint_goal_substituted' withholds "your goal". */
  isSubstitutedJoint: boolean
  /** Doctrine B: `GOAL_FIT_BASIS_CAVEAT_COPY` must render adjacent when true. */
  modelledBasis: boolean
  /**
   * ⭐ ROADMAP 2.334 — the Monte-Carlo sample count behind `probability`,
   * or `null` when the producer did not supply one.
   *
   * This is what makes the rows READABLE. Without it every sub-1% figure
   * renders as the register floor "< 1%", so the walk's run printed five
   * identical strings over five different numbers: the ordering was correct,
   * sourced and completely invisible, and the status-quo-lowest signature
   * could not be seen at all. The count was on the wire the entire time —
   * this builder simply did not carry it.
   *
   * `null` is meaningful and must NOT be defaulted: absent ≠ zero, and
   * absent ≠ "assume 10000". A run without a count falls back to the floor,
   * which understates rather than inventing a resolution the sampler never
   * had.
   */
  nValidSamples: number | null
}

/**
 * The response mapper's guard, applied at this seam too rather than trusted
 * from upstream (`adapters/plot/v2/responseMapper.ts` uses the same rule on
 * the same field). A zero count would make the display resolution `1/0`, and
 * a fractional one is not a sample count at all — both are rejected to the
 * floor arm rather than propagated into a precision claim.
 */
function positiveIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function buildGoalFitRows(
  optionNodes: ReadonlyArray<Node>,
  optionProbabilities: Record<string, unknown> | null | undefined,
): GoalFitRow[] | null {
  if (!optionProbabilities || optionNodes.length === 0) return null
  const rows: GoalFitRow[] = []
  for (const node of optionNodes) {
    const entry = optionProbabilities[node.id]
    if (!entry || typeof entry !== 'object') return null
    const decision = selectGoalProbability(entry as GoalProbabilityInput)
    if (decision.goalProbability == null) return null
    const data = node.data as Record<string, unknown> | undefined
    // Read straight off the producer entry this row was scored from, so the
    // count and the probability cannot come from different options.
    const outcome = (entry as { outcome?: Record<string, unknown> }).outcome
    rows.push({
      id: node.id,
      label: typeof data?.label === 'string' ? data.label : node.id,
      probability: decision.goalProbability,
      // ⭐ L62: always false — the row only exists when a number survived line
      // 75, and every surviving number earns the possessive now that the joint
      // substitution is withheld at source. Read off the owner's permission,
      // never a basis literal.
      isSubstitutedJoint: !decision.mayUsePossessiveGoalFraming,
      modelledBasis: decision.goalFitIsModelledBasis,
      nValidSamples: positiveIntegerOrNull(outcome?.n_valid_samples),
    })
  }
  return rows
}
