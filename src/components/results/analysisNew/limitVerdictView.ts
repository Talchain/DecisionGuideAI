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
  /* Owner-neutral on purpose: `estimate_only` also carries rule (d), where the figure is
     the level the leading option sets, and its owner may be the user. Naming "Olumi's
     estimate" or "today" would be false for some of the limits in this state. */
  estimateOnly: 'Checked only against an assumed figure, not a measured one.',
  unscored: 'Not checked on this run.',
  unscoredBecause: (why: string) => `Not checked on this run: ${why}.`,
  jointWithheld: "Olumi can't say whether an option stays within all your limits together, because not every limit could be checked.",
} as const

/**
 * The documented reason codes (0.60.0 `ConstraintPerLimitVerdictSchema`), in plain words.
 * A code whose producer raises it for more than one cause (`CONSTRAINT_NOT_CONVERTIBLE`)
 * has no entry: it falls back to "Not checked on this run." rather than name a cause.
 */
export const LIMIT_UNSCORED_REASON_WORDS: Readonly<Record<string, string>> = {
  threshold_unframed: "Olumi couldn't put this limit on the model's scale",
  target_unanchored: 'the model has no measured starting point to check it against',
  threshold_clamped: 'the limit falls outside the range the model can reach',
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
  const why =
    reason !== null && Object.prototype.hasOwnProperty.call(LIMIT_UNSCORED_REASON_WORDS, reason)
      ? LIMIT_UNSCORED_REASON_WORDS[reason]
      : undefined
  return why ? LIMIT_VERDICT_COPY.unscoredBecause(why) : LIMIT_VERDICT_COPY.unscored
}

/**
 * `null` when there is nothing to say: no verdicts, or none names a limit this model holds.
 *
 * `limitsAtRun` is the set the verdicts judged. Only a limit still worded as it was then
 * carries its verdict; an edited, added or removed limit also drops the joint line,
 * because the run never judged the set now on screen.
 */
export function buildLimitVerdictView(
  verdicts: LimitVerdicts | null | undefined,
  limits: readonly StatedLimit[],
  limitsAtRun: readonly StatedLimit[],
): LimitVerdictView | null {
  if (!verdicts || limits.length === 0) return null
  const judged = new Map(limitsAtRun.map((l) => [l.id, l.text]))
  const unchanged = limits.filter((l) => judged.get(l.id) === l.text)
  const sameSet = unchanged.length === limits.length && judged.size === limits.length
  const byId = new Map(verdicts.perLimit.map((v) => [v.constraintId, v]))
  const rows: LimitVerdictRow[] = []
  for (const limit of unchanged) {
    const verdict = byId.get(limit.id)
    if (!verdict) continue
    rows.push({ id: limit.id, limitText: limit.text, state: verdict.state, words: wordsFor(verdict.state, verdict.reason) })
  }
  const jointWords =
    sameSet && verdicts.joint?.state === 'withheld' && limits.length >= 2 ? LIMIT_VERDICT_COPY.jointWithheld : null
  if (rows.length === 0 && jointWords === null) return null
  return { rows, jointWords }
}
