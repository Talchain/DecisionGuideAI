/**
 * WHICH OPTIONS ARE OUTSIDE THIS RUN'S ORDINARY COMPARISON, AND WHY — the UI's one reader of the Run's stored
 * participation fact (carrier CONFIRMED by Runtime, #72 5888341208, as Canvas proposed in 5887560895; DL 5887489508 /
 * 5887510885: "Canvas builds from its typed carrier, with no provenance guess in UI").
 *
 * Runtime's filter runs after `gateAnalysableOptions`. An option Olumi proposed (`proposed_by: 'olumi'`) is:
 *   - `excluded_olumi_proposed` — left out of the submission, because ≥2 user-owned analysable options remain;
 *   - `kept_olumi_provisional` — kept in an explicitly provisional comparison, because fewer remain. It names the
 *     unanalysable user option(s), and the unqualified leader claim is withheld by the producer.
 * Only options OUTSIDE the ordinary comparison appear. The UI says what the fact says; it never infers authorship.
 *
 * 0.69.0 (MG, F1 T6): a user-owned option appears ONLY when the user marked it out of the comparison:
 *   - `excluded_infeasible` — the user marked it not feasible (`option_status_edit`);
 *   - `excluded_removed` — the user took it out.
 * The UI says "Taken out: not feasible" / "Taken out" (DL 5932328304), never "not compared": it is the user's own act.
 *
 * Two legs, one reader (the `goal_certainty` precedent, `storedGoalCertainty.ts`): the turn key `option_participation`
 * (top level, then the additive sidecar) and the cold read's `analysis_option_participation`. The parity rule
 * (Canonical 5888351928): a refused array is ABSENT on both legs, and a recorded `[]` stays `[]`:
 *   - not an array → `null` (not recorded: no claim either way, today's behaviour stands);
 *   - `[]` → recorded, every option is in the ordinary comparison;
 *   - ANY entry outside the published contract (mirrored below) → `null`.
 */
import { z } from 'zod'
import { OptionParticipationEntrySchema } from '@talchain/schemas/orchestrator'
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const OPTION_PARTICIPATION_TURN_KEY = 'option_participation'
export const OPTION_PARTICIPATION_READ_KEY = 'analysis_option_participation'

export type OptionParticipationState = z.infer<typeof OptionParticipationEntrySchema>['state']

/** The two states a USER's own mark produces (0.69.0). Canvas's card and the panel read this, never a local predicate. */
export type UserTakenOutState = Extract<OptionParticipationState, 'excluded_infeasible' | 'excluded_removed'>
export function isUserTakenOut(state: OptionParticipationState | null | undefined): state is UserTakenOutState {
  return state === 'excluded_infeasible' || state === 'excluded_removed'
}

export interface OptionParticipationEntry {
  readonly optionId: string
  readonly state: OptionParticipationState
  /**
   * `kept_olumi_provisional` only: the user's options the gate excluded. EMPTY when the user simply named fewer than two
   * options — nothing was excluded, so nothing may be said to be unanalysable (Runtime 5888591648).
   */
  readonly unanalysableUserOptionIds: readonly string[]
}

/** The array from a parsed turn: top level first, then the additive sidecar. */
export function optionParticipationFromResponse(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const top = (response as Record<string, unknown>)[OPTION_PARTICIPATION_TURN_KEY]
  if (top !== undefined) return top
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return additive?.[OPTION_PARTICIPATION_TURN_KEY]
}

/** This option's entry in the Run's fact on the report, or null (in the ordinary comparison, or not recorded). */
export function optionParticipationOf(
  report: { option_participation?: readonly OptionParticipationEntry[] } | null | undefined,
  optionId: string,
): OptionParticipationEntry | null {
  return report?.option_participation?.find((e) => e.optionId === optionId) ?? null
}

/**
 * ⛔ THE PUBLISHED ENTRY CONTRACT, IMPORTED — `@talchain/schemas` 0.69.0 `OptionParticipationEntrySchema`. The copy that
 * stood here (mirrored from 0.65.0 while the UI vendored 0.61.0) said to delete itself once the vendored package carried
 * the schema; it now does, and the copy's two-value enum would have refused every 0.69.0 `excluded_infeasible` /
 * `excluded_removed` record. A present-but-empty id list, ids on anything but a provisional keep, and an undeclared key
 * are all refused by the published schema itself. The record-level refinement below is the published one, restated
 * because the package exports it only inside `RunAnalysisResultSchema`.
 */
// ONE VERDICT PER OPTION: a repeated `option_id`, or an Olumi option named as a user's, refuses the whole record.
const OptionParticipationRecord = z.array(OptionParticipationEntrySchema).superRefine((entries, ctx) => {
  const ids = entries.map((e) => e.option_id)
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i) ctx.addIssue({ code: 'custom', path: [i, 'option_id'], message: 'one participation verdict per option' })
  })
  entries.forEach((e, i) => (e.unanalysable_user_option_ids ?? []).forEach((u, j) => {
    if (ids.includes(u)) {
      ctx.addIssue({ code: 'custom', path: [i, 'unanalysable_user_option_ids', j], message: "an Olumi option is not the user's" })
    }
  }))
})

/** `null` = not recorded, or refused (ANY entry outside the contract refuses the whole record). `[]` = recorded, none. */
export function readOptionParticipation(raw: unknown): readonly OptionParticipationEntry[] | null {
  const parsed = OptionParticipationRecord.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data.map((e) => ({ optionId: e.option_id, state: e.state, unanalysableUserOptionIds: e.unanalysable_user_option_ids ?? [] }))
}
