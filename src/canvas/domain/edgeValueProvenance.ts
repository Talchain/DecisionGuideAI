/**
 * Edge value provenance — "was this number SET, or did it fall through to a UI default?"
 *
 * WHY THIS EXISTS
 * ---------------
 * `DEFAULT_EDGE_DATA` / `USER_EDGE_DEFAULTS` pin `beliefExists: 0.8` and
 * `weight: 0.5 / 0.3`. Those constants were rendered to the user as
 * `"80% conf."` (ConnRow) and `"50% link strength"` (EdgePills) — a hardcoded
 * constant SPOKEN AS A MEASUREMENT. `EdgeData` carried no way to tell a value
 * somebody actually chose from a value nobody ever supplied, so the renderers
 * could not tell them apart even in principle.
 *
 * THE INVARIANT — ABSENT MEANS DEFAULTED
 * --------------------------------------
 * A marker that silently defaults to "set" would be WORSE than no marker at
 * all: it would launder every fallthrough into a claim. So the fields below
 * are OPTIONAL and are stamped ONLY where the value demonstrably came from a
 * named source. A construction site that does nothing therefore produces the
 * HONEST state with no work — and the failure mode of forgetting to stamp is
 * under-disclosure ("not set" on a value that was in fact set), never an
 * over-claim.
 *
 * WHY FLAT KEYS AND NOT A NESTED `valueProvenance` OBJECT
 * ------------------------------------------------------
 * `mergeAppliedGraph.overlayEdge` overlays a wire edge onto an existing canvas
 * edge KEY BY KEY, applying only keys whose mapped value differs from the
 * mapper's derived default baseline. Flat keys ride that merge for free: a
 * wire edge carrying a belief but no weight applies `beliefExistsSource` and
 * leaves a local `weightSource: 'user'` untouched. A nested object would be
 * replaced wholesale and would silently drop the user's weight stamp.
 *
 * BACK-COMPAT READS (derive, don't assume)
 * ----------------------------------------
 * Graphs saved before this marker existed carry no stamps. Rather than let
 * every historical edge regress to "not set", the readers below also accept
 * producer-only raw fields as evidence of a real source:
 *   · `exists_probability` — written ONLY by CEE ingestion
 *     (`applyDraftResult` / `applyPatch` buildEdge; see the field trace in
 *     `analyticalNodeFields.ts`), so its presence proves a producer value.
 *   · `strength_mean` — CEE's pre-signed strength.
 * There is deliberately NO such fallback for a bare `weight` or `beliefExists`
 * number: those are exactly the fields the defaults fabricate.
 */

import { z } from 'zod'

/**
 * Where a set edge value came from.
 * - `user`     — the person editing this decision typed/dragged it
 * - `cee`      — a producer estimated it (CEE draft, graph_patch, starter capture)
 * - `template` — a blueprint/template author authored it for this template
 *
 * `template` is deliberately DISTINCT from `cee`: a template weight is a real
 * authored value (so it is not a fallthrough default) but it is not an estimate
 * of THIS user's decision. Surfaces may choose to qualify it; none may treat an
 * ABSENT marker as any of these.
 */
export const EdgeValueSourceEnum = z.enum(['user', 'cee', 'template'])
export type EdgeValueSource = z.infer<typeof EdgeValueSourceEnum>

/** The edge fields that carry a set-vs-defaulted marker. */
export const EDGE_PROVENANCED_FIELDS = ['beliefExists', 'weight'] as const
export type EdgeProvenancedField = (typeof EDGE_PROVENANCED_FIELDS)[number]

/** Marker key for a provenanced field, e.g. `beliefExists` → `beliefExistsSource`. */
export function edgeSourceKey(field: EdgeProvenancedField): 'beliefExistsSource' | 'weightSource' {
  return field === 'beliefExists' ? 'beliefExistsSource' : 'weightSource'
}

