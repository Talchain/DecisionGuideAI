import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import type { GoalCertaintyEntry } from '../canvas/state/storedGoalCertainty'
import type { OptionParticipationEntry } from '../canvas/state/storedOptionParticipation'

type RunReceipt = {
  identity: { scenario_id: string; computed_against_hash: string; computed_at: string } | null
  goal_certainty?: readonly GoalCertaintyEntry[] | null
  option_participation?: readonly OptionParticipationEntry[] | null
}

/** Keep the wire Run identity and validated permission beside the report.
 * The block-content hash remains unchanged: it identifies content, not a Run.
 */
export function withAnalysisRunReceipt<T extends object>(report: T, input: {
  scenarioId?: string | null
  block: { computed_against_hash?: unknown }
  state?: AnalysisStateV1 | null
  goalCertainty?: readonly GoalCertaintyEntry[] | null
  optionParticipation?: readonly OptionParticipationEntry[] | null
}): T & { v5_run_receipt: RunReceipt } {
  const state = input.state?.run_state
  const computedAt = state && 'computed_at' in state ? state.computed_at : undefined
  const hash = input.block.computed_against_hash
  return { ...report, v5_run_receipt: {
    identity: input.scenarioId && typeof hash === 'string' && hash !== ''
      && typeof computedAt === 'string' && computedAt !== ''
      ? { scenario_id: input.scenarioId, computed_against_hash: hash, computed_at: computedAt } : null,
    ...(input.goalCertainty !== undefined ? { goal_certainty: input.goalCertainty } : {}),
    ...(input.optionParticipation !== undefined ? { option_participation: input.optionParticipation } : {}),
  } }
}

/** Missing held metadata cannot attest that the permission on screen is equal. */
export function sameAnalysisRunReceipt(held: unknown, next: { v5_run_receipt: RunReceipt }): boolean {
  if (!held || typeof held !== 'object' || !('v5_run_receipt' in held)) return false
  return JSON.stringify(held.v5_run_receipt) === JSON.stringify(next.v5_run_receipt)
}

/** A permission update alone must not clear a user's local dirty overlay. */
export function differentKnownAnalysisRun(held: unknown, next: { v5_run_receipt: RunReceipt }): boolean {
  if (!held || typeof held !== 'object' || !('v5_run_receipt' in held)) return false
  const receipt = held.v5_run_receipt as RunReceipt | null | undefined
  return Boolean(receipt?.identity && next.v5_run_receipt.identity
    && JSON.stringify(receipt.identity) !== JSON.stringify(next.v5_run_receipt.identity))
}
