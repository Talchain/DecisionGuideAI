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
import { BY_DEFINITION } from './strengthDefinitional'

/** Whose figure the size is. `user` outranks the producer's own label. */
export type NaturalEffectAuthor = 'user' | 'olumi_estimate' | 'olumi_placeholder' | 'example_figure'

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
  author: z.enum(['user', 'olumi_estimate', 'olumi_placeholder', 'example_figure']),
  /**
   * ⭐ Beat 1 (Canvas lane, 4 Oct 2026): WHERE the user's size came from, read off the same stored `provenance` at the
   * same hop — `brief_extraction` → "from your brief", anything else the user authored (`user_specified`, a size they
   * stated outside the brief) → "your figure". Only on the user's own size; absent on a copy persisted before this
   * field (that copy says what it always said: no author words).
   */
  userOrigin: z.enum(['brief', 'entered']).optional(),
  /**
   * ⭐ A4 (CEE #2409; R3 C1/C2 #75 5918513716, AIQ 5919755441): the user's amount is ONE END of a range they wrote
   * ("deals between £1-2 million" → £1,000,000, the low end). Said WITH the range, as a bound — never as the user's
   * single figure. Read only on the user's own size.
   */
  statedRange: z.object({
    low: z.number().finite(),
    high: z.number().finite(),
    text: z.string().min(1),
    end: z.enum(['low', 'high']),
  }).optional(),
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
  example_figure: 'example_figure',
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** RT-12: example attribution also survives when the producer supplied no natural-effect amount. */
export function strengthExampleFigurePatch(
  wireEdge: Record<string, unknown> | undefined | null,
  signedMean: number,
  wireSuppliedStrength: boolean,
): { strengthExampleFigure?: number } {
  const provenance = readRecord(wireEdge?.provenance)
  if (!wireSuppliedStrength || !Number.isFinite(signedMean) || provenance?.source === 'user_specified' ||
      provenance?.magnitude !== 'example_figure') return {}
  const natural = readRecord(provenance.natural_effect)
  // A supplied natural effect keeps its own admitted key; no amount or unit is fabricated for an unsized link.
  if (provenance.natural_effect !== undefined &&
      (natural?.strength_mean_frame !== STRENGTH_MEAN_FRAME ||
       typeof natural.strength_mean !== 'number' || !Number.isFinite(natural.strength_mean))) return {}
  return { strengthExampleFigure: natural === null ? signedMean : natural.strength_mean as number }
}

