/**
 * The user's stated range for a factor, as the canvas card says it — or `null`.
 *
 * Run-4 judge B3 (DL 12 Oct; §7.3 witness row "a stated range kept, with any derived value identified"): CEE stores the
 * range a person stated (`observed_state.range`: `{low, high, source, meaning}`) beside the value it derived from it
 * (hiring: "between 20% and 30%" → range 20–30, value 25). The card printed only the value. It now also says the range,
 * marked as theirs: "20%–30% of monthly team capacity (your range)".
 *
 * ⚠ ONLY A RANGE THE USER AUTHORED. "your range" is said only where the range's own `source` says the user wrote it:
 * their edit (kind `edited`) or their brief (kind `brief`), read through `classifyObservedValueProvenance` (the helper
 * `factorPriorRange` uses for "Your value"). F UI check round 1 (DL 12 Oct): being user-OWNED is not enough. A confirmed
 * range (`user_confirmed`) is Olumi's figure that the user endorsed; confirming does not make them its author
 * (`valueProvenance.ts`, "CONFIRMED AND EDITED ARE DIFFERENT CLAIMS"). `human` does not say which act. A bare
 * `user_assumption` is also CEE's stamp for an adopted Olumi estimate, and a range carries no `reviewed_by_user` to tell
 * the two apart. `accepted`, `panel`, `unverified_brief` and Olumi's own range (`ai`) are not the user's words either.
 * None of these gets a line here.
 *
 * ⚠ THE SAME WORDS AS THE VALUE LINE. Both ends go through `factorDisplayParts` / `factorDisplayText`, the formatter the
 * card's value line uses, on the node's own data with only `raw_value` swapped for the end. No number is formatted here.
 */
import { classifyObservedValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'
import { factorDisplayParts, factorDisplayText } from '../../../utils/formatFactorDisplayValue'

export const STATED_RANGE_YOURS = '(your range)'

/** The provenance kinds that mean the user AUTHORED the range: they typed it, or it came from their brief. */
const USER_AUTHORED_RANGE_KINDS: ReadonlySet<ValueProvenanceKind> = new Set<ValueProvenanceKind>(['edited', 'brief'])

export function resolveFactorStatedRangeOnCard(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const obs = d.observedState
  if (obs === null || typeof obs !== 'object') return null
  const range = (obs as { range?: unknown }).range
  if (range === null || typeof range !== 'object') return null
  const { low, high } = range as { low?: unknown; high?: unknown }
  if (typeof low !== 'number' || typeof high !== 'number' || !Number.isFinite(low) || !Number.isFinite(high)) return null
  const provenance = classifyObservedValueProvenance(range)
  if (provenance === null || !USER_AUTHORED_RANGE_KINDS.has(provenance.kind)) return null

  // The node's own data with the end as its raw value: no authored display string and no pending keystroke may stand in.
  const at = (end: number) => ({
    ...d, display_value: undefined, pending_user_value: undefined,
    observedState: { ...(obs as Record<string, unknown>), raw_value: end },
  })
  const lo = factorDisplayParts(at(low))
  const hi = factorDisplayParts(at(high))
  if (lo !== null && hi !== null && lo.unit === hi.unit) {
    return `${lo.figure}–${hi.figure}${lo.unit ? ` ${lo.unit}` : ''} ${STATED_RANGE_YOURS}`
  }
  const loText = factorDisplayText(at(low))
  const hiText = factorDisplayText(at(high))
  return loText !== null && hiText !== null ? `${loText} to ${hiText} ${STATED_RANGE_YOURS}` : null
}
