/**
 * interventions — THE ONE reading of an option's intervention map.
 *
 * ⚠ MOVED HERE, NOT COPIED (18 Aug 2026, the REHOME → DELETE lane). The numeric
 * reader below used to be `extractInterventionNumeric`, a module-private helper
 * inside `components/model-tab/OptionsSection.tsx` — i.e. inside the editor
 * being removed. The canonical editor needs the identical reading, and the
 * three ways that could have gone wrong are the three this estate keeps paying
 * for:
 *
 *   · a second copy in `model-tab-v2/` would be trap 12 — two readings of one
 *     map, drifting, and the drift always reads as green;
 *   · `model-tab-v2/` importing from `components/model-tab/` would bind the
 *     canonical surface to the one scheduled for deletion, which is how a
 *     "deleted" editor survives as a dependency;
 *   · leaving it where it is and narrowing the canonical surface to the shared
 *     `unwrapInterventionValue` would SILENTLY DROP the legacy shapes below —
 *     a user whose option carries `raw_target` would watch their number become
 *     "Not stated" at the moment the old editor went away.
 *
 * So it moved to the layer both surfaces can depend on, and the delete step
 * inherits no hidden reader.
 */

import { unwrapInterventionValue } from '../utils/labelUtils'

/**
 * The numeric target an option sets for one factor, across every shape the
 * store has ever held.
 *
 * ⚠ THE CANONICAL PREDICATE IS TRIED FIRST AND IS NEVER WIDENED.
 * `unwrapInterventionValue` is shared with `flattenInterventions` and the PLoT
 * request edge, so a display can never consider a value usable that the WIRE
 * rejects. The fallbacks below run only where it returns nothing, and they
 * exist because real stored graphs carry these shapes — they are tolerance for
 * history, not a second opinion about what is valid.
 *
 * `undefined` means no number is stated. That is a fact to render as absence,
 * never a zero to invent.
 */
export function interventionTargetValue(raw: unknown): number | undefined {
  // Primary: the shared V3-shape unwrap (plain numbers, `{ value }` objects).
  const unwrapped = unwrapInterventionValue(raw).value
  if (unwrapped != null) return unwrapped

  // Fallback: numeric string.
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }

  // Fallback: legacy model-tab object shapes.
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (typeof obj.raw_target === 'number' && Number.isFinite(obj.raw_target)) return obj.raw_target
    if (typeof obj.target_value === 'number' && Number.isFinite(obj.target_value)) return obj.target_value
  }

  return undefined
}