/** One staleness rule for both the stored amount and example attribution without an amount. */
export function naturalEffectStrengthIsCurrent(currentMean: number, admittedMean: unknown): boolean {
  return Number.isFinite(currentMean) && typeof admittedMean === 'number' && Number.isFinite(admittedMean) &&
    Math.abs(currentMean - admittedMean) <= SAME_MEAN_EPSILON
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
  // A range that is present but unreadable is not a size we can say alone: fail closed (the band speaks), never the
  // amount as the user's single figure. Olumi's own size never carries one.
  const range = author === 'user' ? readRecord(ne.stated_range) : null
  if (author === 'user' && ne.stated_range !== undefined && range === null) return undefined
  const userOrigin = author !== 'user' ? undefined : provenance.source === 'brief_extraction' ? 'brief' : 'entered'
  const parsed = NaturalEffectSchema.safeParse({
    ...(userOrigin !== undefined ? { userOrigin } : {}),
    ...(range !== null
      ? { statedRange: { low: range.low, high: range.high, text: nonEmpty(range.text), end: range.end } }
      : {}),
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
  if (head < 0 || noun === undefined) return unit
  // A compound unit ("conversations/month") singularises the noun BEFORE the slash: "1 conversation/month",
  // never "1 conversations/month" (served funding brief, Model tab, `7fc20dff`, 30 Sep 2026).
  const [lhs, ...perPart] = noun.split('/')
  if (!/^[a-z]{3,}s$/i.test(lhs) || /ss$/i.test(lhs)) return unit
  words[head] = [lhs.slice(0, -1), ...perPart].join('/')
  return words.join(' ')
}

/** A currency per period ("£/month"): the symbol leads the figure, as the factor card writes it ("£0 / month"). */
const MONEY_PER_PERIOD = /^([£$€])\s*\/\s*([a-z]+)$/i

/**
 * An amount with its unit, as a person writes it. "£2,500 / month", never "2,500 £/month" (served funding
 * brief, Model tab, `7fc20dff`): `formatRawValueWithUnit` only knows a BARE symbol, so a money-per-period
 * unit fell through to "number, then unit". Everything else is `formatRawValueWithUnit`, unchanged.
 */
function amountWithUnit(amount: number, unit: string): string {
  const u = unitForAmount(amount, unit)
  const money = MONEY_PER_PERIOD.exec(u.trim())
  if (money) return `${formatRawValueWithUnit(amount, money[1])} / ${money[2]}`
  return formatRawValueWithUnit(amount, u)
}

/**
 * WHOSE size, in the one vocabulary every surface uses for a link (Paul, 4 Oct 2026: full words on links — "from your
 * brief" / "your figure" / "Olumi's estimate"). The user's words need `userOrigin`; a copy persisted before it says
 * nothing, as before.
 */
export function naturalEffectAuthorWords(effect: Pick<NaturalEffect, 'author' | 'userOrigin'>): string {
  if (effect.author === 'example_figure') return 'example figure'
  if (effect.author === 'olumi_estimate') return "Olumi's estimate"
  if (effect.author === 'olumi_placeholder') return 'not judged yet (a placeholder, not an estimate)'
  return effect.userOrigin === 'brief' ? 'from your brief' : effect.userOrigin === 'entered' ? 'your figure' : ''
}

/**
 * MG 0ebb952a: a link that holds BY DEFINITION (`isStrengthDefinitional`) is
 * nobody's estimate. Its producer label stays `olumi_estimate`, so the caller
 * says which, and the phrase drops both the author and the hedge ("about").
 */
export const DEFINITIONAL_SUFFIX = ` · ${BY_DEFINITION.toLowerCase()}`

/**
 * The phrase for the edge's size, or null when it must not be said (the caller
 * then shows the band): no natural effect, a moved β (stale), no stated
 * direction, a sign that contradicts the stated direction, or a zero amount.
 *
 * `currentMean` is the edge's current SIGNED mean, as the row resolves it
 * (`resolveEdgeStrengthEditSeed`). `definitional` is `isStrengthDefinitional`
 * of the same edge.
 */
export function naturalEffectPhrase(
  effect: NaturalEffect | undefined | null,
  currentMean: number,
  direction: EdgeDirectionDisplay,
  definitional = false,
): string | null {
  const parts = naturalEffectPhraseParts(effect, currentMean, direction, definitional)
  return parts === null ? null : composeNaturalEffectPhrase(parts)
}

/**
 * The parts as one phrase. A size that is one end of the user's written range already says whose it is ("the low end
 * of YOUR £1-2 million range"), so the author words are not repeated beside it.
 */
export function composeNaturalEffectPhrase(parts: { size: string; whose: string; ofRange: string }): string {
  const whose = parts.whose === '' || parts.ofRange !== '' ? '' : ` · ${parts.whose}`
  return `${parts.size}${whose}${parts.ofRange}`
}

/**
 * The phrase in its three parts, for a surface that sets the size and its author apart (the link inspector says
 * "From your brief: …"). The same gates as `naturalEffectPhrase`, which composes these; `whose` is
 * `naturalEffectAuthorWords`, or the definitional words.
 */
export function naturalEffectPhraseParts(
  effect: NaturalEffect | undefined | null,
  currentMean: number,
  direction: EdgeDirectionDisplay,
  definitional = false,
): { size: string; whose: string; ofRange: string } | null {
  if (!effect) return null
  if (!naturalEffectStrengthIsCurrent(currentMean, effect.strengthMean)) return null
  if (!direction.show || effect.amount === 0) return null
  if ((effect.amount < 0 ? 'negative' : 'positive') !== direction.direction) return null

  const size = Math.abs(effect.amount)
  // A4: one end of the user's written range bounds the size — the low end "at least", the high end "at most".
  const holdsByDefinition = definitional && effect.author !== 'example_figure'
  const range = effect.author === 'user' && !holdsByDefinition ? effect.statedRange : undefined
  const bound = holdsByDefinition ? '' : range === undefined ? 'about ' : range.end === 'low' ? 'at least ' : 'at most '
  const change = `${direction.direction === 'negative' ? 'Decrease' : 'Increase'} of ${bound}${amountWithUnit(size, effect.unit)}`
  const per = effect.sourceUnit === SWITCH_SOURCE_UNIT
    ? ''
    : ` per ${amountWithUnit(effect.perSourceChange, effect.sourceUnit)}`
  const ofRange = range === undefined ? '' : ` · the ${range.end} end of your ${range.text} range`
  return { size: `${change}${per}`, whose: holdsByDefinition ? BY_DEFINITION.toLowerCase() : naturalEffectAuthorWords(effect), ofRange }
}
