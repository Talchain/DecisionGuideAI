/**
 * `_grounded_selection` — the READER for CEE's selection-aware answering
 * sidecar (hop 4b).
 *
 * WHAT THIS TELLS THE CANVAS, and it is the only thing it tells it:
 *
 *   > The elements THIS turn's answer was grounded on.
 *
 * The user selects a node, asks "why does this one matter?", and the answer
 * comes back naming it. Until now they then had to find that node themselves —
 * which is precisely the shared-visual-model gap the programme exists to close.
 * With this the canvas points at it.
 *
 * ⚠ WHY THE VALUE LIVES IN `__additive__` AND NOT ON THE TYPED RESPONSE.
 * `OlumiResponseSchema` is `.strict()` at the vendored 0.40.0 pin, so CEE ships
 * this as an underscore-prefixed PRODUCT sidecar (the documented `_reasoning` /
 * `_answer_shape` mechanic: stripped before egress validation, re-attached
 * after). `responseParser` demotes every undeclared root key into the
 * non-enumerable `ADDITIVE_EXTENSIONS_KEY` sidecar, so that is where it lands —
 * the same read `useConversation` already performs for `_reasoning`.
 *
 * ⭐ EVERY FIELD IS RE-VALIDATED HERE, not trusted. The sidecar bypasses the
 * strict schema by construction, so this module IS the boundary: nothing
 * downstream sees a value that did not survive these checks. A malformed
 * payload yields `null` — no highlight — never a partial or coerced one.
 */
import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'

/**
 * Why elements the user pointed at are missing from `nodeIds`.
 *
 * ⭐ `not_in_model` AND `could_not_check` MUST NOT COLLAPSE, and this type is
 * where the UI inherits that obligation.
 *
 *   · `none`            — everything the turn pointed at resolved.
 *   · `not_in_model`    — the graph WAS read and does not contain it. Showing
 *                         nothing for it is honest.
 *   · `could_not_check` — the graph could NOT be read, so we do not know
 *                         whether it is there. Rendering this as "not found"
 *                         would tell the user their node is gone on the
 *                         strength of a failed lookup — reintroducing at the
 *                         pixel layer exactly the conflation CEE's hop 3 and
 *                         hop 4 were designed to keep apart.
 */
export type GroundedUnresolved = 'none' | 'not_in_model' | 'could_not_check'

const UNRESOLVED_VALUES: ReadonlySet<string> = new Set<GroundedUnresolved>([
  'none',
  'not_in_model',
  'could_not_check',
])

export interface GroundedSelection {
  /**
   * Canonical canvas ids, in the order the turn requested them. EMPTY is
   * meaningful: the turn pointed at something and nothing resolvable came
   * back — read `unresolved` to learn why, and never infer "not found" from
   * emptiness alone.
   */
  readonly nodeIds: readonly string[]
  readonly unresolved: GroundedUnresolved
}

/** The wire key. Underscore-prefixed: it is a sidecar, not a schema field. */
export const GROUNDED_SELECTION_KEY = '_grounded_selection' as const

/**
 * Read and validate the sidecar off a parsed V5 response.
 *
 * @returns the grounded selection, or `null` when this turn was not grounded
 *   on a selection (the overwhelmingly common case — every turn taken without
 *   a canvas selection) or when the payload is malformed.
 *
 * Returning `null` for both is deliberate and safe: the consumer's response to
 * `null` is to CLEAR any previous grounding, and clearing is the correct
 * behaviour for a turn we cannot vouch for just as much as for one that
 * carried nothing.
 */
export function readGroundedSelection(response: unknown): GroundedSelection | null {
  if (response === null || typeof response !== 'object') return null
  const additive = (response as Record<string, unknown>)[ADDITIVE_EXTENSIONS_KEY]
  if (additive === null || typeof additive !== 'object') return null
  const raw = (additive as Record<string, unknown>)[GROUNDED_SELECTION_KEY]
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null

  const record = raw as Record<string, unknown>

  // The enum is validated against the CLOSED set rather than merely checked
  // for being a string: an unrecognised value would otherwise flow through to
  // the notice logic, where "not one of the three" would be silently treated
  // as "not could_not_check" — i.e. it would fail toward the reassuring
  // reading. Fail closed instead.
  const unresolved = record.unresolved
  if (typeof unresolved !== 'string' || !UNRESOLVED_VALUES.has(unresolved)) return null

  const ids = record.element_ids
  if (!Array.isArray(ids)) return null
  // Element-wise, not `every(...)` over the array as a whole: one malformed
  // entry invalidates the payload rather than being quietly skipped, because a
  // partial highlight is indistinguishable from a complete one on screen and
  // the user would have no way to know which they were looking at.
  const nodeIds: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) return null
    nodeIds.push(id)
  }

  return { nodeIds, unresolved: unresolved as GroundedUnresolved }
}
