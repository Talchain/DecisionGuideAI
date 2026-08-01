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

/**
 * The edge fields that carry a set-vs-defaulted marker.
 *
 * ⚠ THIS ARRAY IS THE REGISTRY. A field missing from it is not "unprotected at
 * one call site" — it is a field for which the mechanism does not exist, so no
 * consumer can gate it even if it wants to. `strengthStd` was exactly that gap:
 * `USER_EDGE_DEFAULTS.strengthStd = 0.15` fabricates an uncertainty on every
 * user-drawn edge, and `KeyRelationships.getConfidenceBand` painted it as a
 * "Moderate confidence" dot with no way to ask where it came from.
 *
 * Adding a field here extends `EdgeValueSourceKey`, `EDGE_VALUE_SOURCE_KEYS`
 * (the strip list) and `edgeValueSourcePatch`'s argument type automatically —
 * see `edgeSourceKey` below. Nothing about a provenanced field is hand-listed.
 */
export const EDGE_PROVENANCED_FIELDS = ['beliefExists', 'weight', 'strengthStd', 'direction'] as const
export type EdgeProvenancedField = (typeof EDGE_PROVENANCED_FIELDS)[number]

/**
 * The provenanced fields whose value is a NUMBER.
 *
 * `direction` joined the registry (ROADMAP 2.263) because it defaults exactly
 * like the numbers do — `USER_EDGE_DEFAULTS.direction: 'positive'`, and both
 * draft ingestion paths fall through to `'positive'` when the producer states
 * nothing — but it is an ENUM, not a number. `resolveEdgeValueDisplay` and the
 * band/ordering helpers below all do `typeof data[field] === 'number'`, so
 * handing them `'direction'` would silently resolve to `absent` FOREVER and
 * read as "this edge has no direction" on an edge that has one.
 *
 * Narrowing their parameter to this type makes that a COMPILE error instead:
 * `resolveEdgeValueDisplay(data, 'direction')` does not typecheck. Direction
 * has its own resolver — `resolveEdgeDirectionDisplay` — and the type system
 * is what routes callers to it, rather than a comment they might not read.
 */
export type EdgeNumericProvenancedField = Exclude<EdgeProvenancedField, 'direction'>

/**
 * The runtime companion to `EdgeNumericProvenancedField`, DERIVED by filtering
 * the registry — never a second hand-typed list. Specs that exercise the
 * numeric display resolver iterate this, so adding a numeric field extends
 * their coverage automatically while a non-numeric one cannot leak in.
 */
export const EDGE_NUMERIC_PROVENANCED_FIELDS = EDGE_PROVENANCED_FIELDS.filter(
  (f): f is EdgeNumericProvenancedField => f !== 'direction',
)

/**
 * The marker key for a provenanced field, DERIVED from its name.
 *
 * Was a hand-written ternary returning a hand-written union
 * (`'beliefExistsSource' | 'weightSource'`) — a two-entry mirror of the array
 * above, and adding a third field to the array would have silently mapped it
 * to `'weightSource'` (the ternary's else branch) rather than failing. The
 * template-literal type makes the union a projection of the registry, so the
 * two cannot drift.
 */
export type EdgeValueSourceKey = `${EdgeProvenancedField}Source`

/** Marker key for a provenanced field, e.g. `beliefExists` → `beliefExistsSource`. */
export function edgeSourceKey(field: EdgeProvenancedField): EdgeValueSourceKey {
  return `${field}Source`
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
  // `direction` — `effect_direction` is the raw CEE wire spelling and NOTHING in
  // the UI fabricates it: neither `DEFAULT_EDGE_DATA` nor `USER_EDGE_DEFAULTS`
  // defines it, and no inspector setter writes it. It reaches `data` only from a
  // producer (`DraftChat`'s `edgeRest` passthrough, `applyV5State`'s graph_patch
  // spread, `adapters/cee/client`). Its presence therefore PROVES a producer
  // stated a direction — the same argument as `exists_probability` above.
  //
  // `'unknown'` is deliberately NOT evidence: it is the producer declining to
  // state one, which `resolveEdgeDirectionDisplay` reports as its own reason.
  if (
    field === 'direction' &&
    (data.effect_direction === 'positive' || data.effect_direction === 'negative')
  ) {
    return 'cee'
  }
  // `strengthStd` has NO back-compat fallback. `DraftChat` destructures
  // `strength_std` OUT of its passthrough spread and `applyDraftResult` never
  // writes it, so no producer-only raw std survives into edge `data` to serve
  // as evidence — while `USER_EDGE_DEFAULTS` DOES fabricate `strengthStd:
  // 0.15`. Inventing a fallback here would launder that default, which is the
  // one failure mode this module exists to make impossible.

  return null
}

