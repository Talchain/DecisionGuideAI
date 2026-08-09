/**
 * ROADMAP 2.973 — the NOT-MODELLED MANIFEST, parsed at the cold-read boundary.
 *
 * CEE derives this on `POST /bff/cee/scenarios/:id/graph` from the verbatim
 * `brief_text` it has persisted and the canonical graph it is returning. It
 * answers, for one scenario: *what of what I told you actually reached the
 * model?*
 *
 * ── THE ONE RULE THIS FILE EXISTS TO ENFORCE ───────────────────────────────
 * THREE DIFFERENT THINGS MUST NEVER COLLAPSE INTO EACH OTHER:
 *
 *   1. `null`                      — CEE sent no manifest. We know NOTHING.
 *   2. `status: "unavailable"`     — CEE looked and could not. Still nothing.
 *   3. `status: "derived", total:0`— CEE looked and there was nothing to check.
 *
 * Only (3) may ever be shown as reassurance. (1) is the live case for as long
 * as the deployed CEE predates this field, and a consumer that renders it as an
 * empty list tells every user their brief survived intact. The parser returns
 * `null` for anything it cannot vouch for, and the surface is required to treat
 * `null` as "we cannot tell you" — never as "nothing was dropped".
 */

/**
 * The plain-object guard comes from `lib/guards`, the repo's declared home for
 * it ("THIS FILE IS THE HOME, NOT THE MIGRATION"). This module used to carry a
 * private `asRecord` — one more copy of a predicate that already had several
 * definitions in `src/`, which is the hand-maintained mirror trap 12 names.
 * `isRecord` rather than `mappers/utils`'s `asObject`: the predicate form
 * NARROWS in place, so the call sites here need no `=== null` / `=== undefined`
 * dance at all, and `guards.ts` is the file the migration is converging on.
 * The predicate is byte-for-byte the same test the local copy performed, so
 * this is a deletion, not a behaviour change.
 */
import { isRecord } from '../../lib/guards'

export const NOT_MODELLED_SCHEMA = 'not_modelled.v1' as const

export type QuantityVerdict = 'in_model' | 'prose_only' | 'absent'

export type QuantityKind = 'money' | 'percent' | 'count' | 'date' | 'period'

export interface NotModelledItem {
  /** The user's own bytes. Rendered verbatim — never re-worded. */
  readonly literal: string
  readonly kind: QuantityKind
  /** Offset into `brief_text`. With `literal`, the item's IDENTITY. */
  readonly charOffset: number
  readonly verdict: QuantityVerdict
  /** The modelled quantity CEE matched this figure to, when matched
   *  numerically. Null for a text match or no match. Carried so a consumer can
   *  check the two sections against each other rather than trusting them. */
  readonly matchedNodeId: string | null
}

export interface NotModelledTally {
  readonly total: number
  readonly inModel: number
  readonly proseOnly: number
  readonly absent: number
  readonly truncated: boolean
  readonly items: readonly NotModelledItem[]
}

/**
 * What the DRAFTING MODEL ITSELF reported leaving out.
 *
 * ⚠ `none_reported` IS NOT `nothing was excluded`. On the trace corpus the
 * densest brief — 16 of 26 atoms dropped — reported an EMPTY list, because its
 * coaching pass produced nothing and no marker distinguishes "found none" from
 * "failed". The three states must never be collapsed in copy.
 */
export interface DeclaredExclusions {
  readonly status: 'reported' | 'none_reported' | 'not_recorded'
  /** The model's own sentences, VERBATIM. Rendered, never re-worded. */
  readonly items: readonly string[]
}

/** A factor carrying a figure the user never stated — the product supplied it. */
export interface InferredFactor {
  readonly nodeId: string
  /** The human label. Never the encoded value: CEE's own `display_value`
   *  reads like "0.31 to 0.93" with no unit and means nothing to a reader. */
  readonly label: string
}

export interface InferredFactors {
  readonly status: 'derived' | 'not_recorded'
  readonly items: readonly InferredFactor[]
}

function parseInferredFactors(raw: unknown): InferredFactors {
  if (!isRecord(raw)) return { status: 'not_recorded', items: [] }
  const o = raw
  if (o.status !== 'derived' && o.status !== 'not_recorded') {
    return { status: 'not_recorded', items: [] }
  }
  const items: InferredFactor[] = []
  if (Array.isArray(o.items)) {
    for (const r of o.items) {
      if (!isRecord(r)) continue
      const i = r
      if (typeof i.node_id !== 'string' || typeof i.label !== 'string') continue
      if (i.label.length === 0) continue
      items.push({ nodeId: i.node_id, label: i.label })
    }
  }
  return { status: o.status, items }
}