function asSource(value: unknown): EdgeValueSource | null {
  const parsed = EdgeValueSourceEnum.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Resolve where an edge field's value came from.
 *
 * Returns `null` when nothing proves the value was set — which is the state
 * every UI default lands in. Callers MUST treat `null` as "we do not know this
 * number" and never render it as a measurement.
 */
export function edgeValueSource(
  data: Record<string, unknown> | undefined | null,
  field: EdgeProvenancedField,
): EdgeValueSource | null {
  if (!data) return null

  const explicit = asSource(data[edgeSourceKey(field)])
  if (explicit) return explicit

  // Producer-only raw fields — back-compat evidence for graphs saved before
  // the marker existed. See the module header for why these two specifically.
  if (field === 'beliefExists' && typeof data.exists_probability === 'number') return 'cee'
  if (field === 'weight' && typeof data.strength_mean === 'number') return 'cee'

  return null
}

/** True when the field's value was set by someone rather than defaulted. */
export function isEdgeValueSet(
  data: Record<string, unknown> | undefined | null,
  field: EdgeProvenancedField,
): boolean {
  return edgeValueSource(data, field) !== null
}

/**
 * What a DISPLAY surface should render for one edge value.
 *
 * WHY A UNION RATHER THAN A PREDICATE
 * -----------------------------------
 * `isEdgeValueSet` is a predicate the caller must REMEMBER to consult, and a
 * tree-wide audit at staging tip `f4719d18c` found exactly two callers in
 * ~2,700 source files (`EdgePills.tsx:60`, `useNodeConnections.ts:62`). Every
 * other surface read `weight` / `beliefExists` raw and printed the UI default
 * as a measurement — "80% confident", a green 80% "Likelihood" bar, and in one
 * case a sentence sent to CEE asserting a strength nobody set.
 *
 * A predicate that ten surfaces forget to call is a hand-maintained mirror
 * wearing a helmet. So this accessor does not return a number at all unless it
 * can also name the source: there is NO shape of the return type that carries
 * a value without its provenance, which makes "render the default as fact" a
 * thing a surface cannot express by accident. Forgetting to handle
 * `show: false` is a type error, not a silent fabrication.
 *
 * This deliberately mirrors `resolveFactorConfidenceDisplay` in
 * `src/components/results/driverConfidenceDisplayPolicy.ts` — same problem,
 * same shape, so the two honesty lanes read alike.
 *
 * NOT FOR WIRE PAYLOADS. Adapters (`islRequestAdapter`, `plot/v2/adapter`)
 * legitimately need a number for every edge and keep using the raw
 * `computeSignedMean`; changing what goes ON THE WIRE is a numeric-behaviour
 * decision, explicitly out of scope here. This is the DISPLAY seam only.
 */
export type EdgeValueDisplay =
  | {
      show: false
      /**
       * `not_set` — no source proves this number; it is a UI default.
       *   Render the "Not set" affordance, never the number.
       * `absent`  — there is no number here at all.
       */
      reason: 'not_set' | 'absent'
    }
  | { show: true; value: number; source: EdgeValueSource }

/**
 * Resolve one edge value for display — THE read-side gate.
 *
 * Reads the same dual-field chain the rest of the canvas uses
 * (`beliefExists` then legacy `belief`) so it cannot disagree with
 * `getEdgeConfidence` about WHICH number is in play — only about whether that
 * number is fit to speak.
 */
export function resolveEdgeValueDisplay(
  data: Record<string, unknown> | undefined | null,
  field: EdgeProvenancedField,
): EdgeValueDisplay {
  if (!data) return { show: false, reason: 'absent' }

  const raw =
    field === 'beliefExists'
      ? typeof data.beliefExists === 'number'
        ? data.beliefExists
        : typeof data.belief === 'number'
          ? data.belief
          : undefined
      : typeof data.weight === 'number'
        ? data.weight
        : undefined

  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { show: false, reason: 'absent' }

  const source = edgeValueSource(data, field)
  if (source === null) return { show: false, reason: 'not_set' }

  return { show: true, value: raw, source }
}

/**
 * The band a display value falls in — for the NON-TEXT channels.
 *
 * WHY THIS EXISTS, GIVEN `EdgeValueDisplay` ALREADY DID
 * ----------------------------------------------------
 * #472/#473/#474 gated the NUMBER. They did not gate the CHANNELS that carry
 * the same claim without words. `EdgePanel.thresholdColor(v: number)` was the
 * proof: three branches, `>= 0.7 → green`, `>= 0.4 → amber`, else red, and NO
 * branch that could express "nobody set this". An edge with no `beliefExists`
 * fell through to `EDGE_CONSTRAINTS.beliefExists.default` (0.7) and rendered
 * GREEN, 70% — directly under the panel's own coaching sentence "Nobody has
 * said how likely this connection is to exist yet." Colour is read
 * pre-attentively and delivers a verdict ("this is fine") that nobody
 * consciously evaluates, so it is the stronger of the two claims on that
 * screen, and it was the false one.
 *
 * `unset` is therefore a FIRST-CLASS band, not a fallthrough. Because this
 * function takes an `EdgeValueDisplay` and NOT a `number`, a future caller
 * cannot reach a colour without first passing through the provenance gate:
 * there is no argument they can construct that means "0.7, source unknown".
 * That is the property `thresholdColor(v: number)` lacked, and the reason this
 * lives beside the union rather than as a conditional at the call site.
 *
 * Consumers map the band to their own channel tokens via a
 * `Record<EdgeValueBand, …>` (see `EdgePanel`), so ADDING a band is a type
 * error at every consumer rather than a silent inheritance of a neighbour's
 * colour — same rule as `STRENGTH_PROVENANCE_COPY` in `coachingConfig`.
 */
export type EdgeValueBand = 'unset' | 'low' | 'moderate' | 'high'

/**
 * Band cut points for the 0–1 probability channels (`beliefExists`).
 *
 * Named because they were a hand-copied literal in three places
 * (`EdgePanel.thresholdColor`, `EdgePanel.thresholdTrackVar`,
 * `RelationshipsSection.likelihoodColour`) — the mirror shape this codebase
 * keeps paying for. Cut on the RAW value, never on a rounded percentage.
 */
export const EDGE_VALUE_BAND_CUTS = { high: 0.7, moderate: 0.4 } as const

/** Which band a resolved display falls in. `show: false` ⇒ `unset`, always. */
export function edgeValueBand(display: EdgeValueDisplay): EdgeValueBand {
  if (!display.show) return 'unset'
  if (display.value >= EDGE_VALUE_BAND_CUTS.high) return 'high'
  if (display.value >= EDGE_VALUE_BAND_CUTS.moderate) return 'moderate'
  return 'low'
}

/**
 * Re-point a resolved display at the value a LIVE control is currently showing.
 *
 * An editing surface (the existence slider) holds the in-flight value in local
 * state, so the number on screen can lead the store by one debounce tick. The
 * colour must band the number the user is LOOKING AT, or the two channels
 * disagree — which is the whole defect, just smaller.
 *
 * The provenance verdict is deliberately NOT re-derived: `show: false` in ⇒
 * `show: false` out, unchanged. There is no argument to this function that can
 * turn an unsourced value into a sourced one, so it cannot be used — by
 * accident or otherwise — to launder a default into a claim.
 */
export function withLiveEdgeValue(display: EdgeValueDisplay, live: number): EdgeValueDisplay {
  if (!display.show) return display
  if (typeof live !== 'number' || !Number.isFinite(live)) return display
  return { ...display, value: live }
}

/**
 * Signed strength for display: magnitude from `weight`, sign from `direction`.
 *
 * Gated on `weight`'s provenance, because the DIRECTION defaults too
 * (`USER_EDGE_DEFAULTS.direction: 'positive'`) — rendering "Raises" for an edge
 * nobody characterised is the same fabrication as rendering "30%". A caller
 * that only has a defaulted weight gets `show: false` and must say nothing
 * about the sign either.
 *
 * Prefers CEE's pre-signed `strength_mean` when present, matching
 * `computeSignedMean`'s priority order.
 */
export function resolveEdgeSignedStrengthDisplay(
  data: Record<string, unknown> | undefined | null,
): EdgeValueDisplay {
  if (!data) return { show: false, reason: 'absent' }

  const source = edgeValueSource(data, 'weight')
  if (source === null) {
    const hasNumber =
      typeof data.strength_mean === 'number' || typeof data.weight === 'number'
    return { show: false, reason: hasNumber ? 'not_set' : 'absent' }
  }

  if (typeof data.strength_mean === 'number' && Number.isFinite(data.strength_mean)) {
    return { show: true, value: data.strength_mean, source }
  }
  if (typeof data.weight === 'number' && Number.isFinite(data.weight)) {
    const sign = data.direction === 'negative' || data.effect_direction === 'negative' ? -1 : 1
    return { show: true, value: sign * data.weight, source }
  }
  return { show: false, reason: 'absent' }
}

/**
 * Every marker key, DERIVED from the field list — never hand-listed.
 *
 * `DraftChat`'s CEE passthrough destructures the wire edge and spreads the
 * remainder (`...edgeRest`) over `DEFAULT_EDGE_DATA`. Its strip-list is a
 * hand-maintained literal (`style, curvature, kind, functionType,
 * beliefStrength, schemaVersion`) whose own comment says it exists to
 * "prevent collision with DEFAULT_EDGE_DATA values" — and the two marker keys
 * were never added to it. Because `edgeValueSourcePatch` OMITS a key it cannot
 * justify, a wire-supplied `weightSource` survived the spread in exactly the
 * case where the wire sent NO strength: the marker outlived the number it
 * described and laundered a default into a claim.
 *
 * Deriving the list from `EDGE_PROVENANCED_FIELDS` means adding a provenanced
 * field extends the strip automatically. This is the one thing a strip-list
 * must never be: a copy.
 */
export const EDGE_VALUE_SOURCE_KEYS = EDGE_PROVENANCED_FIELDS.map(edgeSourceKey)

/**
 * Remove every provenance marker from an untrusted record.
 *
 * Use on ANY object about to be spread into edge `data` from outside the
 * canvas. A marker is a claim about where a number came from; only a
 * construction site that knows the answer may write one.
 */
export function stripEdgeValueSourceKeys<T extends Record<string, unknown>>(
  record: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record }
  for (const key of EDGE_VALUE_SOURCE_KEYS) delete out[key]
  return out
}

/**
 * Build the marker patch for a construction site.
 *
 * Pass `undefined` for a field the wire/user did NOT supply — the key is then
 * OMITTED entirely rather than written as `undefined`, so spreading this patch
 * over an existing edge cannot erase a stamp that is already there.
 *
 * ```ts
 * data: { ...DEFAULT_EDGE_DATA, weight, beliefExists,
 *         ...edgeValueSourcePatch({ beliefExists: wireHadBelief ? 'cee' : undefined,
 *                                   weight: wireHadStrength ? 'cee' : undefined }) }
 * ```
 */
export function edgeValueSourcePatch(sources: {
  beliefExists?: EdgeValueSource
  weight?: EdgeValueSource
}): { beliefExistsSource?: EdgeValueSource; weightSource?: EdgeValueSource } {
  const patch: { beliefExistsSource?: EdgeValueSource; weightSource?: EdgeValueSource } = {}
  if (sources.beliefExists) patch.beliefExistsSource = sources.beliefExists
  if (sources.weight) patch.weightSource = sources.weight
  return patch
}
