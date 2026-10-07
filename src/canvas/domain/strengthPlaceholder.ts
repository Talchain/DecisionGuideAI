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
import { edgeValueSource, resolveEdgeSignedStrengthDisplay } from './edgeValueProvenance'

/** The magnitude-contract label for a placeholder strength (`provenance.magnitude`). */
export const OLUMI_PLACEHOLDER_MAGNITUDE = 'olumi_placeholder'

/** Same tolerance `naturalEffectPhrase` compares its β key with. */
const SAME_WEIGHT_EPSILON = 1e-9

/**
 * Mirror CEE's `linkSizing(edge) === 'placeholder'`: user authorship comes
 * first, then the magnitude label, then an untagged producer default with no
 * natural effect (Science 393023 LICENCE (b), 7 Oct).
 */
export function readWireStrengthIsPlaceholder(
  wireEdge: Record<string, unknown> | undefined | null,
): boolean {
  const provenance = wireEdge?.provenance
  const p = typeof provenance === 'object' && provenance !== null && !Array.isArray(provenance)
    ? provenance as Record<string, unknown>
    : {}
  if (p.source === 'user_specified' || p.magnitude === 'user_stated') return false
  if (p.magnitude === OLUMI_PLACEHOLDER_MAGNITUDE) return true
  if (p.magnitude !== undefined || p.natural_effect !== undefined) return false
  if (p.mean_projected === true) return true

  const strength = wireEdge?.strength as Record<string, unknown> | undefined | null
  const mean = strength?.mean ?? wireEdge?.strength_mean
  const std = strength?.std ?? wireEdge?.strength_std
  return wireEdge?.defaulted === true
    && typeof mean === 'number'
    && Math.abs(mean) === STRENGTH_DEFAULT_SIGNATURE.mean
    && std === STRENGTH_DEFAULT_SIGNATURE.std
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
