/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE TWO INVITATIONS THAT RESOLVE A WITHHELD GOAL CHANCE (DL 0df0e1 #87 6006078553: both are
 * required; Wording c6 6 Oct; CEE `goal-chance-gate.ts`).
 *
 * ⛔ THE UI RENDERS IT; IT DOES NOT DECIDE IT (`theUiRendersItDoesNotDecide`). CEE withholds each option's chance of meeting
 * the goal when the goal states no target (`GOAL_FIGURES_NO_STATED_TARGET`) or a target with no direction
 * (`GOAL_FIGURES_PROBABILITY_UNUSABLE`, cause `no_stated_direction`), and writes the invitation that resolves it on that
 * same record as `invite`. This module only READS that `invite` by its `kind` and checks its shape; absent or malformed
 * is `null`, and nothing renders.
 */

export const GOAL_FIGURES_PROBABILITY_UNUSABLE = 'GOAL_FIGURES_PROBABILITY_UNUSABLE'
export const GOAL_FIGURES_NO_STATED_TARGET = 'GOAL_FIGURES_NO_STATED_TARGET'

export type GoalChanceInvite =
  /** The goal's target figure holds no comparator: offer "at least / at most {target}". */
  | { readonly kind: 'state_goal_direction'; readonly goalNodeId: string; readonly value: number; readonly unit: string }
  /** The goal states no target: offer the existing target door. */
  | { readonly kind: 'state_goal_target'; readonly goalNodeId: string }

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The one invitation the Run's withhold records carry, read verbatim; `null` when there is none, or more than one. */
export function readGoalChanceInvite(inferenceWarnings: unknown): GoalChanceInvite | null {
  if (!Array.isArray(inferenceWarnings)) return null
  const invites = inferenceWarnings
    .filter((w): w is Record<string, unknown> => isRec(w) && isRec(w.invite)
      && (w.code === GOAL_FIGURES_PROBABILITY_UNUSABLE || w.code === GOAL_FIGURES_NO_STATED_TARGET))
  if (invites.length !== 1) return null
  const w = invites[0]
  const invite = w.invite as Record<string, unknown>
  const goalNodeId = invite.goal_node_id
  if (typeof goalNodeId !== 'string' || goalNodeId.length === 0) return null
  if (w.code === GOAL_FIGURES_PROBABILITY_UNUSABLE && invite.kind === 'state_goal_direction') {
    const target = invite.target
    if (!isRec(target) || typeof target.value !== 'number' || !Number.isFinite(target.value) || target.value < 0
      || typeof target.unit !== 'string' || target.unit.trim() === '') return null
    return { kind: 'state_goal_direction', goalNodeId, value: target.value, unit: target.unit }
  }
  if (w.code === GOAL_FIGURES_NO_STATED_TARGET && invite.kind === 'state_goal_target') {
    return { kind: 'state_goal_target', goalNodeId }
  }
  return null
}

/**
 * ⭐ D3 STEP 2 — THE TWO INVITATIONS (DL 0df0e1 #87 6006078553: both required; Wording c6 6 Oct). Each is SELECTED by the
 * `invite.kind` CEE wrote on its own withhold record (`readGoalChanceInvite`, by identity) — the UI decides nothing.
 */
export const GOAL_CHANCE_INVITE = {
  /** `state_goal_direction`: the target figure holds no comparator. `target` is the figure as stated ("400 tickets"). */
  direction: (target: string): string =>
    `Olumi can’t yet say how likely each option is to meet your goal: it doesn’t say whether you need at least ${target} or at most ${target}. Choose one and re-run, and Olumi can say.`,
  atLeast: (target: string): string => `At least ${target}`,
  atMost: (target: string): string => `At most ${target}`,
  /** `state_goal_target`: the goal states no target. `goal` absent → "your goal", unquoted (c6). */
  target: (goal: string | null): string =>
    goal === null
      ? 'Give your goal a target to see each option’s chance of meeting it.'
      : `Give ‘${goal}’ a target to see each option’s chance of meeting it.`,
} as const
