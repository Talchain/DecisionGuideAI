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
    rows.push({
      id: node.id,
      label: typeof data?.label === 'string' ? data.label : node.id,
      probability: decision.goalProbability,
      isSubstitutedJoint: decision.basis === 'joint_goal_substituted',
      modelledBasis: decision.goalFitIsModelledBasis,
    })
  }
  return rows
}
