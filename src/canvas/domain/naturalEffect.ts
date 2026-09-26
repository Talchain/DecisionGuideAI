/**
 * AN EDGE'S SIZE IN THE TARGET'S OWN UNITS — the magnitude contract's natural
 * effect, read once at ingestion and said instead of the |β| band.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────────
 * The band (`model-tab/strengthBands.ts`) classifies |β|, a number on the
 * model's own scale. On a percentage target a real effect is a small β: "AI cuts
 * churn by 1 point at 4%" is β −0.01, which the band calls "Negligible effect".
 * A user reading that is told his effect does not matter. Model Generation's
 * magnitude contract (#70 5845713522) persists the size the producer ADMITTED,
 * in the target's own unit, on `edge.provenance`:
 *
 *   provenance.magnitude:      'user_stated' | 'olumi_estimate' | 'olumi_placeholder'
 *   provenance.natural_effect: { amount, amount_unit, per_source_change, per_source_change_unit,
 *                                strength_mean, strength_mean_frame: 'edge_strength' }
 *
 * (Final key names, MG #70 5846999581: CEE's value-warrant guard needs each number's
 * unit scoped to that number, so `unit` → `amount_unit`, `source_unit` →
 * `per_source_change_unit`, and `strength_mean_frame` says which β the key is.)
 *
 * The UI SAYS it; it never converts β itself. A second copy of the producer's
 * frame arithmetic here would be parallel logic that drifts.
 *
 * ── THE READ RULE (MG 5845713522) ─────────────────────────────────────────────
 *   · natural effect present → "Decrease of about 1 point of churn · Olumi's estimate";
 *   · absent (every legacy edge) → today's band, unchanged;
 *   · `provenance.source === 'user_specified'` always reads as the user's.
 *
 * ── ⛔ A PERSISTED COPY GOES STALE — `strength_mean` IS ITS KEY (R&C 5845818897) ──
 * The amount describes ONE β. The user can edit the strength afterwards (the
 * inspector, the Model tab, an approved change), and the acknowledgement path
 * keeps the rest of `edge.data`, so an old amount can outlive the β it describes.
 * The phrase is therefore said ONLY while the edge's current signed mean equals
 * the `strength_mean` the amount was admitted for. Any other mean → null → the
 * band. A stale copy cannot speak, whichever writer moved the number.
 *
 * ── AND THE DIRECTION IS NOT READ OFF THE SIGN ────────────────────────────────
 * The phrase needs a STATED direction (`EdgeDirectionDisplay.show`, ROADMAP
 * 2.263), and the amount's sign must agree with it. Disagreement is a state we
 * cannot describe in one phrase, so we decline (the band speaks), exactly as
 * `readServerStatedStrength` declines a mean whose sign contradicts the stated
 * direction. A zero amount is not an effect to phrase either.
 *
 * Pure: no store, no clock.
 */
import { z } from 'zod'

import { formatRawValueWithUnit } from '../utils/labelUtils'
import type { EdgeDirectionDisplay } from './edgeValueProvenance'

/** Whose figure the size is. `user` outranks the producer's own label. */
export type NaturalEffectAuthor = 'user' | 'olumi_estimate' | 'olumi_placeholder'

export const NaturalEffectSchema = z.object({
  /** Signed change in the TARGET's own unit, as admitted. */
  amount: z.number().finite(),
  /** The target's unit label, e.g. "points of churn", "£ per month", "customers". */
  unit: z.string().min(1),
  /** The source change the amount is per (1 = the switch for a yes/no or an option switched on). */
  perSourceChange: z.number().finite().positive(),
  /** The source's unit label, e.g. "switch", "£", "hires". */
  sourceUnit: z.string().min(1),
  /** The signed β the amount was admitted for — the staleness key (see header). */
  strengthMean: z.number().finite(),
  author: z.enum(['user', 'olumi_estimate', 'olumi_placeholder']),
})
export type NaturalEffect = z.infer<typeof NaturalEffectSchema>

/** The frame `strength_mean` is stated in: the edge's own strength (β). */
export const STRENGTH_MEAN_FRAME = 'edge_strength'

/** The source unit a yes/no source or a switched-on option carries. */
export const SWITCH_SOURCE_UNIT = 'switch'

/** Float tolerance for "the same β": a round trip through JSON is exact, arithmetic is not. */
const SAME_MEAN_EPSILON = 1e-9

