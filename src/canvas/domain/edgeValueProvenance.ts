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