/* ════════════════════════════════════════════════════════════════════════════
 * DIRECTION — the claim that survived every previous sweep (ROADMAP 2.263)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `@talchain/schemas` 0.30.0 declares
 *     effect_direction: z.ZodOptional<z.ZodEnum<["positive","negative","unknown"]>>
 * so the producer has THREE ways to say "I am not telling you the direction":
 * omit the field, send `'unknown'`, or send a value we do not recognise. The UI
 * collapsed all three to `'positive'` at both ingestion sites and then three
 * Model-tab consumers re-collapsed independently, so the user read
 * **"Strong positive effect"** on an edge whose producer declined to state a
 * direction. That is the ROADMAP 2.234 defect class — a false scientific claim
 * — on the surface whose entire job is trust.
 *
 * The rules are `src/lib/factorDirection.ts`'s, applied to EDGES:
 *   1. NEVER INFER DIRECTION FROM A MAGNITUDE. A sign on a number nobody
 *      characterised is not evidence; `strengthBands.getStrengthLabel` used to
 *      do exactly this (`mean >= 0 ? 'positive' : 'negative'`).
 *   2. ABSENCE STAYS ABSENCE.
 *   3. AN UNRECOGNISED VALUE FAILS CLOSED.
 *   4. ONE OWNER. This resolver is it.
 *
 * ⚠ WHY THIS IS A READ-SIDE GATE AND NOT AN INGESTION REWRITE — the seam was
 * derived, not assumed. The stored `direction` field is PERSISTENCE-BEARING
 * (`autosaveProjection` → `scenarios` localStorage and `buildPersistedGraph` →
 * the Supabase `scenarios.graph` JSONB both serialise `edge.data` VERBATIM with
 * no allowlist) and STALENESS-BEARING (`analyticalNodeFields.ts` registers
 * `direction` with `purposes: ['stale']`, so a change to it marks the analysis
 * stale). It is also read as a SIGN by four outbound adapters. Changing what
 * ingestion STORES would therefore move persisted bytes, outbound bytes and a
 * freshness verdict all at once.
 *
 * So ingestion keeps writing `direction` byte-for-byte as before, and instead
 * records ONE additive fact it was throwing away: whether the producer actually
 * said so. Everything downstream of the store — hash, persistence, wire, canvas
 * stroke, pre-run validation — is unchanged by construction, and the display
 * surfaces gain the ability to tell a stated direction from a defaulted one,
 * which after the old collapse they could not do even in principle.
 */

/**
 * What a DISPLAY surface should render for an edge's direction.
 *
 * Mirrors `EdgeValueDisplay`'s shape deliberately: there is no member of this
 * union that carries a direction without also naming its source, so "render the
 * default as fact" is not expressible. Forgetting to handle `show: false` is a
 * type error rather than a silent fabrication.
 */
export type EdgeDirectionDisplay =
  | { show: true; direction: 'positive' | 'negative'; source: EdgeValueSource }
  | {
      show: false
      /**
       * `unknown`  — the producer EXPLICITLY declined (`effect_direction:
       *              'unknown'`, a declared 0.30.0 contract member).
       * `not_set`  — a direction value is present but nothing proves anyone set
       *              it; it is the `'positive'` UI default.
       * `absent`   — there is no direction on this edge at all.
       */
      reason: 'unknown' | 'not_set' | 'absent'
    }

/**
 * Resolve an edge's direction for display — THE read-side gate.
 *
 * Order matters. An explicit `'unknown'` is checked FIRST because it is the one
 * case where the producer said something definite, and it must not be masked by
 * the defaulted `direction: 'positive'` sitting beside it on the same edge.
 */
export function resolveEdgeDirectionDisplay(
  data: Record<string, unknown> | undefined | null,
): EdgeDirectionDisplay {
  if (!data) return { show: false, reason: 'absent' }

  // The producer explicitly declined to state a direction. Beats everything.
  if (data.effect_direction === 'unknown') return { show: false, reason: 'unknown' }

  const raw = data.direction ?? data.effect_direction
  const hasValue = raw !== undefined && raw !== null

  const source = edgeValueSource(data, 'direction')
  if (source === null) return { show: false, reason: hasValue ? 'not_set' : 'absent' }

  // Rule 3: an unrecognised value fails closed, even with a source stamp.
  if (raw !== 'positive' && raw !== 'negative') return { show: false, reason: 'absent' }

  return { show: true, direction: raw, source }
}

