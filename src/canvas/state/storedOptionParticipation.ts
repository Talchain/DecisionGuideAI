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
 * Two legs, one reader (the `goal_certainty` precedent, `storedGoalCertainty.ts`): the turn key `option_participation`
 * (top level, then the additive sidecar) and the cold read's `analysis_option_participation`. The parity rule
 * (Canonical 5888351928): a refused array is ABSENT on both legs, and a recorded `[]` stays `[]`:
 *   - not an array → `null` (not recorded: no claim either way, today's behaviour stands);
 *   - `[]` → recorded, every option is in the ordinary comparison;
 *   - ANY entry outside the published contract (mirrored below) → `null`.
 */
import { z } from 'zod'
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const OPTION_PARTICIPATION_TURN_KEY = 'option_participation'
export const OPTION_PARTICIPATION_READ_KEY = 'analysis_option_participation'

export type OptionParticipationState = 'excluded_olumi_proposed' | 'kept_olumi_provisional'

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
 * ⛔ THE PUBLISHED ENTRY CONTRACT, MIRRORED VERBATIM — `@talchain/schemas` 0.65.0 `OptionParticipationEntrySchema`
 * (schemas #74 @ d01afc1e, `src/orchestrator/handler-results.ts`). The UI vendors 0.61.0, so the schema is copied rather
 * than re-interpreted (DL CHANGES_REQUIRED on #2305 @ ddf47006): a present-but-empty id list, an exclusion that names
 * ids, and an undeclared key are all refused. Delete this copy when the vendored package carries the schema.
 */
const OptionParticipationEntrySchema = z.object({
  option_id: z.string().min(1),
  state: z.enum(['excluded_olumi_proposed', 'kept_olumi_provisional']),
  unanalysable_user_option_ids: z.array(z.string().min(1)).min(1).optional(),
}).strict().superRefine((e, ctx) => {
  if (e.state === 'excluded_olumi_proposed' && e.unanalysable_user_option_ids !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['unanalysable_user_option_ids'],
      message: 'only a provisional keep names unanalysable user options' })
  }
})
const OptionParticipationRecord = z.array(OptionParticipationEntrySchema)

/** `null` = not recorded, or refused (ANY entry outside the contract refuses the whole record). `[]` = recorded, none. */
export function readOptionParticipation(raw: unknown): readonly OptionParticipationEntry[] | null {
  const parsed = OptionParticipationRecord.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data.map((e) => ({ optionId: e.option_id, state: e.state, unanalysableUserOptionIds: e.unanalysable_user_option_ids ?? [] }))
}
