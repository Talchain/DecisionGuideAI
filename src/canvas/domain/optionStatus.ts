/**
 * ⭐ AN OPTION THE USER TOOK OUT OF THE COMPARISON (T12 row 1; MG F1 spec §3; schemas 0.69.0 `option_status`).
 *
 * Paul, 1 Oct 2026: the canvas showed 4 options while the engine analysed 3, and he could not take "carry on as now"
 * out ("I can't remove it with the available tools"). A writer that sets `infeasible` or `removed` also sets
 * `analysis_participation: 'retained_excluded'`, so the analysed set and the shown set are one set; this field says
 * WHY the option is out. The card keeps the option in view (it stays in the model) and says so in one muted line.
 *
 * ── THE READER: POSITIVE EQUALITY ONLY ──────────────────────────────────────
 * Absent means `feasible` (every option before 0.69.0), and so does any value this build does not know. Only the two
 * licensed words produce a line, as `analysisParticipation.ts` does for its own field: a negation would stamp "Taken
 * out" on every option that carries no field at all.
 *
 * ── ONE WORDING ─────────────────────────────────────────────────────────────
 * The words are the DL's (#85 5932328304), IMPORTED from the Analysis panel's labels (`notAnalysedCopy.ts`, PANEL
 * #2406), whose reader reads the Run's `option_participation` (`excluded_infeasible` / `excluded_removed`). So the card
 * (model fact, true before any Run) and the panel (Run fact) say the same thing. Never "Not compared yet".
 */
import { TAKEN_OUT_INFEASIBLE_LABEL, TAKEN_OUT_REMOVED_LABEL } from '../../components/results/utils/notAnalysedCopy'

export type TakenOutStatus = 'infeasible' | 'removed'

/** PANEL's labels (#2406), imported, never restated: the card and the Analysis panel say the same words. */
export const OPTION_TAKEN_OUT_COPY: Readonly<Record<TakenOutStatus, string>> = Object.freeze({
  infeasible: TAKEN_OUT_INFEASIBLE_LABEL,
  removed: TAKEN_OUT_REMOVED_LABEL,
})

/** The status the user set, when it takes the option out; `null` for feasible, absent or unrecognised. */
export function optionTakenOut(data: unknown): TakenOutStatus | null {
  const status = (data as { option_status?: unknown } | null | undefined)?.option_status
  if (status === 'infeasible') return 'infeasible'
  if (status === 'removed') return 'removed'
  return null
}

/** The card's line for it, or `null`. */
export function optionTakenOutLine(data: unknown): string | null {
  const status = optionTakenOut(data)
  return status === null ? null : OPTION_TAKEN_OUT_COPY[status]
}