/**
 * The direction encoded in a producer's PRE-SIGNED mean.
 *
 * ⚠ READ THIS BEFORE USING IT. This is NOT an exception to rule 1. The rule
 * bans reading a direction off a magnitude the UI itself signed — which is what
 * `resolveEdgeSignedStrengthDisplay` produces, because it applies a sign taken
 * from the very `direction` field whose provenance is in question, so asking it
 * for the direction back is circular.
 *
 * A CEE validator pass mean (`validation.pass1.strength_mean`) is different in
 * kind: the producer signed it, the sign IS the producer's stated direction,
 * and there is no separate direction field for that pass to consult. Using it
 * is reading the producer, not inferring from a magnitude.
 *
 * Only call this on a number a PRODUCER signed. If you are holding a value the
 * UI signed, you want `resolveEdgeDirectionDisplay`.
 */
export function directionFromProducerSignedMean(mean: number): EdgeDirectionDisplay {
  if (typeof mean !== 'number' || !Number.isFinite(mean)) {
    return { show: false, reason: 'absent' }
  }
  return { show: true, direction: mean >= 0 ? 'positive' : 'negative', source: 'cee' }
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
  // NUMERIC fields only — see `EdgeNumericProvenancedField`. Passing
  // `'direction'` is a compile error, not a silent permanent `absent`.
  field: EdgeNumericProvenancedField,
): EdgeValueDisplay {
  if (!data) return { show: false, reason: 'absent' }

  const raw =
    field === 'beliefExists'
      ? typeof data.beliefExists === 'number'
        ? data.beliefExists
        : typeof data.belief === 'number'
          ? data.belief
          : undefined
      : typeof data[field] === 'number'
        ? (data[field] as number)
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
    // ⚠ THIS SIGN IS NOT A DIRECTION CLAIM, AND NOTHING MAY READ IT AS ONE.
    //
    // An unstated direction lands here as `+1`, so the returned number is a
    // MAGNITUDE that happens to be positive — not a verdict that the effect is
    // positive. Its consumers use it for stroke width and for the printed
    // scalar, both of which want `Math.abs` anyway.
    //
    // The numeric contract is deliberately UNCHANGED by ROADMAP 2.263: this
    // value is read by the canvas (`StyledEdge` stroke), `EdgePills` and
    // `ConnectionRow`, so re-signing it would repaint the canvas from a lane
    // scoped to the Model tab. Instead the DIRECTION CLAIM moved to
    // `resolveEdgeDirectionDisplay`, and the surfaces that used to re-derive a
    // direction from this sign (`strengthBands.getStrengthLabel`, the
    // Relationships +/− prefix and its success/danger colour) now ask that
    // resolver instead.
    //
    // Known survivor, out of this lane's scope and rowed: `EdgePills.tsx:71`
    // still does `direction: signed >= 0 ? 'up' : 'down'` off this value.
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
export function edgeValueSourcePatch(
  sources: Partial<Record<EdgeProvenancedField, EdgeValueSource>>,
): Partial<Record<EdgeValueSourceKey, EdgeValueSource>> {
  const patch: Partial<Record<EdgeValueSourceKey, EdgeValueSource>> = {}
  for (const field of EDGE_PROVENANCED_FIELDS) {
    const source = sources[field]
    if (source) patch[edgeSourceKey(field)] = source
  }
  return patch
}

/* ════════════════════════════════════════════════════════════════════════════
 * ORDERING — the channel that has no words at all
 * ════════════════════════════════════════════════════════════════════════════
 *
 * #472–#476 gated the NUMBER and then the COLOUR. Neither touched ORDER, which
 * is the quietest channel and in one case the most consequential: the "Top gap:
 * validate X" line on the decision node ranks factors by a sum of edge weights
 * and then TELLS THE USER WHICH FACTOR TO GO FIX. Every contribution to that
 * sum was `weight ?? 0.5`, so on a graph where nobody had set a single strength
 * the recommendation was decided by a constant — i.e. by node iteration order.
 *
 * The recurring shape at the leaking sites was a SENTINEL:
 *
 *     const aWeight = aData?.weight != null ? aData.weight : -Infinity
 *
 * which is wrong three times over:
 *  1. It is TAUTOLOGICAL — `USER_EDGE_DEFAULTS`/`DEFAULT_EDGE_DATA` always
 *     define `weight`, so the `-Infinity` arm is dead and every defaulted edge
 *     ranks as a measured one. Same dead-branch shape as the two defects
 *     already fixed in `OutcomeNode` and `RelationshipsSection`.
 *  2. The sentinel's SIGN hand-compensates for the sort direction
 *     (`ModelTabBody` uses `+Infinity` for an ascending key and `-Infinity` for
 *     a descending one, two lines apart). That is a mirror: flip the order and
 *     "unset last" silently becomes "unset first".
 *  3. A sentinel is a number, so it composes with arithmetic. `-Infinity`
 *     inside a `reduce` poisons a whole aggregate.
 *
 * So ordering gets the same treatment as colour: helpers that take
 * `EdgeValueDisplay` and never a bare `number`, with "unset" as an explicit
 * position rather than an extreme value.
 */

/**
 * Compare two resolved edge values for sorting. **Unset always sorts last**,
 * whichever direction `order` requests.
 *
 * That asymmetry is deliberate and is the reason this is not a subtraction.
 * "We do not know this number" is not a small number or a large one; it is not
 * on the scale at all, so it cannot be expressed as a sentinel that flips with
 * the comparator. Reversing the sort must not promote the values nobody set.
 */
export function compareEdgeValueDisplays(
  a: EdgeValueDisplay,
  b: EdgeValueDisplay,
  order: 'asc' | 'desc' = 'desc',
): number {
  if (!a.show && !b.show) return 0
  if (!a.show) return 1
  if (!b.show) return -1
  return order === 'asc' ? a.value - b.value : b.value - a.value
}

/**
 * An aggregate (a sum/rank) built from several edge values.
 *
 * Same discriminated shape as `EdgeValueDisplay`, so forgetting to handle "no
 * evidence" is a type error rather than a rank derived from nothing. The counts
 * are carried because a PARTIAL aggregate is a real state: a factor with two
 * sourced edges and three defaulted ones has some leverage evidence, and a
 * surface may legitimately want to qualify or exclude it.
 */
export type EdgeValueAggregate =
  | {
      show: false
      /** `not_set` — numbers were present, none sourced. `absent` — nothing to sum. */
      reason: 'not_set' | 'absent'
    }
  | { show: true; value: number; sourcedCount: number; unsourcedCount: number }

/**
 * Sum the SOURCED signed strengths of a set of edges; ignore the rest.
 *
 * An edge whose strength nobody set contributes NOTHING — not `0.5`, not `0`
 * dressed up as a measurement. It is counted in `unsourcedCount` so the caller
 * can see the aggregate is partial, and if no edge is sourced the result is
 * `show: false` and the caller must not rank on it at all.
 *
 * `magnitude: true` sums `|signed|` — for "how much does this factor matter",
 * where a strong negative influence is as important as a strong positive one.
 */
export function aggregateEdgeSignedStrength(
  edgeData: Iterable<Record<string, unknown> | undefined | null>,
  opts: { magnitude?: boolean } = {},
): EdgeValueAggregate {
  let value = 0
  let sourcedCount = 0
  let unsourcedCount = 0

  for (const data of edgeData) {
    const display = resolveEdgeSignedStrengthDisplay(data)
    if (display.show) {
      value += opts.magnitude ? Math.abs(display.value) : display.value
      sourcedCount += 1
    } else {
      unsourcedCount += 1
    }
  }

  if (sourcedCount === 0) {
    return { show: false, reason: unsourcedCount > 0 ? 'not_set' : 'absent' }
  }
  return { show: true, value, sourcedCount, unsourcedCount }
}

/**
 * Compare two aggregates. **Unset always sorts last**, as above.
 *
 * Split from `compareEdgeValueDisplays` rather than widened to a union because
 * the two carry different evidence and a caller should not be able to sort an
 * aggregate against a single value by accident.
 */
export function compareEdgeValueAggregates(
  a: EdgeValueAggregate,
  b: EdgeValueAggregate,
  order: 'asc' | 'desc' = 'desc',
): number {
  if (!a.show && !b.show) return 0
  if (!a.show) return 1
  if (!b.show) return -1
  return order === 'asc' ? a.value - b.value : b.value - a.value
}
