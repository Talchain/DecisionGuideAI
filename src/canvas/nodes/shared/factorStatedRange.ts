/**
 * The user's stated range for a factor, as the canvas card says it — or `null`.
 *
 * Run-4 judge B3 (DL 12 Oct; §7.3 witness row "a stated range kept, with any derived value identified"): CEE stores the
 * range a person stated (`observed_state.range`: `{low, high, source, meaning}`) beside the value it derived from it
 * (hiring: "between 20% and 30%" → range 20–30, value 25). The card printed only the value. It now also says the range,
 * marked as theirs: "20%–30% of monthly team capacity (your range)".
 *
 * ⚠ ONLY A RANGE THE USER AUTHORED. "your range" is said only where the range's own `source` says the user wrote it:
 * kind `edited`, read through `classifyObservedValueProvenance` (the helper `factorPriorRange` uses for "Your value").
 * CEE writes the user's own range (from their brief, or a later sentence) as `USER_TODAY_SOURCE` = `user_override`
 * (admit-model.ts `withStatedLevelRange`, add-factor-transaction.ts, agent-capabilities.ts; CEE staging a770ce49). On a
 * factor's range, `brief_extraction` is a THIRD PARTY's range quoted in the brief, carried with the quote naming that
 * party (`briefAttributedLevelRange`, which accepts only attributed sentences), so kind `brief` is not "your range".
 * F UI check round 1 (DL 12 Oct): being user-OWNED is not enough either. A confirmed
 * range (`user_confirmed`) is Olumi's figure that the user endorsed; confirming does not make them its author
 * (`valueProvenance.ts`, "CONFIRMED AND EDITED ARE DIFFERENT CLAIMS"). `human` does not say which act. A bare
 * `user_assumption` is also CEE's stamp for an adopted Olumi estimate, and a range carries no `reviewed_by_user` to tell
 * the two apart. `accepted`, `panel`, `brief`, `unverified_brief` and Olumi's own range (`ai`) are not the user's own
 * range either.
 * None of these gets a line here.
 *
 * ⚠ THE SAME WORDS AS THE VALUE LINE. Both ends go through `factorDisplayParts` / `factorDisplayText`, the formatter the
 * card's value line uses, on the node's own data with only `raw_value` swapped for the end. No number is formatted here.
 */
import { classifyObservedValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'
import { factorDisplayParts, factorDisplayText, joinFactorDisplayParts } from '../../../utils/formatFactorDisplayValue'

export const STATED_RANGE_YOURS = '(your range)'

/** The provenance kinds that mean the user AUTHORED the range (CEE's `user_override`, the client's typed stamps). */
const USER_AUTHORED_RANGE_KINDS: ReadonlySet<ValueProvenanceKind> = new Set<ValueProvenanceKind>(['edited'])

export function resolveFactorStatedRangeOnCard(data: unknown): string | null {
  const stored = readStoredRange(data)
  if (stored === null) return null
  const provenance = classifyObservedValueProvenance(stored.range)
  if (provenance === null || !USER_AUTHORED_RANGE_KINDS.has(provenance.kind)) return null
  const body = formatStoredRange(stored)
  return body === null ? null : `${body} ${STATED_RANGE_YOURS}`
}

/**
 * ⭐ THE STORED BOUNDS, SAID NEUTRALLY: "Range: 20%–30% of monthly team capacity" — or `null`.
 *
 * DL ruling (12 Oct, after run 5; AIE #94 6132247742): the canvas card shows a factor's stored `observed_state.range`
 * whatever its `source`, with NO attribution. The record cannot yet prove whose range it is: CEE stamps a confirmed
 * third-party range `user_override` (independent check round 2, #2748), so "your range" waits for CEE's attribution fix,
 * and a range with no human evidence is not thereby Olumi's, so there is no Olumi label either. The words are the card's
 * existing "Range: …" (the prior-range line's own prefix), through the value line's formatter and the shared joiner.
 * The card shows this line only when its prior-range line is not shown, so one card never states two ranges.
 */
export function resolveFactorStoredRangeLine(data: unknown): string | null {
  const stored = readStoredRange(data)
  const body = stored === null ? null : formatStoredRange(stored)
  return body === null ? null : `${STORED_RANGE_PREFIX} ${body}`
}

export const STORED_RANGE_PREFIX = 'Range:'

interface StoredRange { d: Record<string, unknown>; obs: Record<string, unknown>; range: object; low: number; high: number }

/** The node's `observedState.range` with two finite ends, or `null`. Reads no source. */
function readStoredRange(data: unknown): StoredRange | null {
  if (data === null || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const obs = d.observedState
  if (obs === null || typeof obs !== 'object') return null
  const range = (obs as { range?: unknown }).range
  if (range === null || typeof range !== 'object') return null
  const { low, high } = range as { low?: unknown; high?: unknown }
  if (typeof low !== 'number' || typeof high !== 'number' || !Number.isFinite(low) || !Number.isFinite(high)) return null
  return { d, obs: obs as Record<string, unknown>, range, low, high }
}

/** Both ends in the value line's own words (`factorDisplayParts` / `factorDisplayText`), joined by the shared joiner. */
function formatStoredRange({ d, obs, low, high }: StoredRange): string | null {
  // The node's own data with the end as its raw value: no authored display string and no pending keystroke may stand in.
  const at = (end: number) => ({
    ...d, display_value: undefined, pending_user_value: undefined,
    observedState: { ...obs, raw_value: end },
  })
  const lo = factorDisplayParts(at(low))
  const hi = factorDisplayParts(at(high))
  if (lo !== null && hi !== null && lo.unit === hi.unit && lo.attached === hi.attached) {
    // The unit is placed by the shared joiner (the formatter's own spacing), never composed here.
    return joinFactorDisplayParts({ ...lo, figure: `${lo.figure}–${hi.figure}`, restates: undefined })
  }
  const loText = factorDisplayText(at(low))
  const hiText = factorDisplayText(at(high))
  return loText !== null && hiText !== null ? `${loText} to ${hiText}` : null
}
