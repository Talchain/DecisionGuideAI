/**
 * B5 — THE PER-LIMIT AND JOINT VERDICTS, AS THE UI HOLDS THEM (27 Sep 2026).
 *
 * The carrier is a top-level `limit_verdicts: { per_limit, joint }` on the turn
 * (Model Generation #70 5858360249; Canonical rules the name, 0.61.0). Until the UI
 * vendors that release the key rides the `__additive__` sidecar, so it is read from
 * EITHER place. The member shapes are 0.60.0's own (`ConstraintVerdictSchema.shape`),
 * never a hand copy: an invalid row is dropped, never repaired.
 *
 * ⚠ ABSENCE IS NOT A VERDICT. No `limit_verdicts` means none was attested; it is never
 * defaulted to scored (MG's absence rule). And, like `run_delta`, a block is bound to
 * the analysis it arrived beside and read only while that analysis is on screen.
 */
import { ConstraintVerdictSchema } from '@talchain/schemas/orchestrator'
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'
import type { CEEGoalConstraint } from '../../adapters/cee/types'

const PerLimitSchema = ConstraintVerdictSchema.shape.per_limit.unwrap().element
const JointSchema = ConstraintVerdictSchema.shape.joint.unwrap()

export type PerLimitVerdictState = 'scored' | 'estimate_only' | 'unscored'
export interface PerLimitVerdict {
  readonly constraintId: string
  readonly state: PerLimitVerdictState
  readonly reason: string | null
}
export interface JointLimitVerdict {
  readonly state: 'scored' | 'estimate_only' | 'withheld'
  readonly withheldReason: string | null
  readonly constraintIds: readonly string[]
}
export interface LimitVerdicts {
  readonly perLimit: readonly PerLimitVerdict[]
  readonly joint: JointLimitVerdict | null
}
/** What the applicator hands the store: the verdicts and the analysis they came beside. */
export interface LimitVerdictsWrite {
  readonly verdicts: LimitVerdicts
  readonly analysisHash: string
  readonly scenarioId: string | null
}
/**
 * As the store holds them: plus the user's limits AS THEY STOOD when the verdicts
 * arrived. A limit edited in place keeps its constraint id and the analysis hash does
 * not move, so without this a verdict about £50,000 would sit beside £20,000.
 */
export interface StoredLimitVerdicts extends LimitVerdictsWrite {
  readonly goalConstraintsAtRun: readonly CEEGoalConstraint[] | null
}

/** The block from a parsed turn: top level first, then the additive sidecar. */
export function limitVerdictsFromResponse(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const top = (response as { limit_verdicts?: unknown }).limit_verdicts
  if (top !== undefined) return top
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as
    | { limit_verdicts?: unknown }
    | undefined
  return additive?.limit_verdicts
}

/** Parse the block. `null` = nothing attested (absent, or nothing valid in it). */
export function readLimitVerdicts(raw: unknown): LimitVerdicts | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const block = raw as { per_limit?: unknown; joint?: unknown }
  const perLimit: PerLimitVerdict[] = []
  if (Array.isArray(block.per_limit)) {
    for (const row of block.per_limit) {
      const parsed = PerLimitSchema.safeParse(row)
      if (!parsed.success) continue
      perLimit.push({ constraintId: parsed.data.constraint_id, state: parsed.data.state, reason: parsed.data.reason ?? null })
    }
  }
  const jointParsed = block.joint === undefined ? null : JointSchema.safeParse(block.joint)
  const joint =
    jointParsed && jointParsed.success
      ? {
          state: jointParsed.data.state,
          withheldReason: jointParsed.data.withheld_reason ?? null,
          constraintIds: jointParsed.data.constraint_ids ?? [],
        }
      : null
  if (perLimit.length === 0 && joint === null) return null
  return { perLimit, joint }
}

/** The run_delta identity rule, applied to this block. */
export function limitVerdictsDescribeDisplayedAnalysis(
  stored: StoredLimitVerdicts | null | undefined,
  displayedAnalysisHash: string | null | undefined,
  currentScenarioId: string | null | undefined,
): boolean {
  if (!stored) return false
  if (typeof displayedAnalysisHash !== 'string' || displayedAnalysisHash.length === 0) return false
  if (stored.analysisHash !== displayedAnalysisHash) return false
  return stored.scenarioId === (currentScenarioId ?? null)
}
