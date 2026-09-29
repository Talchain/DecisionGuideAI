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
 *   - ANY entry outside the contract (no `option_id`, an unknown `state`, a non-string id in the list) → `null`.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const OPTION_PARTICIPATION_TURN_KEY = 'option_participation'
export const OPTION_PARTICIPATION_READ_KEY = 'analysis_option_participation'

export type OptionParticipationState = 'excluded_olumi_proposed' | 'kept_olumi_provisional'
const STATES: ReadonlySet<string> = new Set<OptionParticipationState>(['excluded_olumi_proposed', 'kept_olumi_provisional'])

export interface OptionParticipationEntry {
  readonly optionId: string
  readonly state: OptionParticipationState
  /** `kept_olumi_provisional` only: the user's options this Run could not analyse. Empty when not sent. */
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

/** `null` = not recorded, or refused. `[]` = recorded, no option outside the ordinary comparison. */
export function readOptionParticipation(raw: unknown): readonly OptionParticipationEntry[] | null {
  if (!Array.isArray(raw)) return null
  const out: OptionParticipationEntry[] = []
  for (const row of raw) {
    if (row === null || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    if (typeof r.option_id !== 'string' || r.option_id.length === 0) return null
    if (typeof r.state !== 'string' || !STATES.has(r.state)) return null
    const ids = r.unanalysable_user_option_ids
    if (ids !== undefined && (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length === 0))) return null
    out.push({ optionId: r.option_id, state: r.state as OptionParticipationState, unanalysableUserOptionIds: (ids as string[] | undefined) ?? [] })
  }
  return out
}