const MAGNITUDE_AUTHORS: Record<string, NaturalEffectAuthor> = {
  user_stated: 'user',
  olumi_estimate: 'olumi_estimate',
  olumi_placeholder: 'olumi_placeholder',
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * The wire edge's natural effect, or undefined. Every field is required: a
 * partial record is not a size we can say, and ABSENT MEANS UNKNOWN (the band
 * speaks). One reader for every ingestion hop, the `readServerStatedStrength`
 * pattern, so the hops cannot disagree.
 */
export function readWireNaturalEffect(
  wireEdge: Record<string, unknown> | undefined | null,
): NaturalEffect | undefined {
  const provenance = readRecord(wireEdge?.provenance)
  if (provenance === null) return undefined
  const ne = readRecord(provenance.natural_effect)
  if (ne === null) return undefined
  const author: NaturalEffectAuthor | undefined =
    provenance.source === 'user_specified'
      ? 'user'
      : typeof provenance.magnitude === 'string'
        ? MAGNITUDE_AUTHORS[provenance.magnitude]
        : undefined
  if (author === undefined) return undefined
  // The staleness key is compared with the edge's own strength mean, so it must SAY
  // it is on that frame. Anything else is not a key this reader can compare.
  if (ne.strength_mean_frame !== STRENGTH_MEAN_FRAME) return undefined
  const parsed = NaturalEffectSchema.safeParse({
    amount: ne.amount,
    unit: nonEmpty(ne.amount_unit),
    perSourceChange: ne.per_source_change,
    sourceUnit: nonEmpty(ne.per_source_change_unit),
    strengthMean: ne.strength_mean,
    author,
  })
  return parsed.success ? parsed.data : undefined
}

/**
 * The unit's HEAD NOUN made singular when the amount is exactly one: the last
 * word before any "of" / "per", as English noun phrases put it last.
 * "percentage points" (the producer's word for a percentage level, `link-effect.ts`
 * `targetUnitWords`) → "percentage point"; "points of churn" → "point of churn";
 * "customers" → "customer". Only a plain plural (a trailing "s", never "ss"); a
 * symbol or code unit ("£", "GBP per month") has no word to change.
 */
export function unitForAmount(amount: number, unit: string): string {
  if (Math.abs(amount) !== 1) return unit
  const words = unit.split(' ')
  const stop = words.findIndex(w => /^(of|per)$/i.test(w))
  const head = (stop === -1 ? words.length : stop) - 1
  const noun = words[head]
  if (head < 0 || noun === undefined || !/^[a-z]{3,}s$/i.test(noun) || /ss$/i.test(noun)) return unit
  words[head] = noun.slice(0, -1)
  return words.join(' ')
}

const AUTHOR_SUFFIX: Record<NaturalEffectAuthor, string> = {
  user: '',
  olumi_estimate: " · Olumi's estimate",
  olumi_placeholder: ' · a placeholder, not an estimate',
}

/**
 * The phrase for the edge's size, or null when it must not be said (the caller
 * then shows the band): no natural effect, a moved β (stale), no stated
 * direction, a sign that contradicts the stated direction, or a zero amount.
 *
 * `currentMean` is the edge's current SIGNED mean, as the row resolves it
 * (`resolveEdgeStrengthEditSeed`).
 */
export function naturalEffectPhrase(
  effect: NaturalEffect | undefined | null,
  currentMean: number,
  direction: EdgeDirectionDisplay,
): string | null {
  if (!effect) return null
  if (!Number.isFinite(currentMean) || Math.abs(currentMean - effect.strengthMean) > SAME_MEAN_EPSILON) return null
  if (!direction.show || effect.amount === 0) return null
  if ((effect.amount < 0 ? 'negative' : 'positive') !== direction.direction) return null

  const size = Math.abs(effect.amount)
  const change = `${direction.direction === 'negative' ? 'Decrease' : 'Increase'} of about ${formatRawValueWithUnit(size, unitForAmount(size, effect.unit))}`
  const per = effect.sourceUnit === SWITCH_SOURCE_UNIT
    ? ''
    : ` per ${formatRawValueWithUnit(effect.perSourceChange, unitForAmount(effect.perSourceChange, effect.sourceUnit))}`
  return `${change}${per}${AUTHOR_SUFFIX[effect.author]}`
}