export interface NotModelledManifest {
  readonly status: 'derived' | 'unavailable'
  readonly unavailableReason: string | null
  /** `null` whenever the manifest is not `derived`. Never a zeroed tally. */
  readonly quantities: NotModelledTally | null
  readonly declaredExclusions: DeclaredExclusions
  readonly inferredFactors: InferredFactors
  /** Loss classes the derivation cannot observe. Always shown with findings. */
  readonly notTracked: readonly string[]
}

const EXCLUSION_STATUSES: ReadonlySet<string> = new Set([
  'reported',
  'none_reported',
  'not_recorded',
])

/** Unparseable or absent ⇒ `not_recorded`: we were told nothing, which is the
 *  honest reading and the one that promises the user least. */
function parseDeclaredExclusions(raw: unknown): DeclaredExclusions {
  if (!isRecord(raw)) return { status: 'not_recorded', items: [] }
  const o = raw
  if (typeof o.status !== 'string' || !EXCLUSION_STATUSES.has(o.status)) {
    return { status: 'not_recorded', items: [] }
  }
  const items = Array.isArray(o.items)
    ? o.items.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : []
  return { status: o.status as DeclaredExclusions['status'], items }
}

const VERDICTS: ReadonlySet<string> = new Set(['in_model', 'prose_only', 'absent'])
const KINDS: ReadonlySet<string> = new Set(['money', 'percent', 'count', 'date', 'period'])

function parseItem(raw: unknown): NotModelledItem | null {
  if (!isRecord(raw)) return null
  const { literal, kind, char_offset: charOffset, verdict, matched_node_id: matchedNodeId } = raw
  if (typeof literal !== 'string' || literal.length === 0) return null
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null
  if (typeof charOffset !== 'number' || !Number.isInteger(charOffset) || charOffset < 0) return null
  if (typeof verdict !== 'string' || !VERDICTS.has(verdict)) return null
  if (matchedNodeId !== null && matchedNodeId !== undefined && typeof matchedNodeId !== 'string') {
    return null
  }
  return {
    literal,
    kind: kind as QuantityKind,
    charOffset,
    verdict: verdict as QuantityVerdict,
    matchedNodeId: typeof matchedNodeId === 'string' ? matchedNodeId : null,
  }
}

/**
 * Parse CEE's `not_modelled` block.
 *
 * Returns `null` — meaning "we cannot tell you" — for an absent field, a
 * foreign schema discriminator, or any shape that fails to validate. It never
 * substitutes a default, because every available default is a false statement
 * about the user's own words.
 */
export function parseNotModelled(raw: unknown): NotModelledManifest | null {
  if (!isRecord(raw)) return null
  const o = raw
  if (o.schema !== NOT_MODELLED_SCHEMA) return null

  const notTracked = Array.isArray(o.not_tracked)
    ? o.not_tracked.filter((s): s is string => typeof s === 'string')
    : []

  if (o.status === 'unavailable') {
    return {
      status: 'unavailable',
      unavailableReason:
        typeof o.unavailable_reason === 'string' ? o.unavailable_reason : null,
      quantities: null,
      declaredExclusions: parseDeclaredExclusions(o.declared_exclusions),
      inferredFactors: parseInferredFactors(o.inferred_factors),
      notTracked,
    }
  }

  if (o.status !== 'derived') return null

  // `derived` promises a tally. A derived manifest without one contradicts
  // itself, and we do not guess which half was true.
  if (!isRecord(o.quantities)) return null
  const q = o.quantities

  const rawItems = Array.isArray(q.items) ? q.items : []
  const items: NotModelledItem[] = []
  for (const r of rawItems) {
    const item = parseItem(r)
    // One malformed item would make the list silently short — the same lie as
    // an empty one, wearing a partial disguise.
    if (item === null) return null
    items.push(item)
  }

  const nums = ['total', 'in_model', 'prose_only', 'absent'] as const
  for (const k of nums) {
    if (typeof q[k] !== 'number' || !Number.isInteger(q[k]) || (q[k] as number) < 0) return null
  }

  return {
    status: 'derived',
    unavailableReason: null,
    quantities: {
      total: q.total as number,
      inModel: q.in_model as number,
      proseOnly: q.prose_only as number,
      absent: q.absent as number,
      truncated: q.truncated === true,
      items,
    },
    declaredExclusions: parseDeclaredExclusions(o.declared_exclusions),
    inferredFactors: parseInferredFactors(o.inferred_factors),
    notTracked,
  }
}
