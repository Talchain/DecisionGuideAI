/**
 * ⭐⭐ A PLACEHOLDER STRENGTH IS NOT AN ESTIMATE (paul-models POM-8, 27 Sep 2026).
 *
 * CEE marks a strength it could not estimate with `provenance.magnitude:
 * 'olumi_placeholder'` — a number put in so the model can run, which Olumi does
 * not stand behind. The canvas dropped that label at ingestion (it survived only
 * inside `naturalEffect.author`, and only when a natural effect rode along), so
 * on Paul's MRR board "Pro plan price → MRR" (mean 0.5, placeholder) drew at the
 * Strong band's 4px — the heaviest link into his goal — its hover said nothing,
 * and its inspector read "Olumi estimated this strength from your description …
 * Olumi's current estimate is 0.5 · Confirm this estimate". The Model tab, on the
 * same edge, said "a placeholder, not an estimate". One edge, two verdicts.
 *
 * OWNER DECISION (Canvas lead, 27 Sep): a placeholder strength draws at the thin
 * NOT-SET width (`UNSET_EDGE_STROKE_WIDTH` — the design system's 8 Sep rule:
 * "unset is decided by PROVENANCE, never by a value"), the hover says it is a
 * placeholder and not an estimate, and the inspector neither says Olumi
 * estimated it nor offers to confirm it as an estimate. Direction colour stays:
 * the label covers the MAGNITUDE only.
 *
 * ⭐ ONE READER AT EVERY INGESTION HOP (`mapDraftEdgeToCanvas`, `buildEdge`,
 * `DraftChat`), the `readWireNaturalEffect` pattern, so the hops cannot disagree.
 * The fact is stored as `strengthPlaceholder` — the canvas `weight` the
 * placeholder set — on edge data, independent of any natural effect.
 *
 * ⭐ STALENESS BY CONSTRUCTION — no new writer clears it. The flag is live only
 * while the weight is still CEE's (`edgeValueSource(data,'weight') === 'cee'`)
 * AND the magnitude drawn still equals the stored one. A person who sets the
 * strength stamps `weightSource: 'user'`; a later producer figure moves the
 * magnitude. Either way the edge stops reading as a placeholder with nothing
 * written. This is the same rule `naturalEffectPhrase` uses for its own key.
 *
 * ⚠ ABSENT ⇒ NOT KNOWN, unless it is an untagged producer default: CEE's
 * `mean_projected`, or the door constant with `defaulted`, is a placeholder too
 * (Science 393023 LICENCE (a), 7 Oct).
 */
import { STRENGTH_DEFAULT_SIGNATURE } from '@talchain/schemas'
import { edgeValueSource, resolveEdgeSignedStrengthDisplay, type EdgeValueDisplay } from './edgeValueProvenance'

/** The magnitude-contract label for a placeholder strength (`provenance.magnitude`). */
export const OLUMI_PLACEHOLDER_MAGNITUDE = 'olumi_placeholder'

/** Same tolerance `naturalEffectPhrase` compares its β key with. */
const SAME_WEIGHT_EPSILON = 1e-9

/**
 * CEE's door-constant table (`link-sizing.ts` DOOR_DEFAULT_CONSTANTS), one row per default door: the links a door wrote
 * before it tagged. Matched only with `defaulted: true`: a user's bare 0.5 never reads as a placeholder.
 */
export const DOOR_DEFAULT_CONSTANTS: ReadonlyArray<{ readonly mean: number; readonly std: number }> = [
  { mean: STRENGTH_DEFAULT_SIGNATURE.mean, std: STRENGTH_DEFAULT_SIGNATURE.std }, // hypothesisEdgeValue (+ Option / + Risk / add-factor)
  { mean: 0.5, std: 0.2 }, // factor enricher
]

/**
 * Mirror CEE's `linkSizing(edge) === 'placeholder'`, clause by clause (Science 393023 LICENCE rulings 1-2, 7 Oct
 * 20:48Z): `user_stated` → not; `mean_projected` → placeholder whatever its magnitude, natural effect or source (fails
 * closed); `user_specified` → not; the tag → placeholder; any other magnitude or a natural effect → not; else the
 * untagged door constants with `defaulted`.
 */
export function readWireStrengthIsPlaceholder(
  wireEdge: Record<string, unknown> | undefined | null,
): boolean {
  const provenance = wireEdge?.provenance
  const p = typeof provenance === 'object' && provenance !== null && !Array.isArray(provenance)
    ? provenance as Record<string, unknown>
    : {}
  if (p.magnitude === 'user_stated') return false
  if (p.mean_projected === true) return true
  if (p.source === 'user_specified') return false
  if (p.magnitude === OLUMI_PLACEHOLDER_MAGNITUDE) return true
  if (p.magnitude !== undefined || p.natural_effect !== undefined) return false

  // Exactly the field CEE reads (nested `strength`, link-sizing.ts): a flat `strength_mean` never completes it (parity).
  const strength = wireEdge?.strength
  if (typeof strength !== 'object' || strength === null || Array.isArray(strength)) return false
  const { mean, std } = strength as Record<string, unknown>
  return wireEdge?.defaulted === true
    && typeof mean === 'number'
    && DOOR_DEFAULT_CONSTANTS.some(d => Math.abs(mean) === d.mean && std === d.std)
}

/**
 * The edge-data patch an ingestion hop spreads: `{ strengthPlaceholder: weight }`
 * when the wire labelled a strength it actually SUPPLIED as a placeholder, else
 * nothing. `weight` is the hop's own resolved canvas weight, so the stored key
 * is exactly the number the edge draws.
 */
export function strengthPlaceholderPatch(
  wireEdge: Record<string, unknown> | undefined | null,
  weight: number,
  wireSuppliedStrength: boolean,
): { strengthPlaceholder?: number } {
  if (!wireSuppliedStrength || !Number.isFinite(weight)) return {}
  return readWireStrengthIsPlaceholder(wireEdge) ? { strengthPlaceholder: weight } : {}
}

/**
 * Is this edge's strength, as drawn now, CEE's placeholder? See the header for
 * the staleness rule. Reads the SAME resolved display the stroke width does.
 */
export function isStrengthPlaceholder(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return false
  const stored = data.strengthPlaceholder
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return false
  if (edgeValueSource(data, 'weight') !== 'cee') return false
  const display = resolveEdgeSignedStrengthDisplay(data)
  if (!display.show) return false
  return Math.abs(Math.abs(display.value) - stored) <= SAME_WEIGHT_EPSILON
}

/**
 * The strength an edge's WORDS describe. A placeholder is drawn thin and grey (the not-set width), so its name says
 * "strength not set" too — never "Slight boost" for a size nobody chose (Science 393023 LICENCE ruling 3: one meaning
 * of unsized across canvas, chat and approval). Both naming seams read this: StyledEdge's chip and
 * `describeEdgeForSpeech`.
 */
export function strengthForWords(data: Record<string, unknown> | undefined | null, strength: EdgeValueDisplay): EdgeValueDisplay {
  return isStrengthPlaceholder(data) ? { show: false, reason: 'not_set' } : strength
}
