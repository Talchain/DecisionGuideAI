/**
 * B5 — WHAT THIS RUN COULD SAY ABOUT EACH OF YOUR LIMITS (27 Sep 2026).
 *
 * Joins CEE's typed per-limit verdicts (`storedLimitVerdicts.ts`) to the user's own
 * stated limits (`selectStatedLimits`) BY CONSTRAINT ID — the verdict carries ids,
 * never labels, so a verdict for a limit this model does not hold is dropped rather
 * than given a name.
 *
 * ⚠ NO PROBABILITY IS SAID HERE. The per-limit P stays behind its own trust gate
 * (`statedLimits.ts` header); this line says only WHETHER, and on whose figure, the
 * limit was checked. `estimate_only` is never worded as met or as the user's figure,
 * and an unknown reason code is never printed raw.
 */
import type { LimitVerdicts, PerLimitVerdictState } from '../../../canvas/state/storedLimitVerdicts'
import type { StatedLimit } from '../decision-overview/statedLimits'

export const LIMIT_VERDICT_COPY = {
  scored: 'Checked on this run.',
  estimateOnly: "Checked against Olumi's estimate of where this stands today, not a figure you gave.",
  unscored: 'Not checked on this run.',
  unscoredBecause: (why: string) => `Not checked on this run: ${why}.`,
  jointWithheld: "Olumi can't say whether an option stays within all your limits together, because not every limit could be checked.",
} as const

/** The documented reason codes (0.60.0 `ConstraintPerLimitVerdictSchema`), in plain words. */
export const LIMIT_UNSCORED_REASON_WORDS: Readonly<Record<string, string>> = {
  threshold_unframed: "Olumi couldn't put this limit on the model's scale",
  target_unanchored: 'the model has no figure for where this stands today',
  threshold_clamped: 'the limit falls outside the range the model can reach',
  CONSTRAINT_NOT_CONVERTIBLE: "the limit couldn't be converted into the model's units",
  CONSTRAINT_TARGET_UNRELIABLE: "Olumi couldn't check it reliably against this model",
  tally_units_incoherent: 'the figures it adds up are in different units',
}

export interface LimitVerdictRow {
  readonly id: string
  /** The limit as the user stated it (`StatedLimit.text`). */
  readonly limitText: string
  readonly state: PerLimitVerdictState
  readonly words: string
}

export interface LimitVerdictView {
  readonly rows: readonly LimitVerdictRow[]
  /** Set only when the joint verdict is withheld AND the user holds two or more limits. */
  readonly jointWords: string | null
}

function wordsFor(state: PerLimitVerdictState, reason: string | null): string {
  if (state === 'scored') return LIMIT_VERDICT_COPY.scored
  if (state === 'estimate_only') return LIMIT_VERDICT_COPY.estimateOnly
  const why = reason === null ? undefined : LIMIT_UNSCORED_REASON_WORDS[reason]
  return why ? LIMIT_VERDICT_COPY.unscoredBecause(why) : LIMIT_VERDICT_COPY.unscored
}

/** `null` when there is nothing to say: no verdicts, or none names a limit this model holds. */
export function buildLimitVerdictView(
  verdicts: LimitVerdicts | null | undefined,
  limits: readonly StatedLimit[],
): LimitVerdictView | null {
  if (!verdicts || limits.length === 0) return null
  const byId = new Map(verdicts.perLimit.map((v) => [v.constraintId, v]))
  const rows: LimitVerdictRow[] = []
  for (const limit of limits) {
    const verdict = byId.get(limit.id)
    if (!verdict) continue
    rows.push({ id: limit.id, limitText: limit.text, state: verdict.state, words: wordsFor(verdict.state, verdict.reason) })
  }
  const jointWords = verdicts.joint?.state === 'withheld' && limits.length >= 2 ? LIMIT_VERDICT_COPY.jointWithheld : null
  if (rows.length === 0 && jointWords === null) return null
  return { rows, jointWords }
}
