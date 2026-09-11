/**
 * findingDissent — the ONE definition of when a user's stated disagreement is
 * sendable, and the shape it takes on the wire.
 *
 * ⭐ WHY THIS IS A MODULE AND NOT TWO PREDICATES AT TWO CALL SITES. The
 * sendability question is asked twice by construction: once at the surface
 * (`StrengthenTheReasoning.commitDispute`, which must decide whether it may
 * show the stronger copy) and once at the wire (`v5/buildPayload`, which is
 * fail-closed and must never hand CEE a member it will reject). Two hand-kept
 * copies of one predicate is this estate's chronic defect — the same concept
 * under two keys, drifting apart until a consumer states something false. They
 * import the SAME predicates from here, so they cannot disagree.
 *
 * ── ⚠⚠ WHAT THE STATEMENT IS, AND WHAT MAY BE DONE TO IT ──────────────────
 * `statement` is the user's reason VERBATIM. It is the field Paul's ruling of
 * 2026-09-11 authorises persisting, and the words themselves are the record.
 *
 *   · It is NEVER trimmed, collapsed, case-folded or otherwise normalised on
 *     its way to the wire. `isSendableStatement` asks its question of a TRIMMED
 *     COPY and `buildFindingDissentEvent` sends the ORIGINAL. A blank-looking
 *     statement is REFUSED, not tidied: the contract's `.min(1)` alone would
 *     admit `" "`, so the non-blank test is taken here as well as there.
 *   · It MAY CONTAIN PII. The schemas 0.55.0 changelog is explicit that the
 *     widening "licenses persistence as authored user content; it does not
 *     license re-emitting the text into telemetry or logs, which is the half of
 *     R-004 that still stands." So it must not reach telemetry, analytics,
 *     Sentry or any `console.*`. Nothing in this module logs it, and the one
 *     debug path the send touches redacts it — see the `finding_dissent` arm of
 *     `recordCrossSurfaceEvent` in `useConversation.sendSystemEvent`.
 *
 * ── ⚠ WHY THE LENGTH BOUND IS ENFORCED HERE AND NOT ONLY AT CEE ───────────
 * The contract bounds `statement` at 2000 characters and the textarea that
 * produces it has no `maxLength`. Every member of `SystemEventSchema` is
 * `.strict()` inside a `discriminatedUnion`, so an over-long statement does not
 * fail as one bad field — CEE rejects the WHOLE TURN (422). Refusing to send is
 * strictly better than a rejected turn, because the local record survives
 * either way and only one of the two costs the user a turn.
 *
 * ⚠ THE LITERAL BELOW MIRRORS THE CONTRACT'S `MAX_STATED_REASON`, AND THE
 * CONSTANT ITSELF IS UNREACHABLE FROM HERE. The reason is PACKAGING, not the
 * pin — derived at the vendored 0.55.0 bytes rather than assumed:
 *
 *   · The constant IS in the shipped dist, unminified and exported:
 *     `dist/boundary/turn-payload.js` has `const MAX_STATED_REASON = 2000` and
 *     `export { MAX_STATED_REASON }`, and `dist/boundary/turn-payload.d.ts`
 *     declares it. So "the dist dropped it" is NOT what is happening.
 *   · But the public `./boundary` barrel does not RE-EXPORT it
 *     (`dist/boundary/index.d.ts` enumerates its re-exports; this is absent —
 *     probed at run time: `'MAX_STATED_REASON' in await import(
 *     '@talchain/schemas/boundary')` is `false`, while the contrast control
 *     `'SystemEventSchema' in …` is `true`, so the probe is not simply blind).
 *   · And the deep path is CLOSED by the package's `exports` map, which lists
 *     `.`, `./boundary`, `./orchestrator`, `./fixtures` and two JSON globs with
 *     no wildcard: importing `@talchain/schemas/boundary/turn-payload.js`
 *     throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. The file ships; the path is not
 *     addressable.
 *
 * ⭐⭐ SO "RE-VENDOR AND IMPORT IT" IS NOT THE FIX, AND WHAT DOES KEEP THE
 * MIRROR HONEST IS A DERIVATION, NOT A PROMISE. A mirror with no derivation is
 * this estate's dominant defect, and a note saying "someone should fix this
 * later" is how one survives indefinitely. Two things, and the second is here
 * TODAY:
 *
 *   1. UPSTREAM, ONE LINE: add `MAX_STATED_REASON` to the `./boundary` barrel's
 *      re-export list in `olumi-schemas`. Then this literal becomes an import
 *      and the mirror stops existing. That is a schemas change, not a UI one.
 *   2. MEANWHILE, DERIVE THE BOUND BEHAVIOURALLY FROM THE SCHEMA THE BARREL
 *      DOES EXPORT. `SystemEventSchema` installs `.max(MAX_STATED_REASON)` on
 *      this member, so the bound is observable without the constant: a
 *      statement of exactly `MAX_DISSENT_STATEMENT` characters must parse and
 *      one character more must not. That probes the CONTRACT rather than a
 *      remembered number, and it REDs if either side moves — which is the only
 *      property a mirror can actually be given. It is the same instrument
 *      schemas uses on its own two halves ("derived from both schemas at run
 *      time — belt and braces, because equal-by-construction stops being true
 *      the moment someone hardcodes a number on either side").
 *
 * `findingDissent.spec.ts` carries both the literal pin and that derivation.
 */

import type { WireSystemEvent } from './types'

/**
 * schemas 0.55.0 `MAX_STATED_REASON`. Mirrored because the constant is not
 * importable (packaging, not the pin — see the header), and CHECKED against the
 * live schema in `findingDissent.spec.ts` rather than left on trust.
 */
export const MAX_DISSENT_STATEMENT = 2000

/**
 * Values `results.hash` takes that are NOT an analysis id.
 *
 * ⚠ `'error'` IS A REAL VALUE ON THE REAL PATH, not a defensive invention.
 * `createErrorReport` (`adapters/plot/v2/responseMapper.ts`) sets
 * `model_card.response_hash: 'error'`, `applyV5State` reads exactly that field
 * into `resultsComplete({ hash })`, and the Reasoning tab is handed it as
 * `analysisHash`. So a user who disagrees with a finding after a FAILED run
 * would address their dissent to the literal string `error` — a dangling
 * reference CEE could never resolve, committed as a long-lived fact.
 *
 * ⚠ AND THE EMPTY STRING, which reaches the same place by a different door:
 * absent and blank are both "no run identity established". The contract's
 * `.min(1)` catches `''` at CEE, but only after the turn has been spent.
 */
const PLACEHOLDER_ANALYSIS_IDS: ReadonlySet<string> = new Set(['error'])

/**
 * Is this value a real analysis id, i.e. one a dissent may be addressed to?
 *
 * Fail-CLOSED: anything that is not a non-blank, non-placeholder string is NOT
 * sendable. A dissent with no run to hang on is recorded locally and says so;
 * inventing a placeholder would put a claim the user never made into a fact row
 * that outlives every session that could correct it.
 */
export function isSendableAnalysisId(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  return !PLACEHOLDER_ANALYSIS_IDS.has(trimmed)
}

/** A finding id is sendable when it is a non-blank string. ID-addressed only. */
export function isSendableFindingId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Is the statement sendable?
 *
 * ⚠ ASKED OF A TRIMMED COPY, ANSWERED ABOUT THE ORIGINAL. The trim exists to
 * reject whitespace-only text; it never reaches the wire. The length bound is
 * measured on the ORIGINAL, because the original is what CEE receives and
 * therefore what its `.max()` will measure.
 */
export function isSendableStatement(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false
  if (value.trim().length === 0) return false
  return value.length <= MAX_DISSENT_STATEMENT
}

/**
 * Drop a stated reason from anything on its way into DEBUG STATE, keeping a
 * presence marker in its place.
 *
 * ⭐ THE `*_present` SHAPE IS R-004'S OWN, REUSED RATHER THAN REINVENTED. CEE's
 * standing privacy rule reads: "the fact records `comment_present`, NEVER the
 * comment text — the user's free text may contain PII and a fact row is
 * long-lived and widely read." schemas 0.55.0 widened that rule for the WIRE
 * and for PERSISTENCE, and its changelog is explicit about what the widening
 * does NOT cover: "it does not license re-emitting the text into telemetry or
 * logs, which is the half of R-004 that still stands." This is that half.
 *
 * ⚠ IT REDACTS THE KEY UNCONDITIONALLY, NOT ONLY FOR `finding_dissent`, AND
 * THE ASYMMETRY IS DELIBERATE. Keying the redaction on the event type would
 * mean a future member carrying a `statement` leaks by default until someone
 * remembers to extend a list — the hand-maintained mirror this estate pays for,
 * placed on the one field where the cost of drift is a user's private words.
 * The two errors are not equal: over-redacting debug state loses a field nobody
 * reads, and under-redacting it puts PII somewhere long-lived. No other member
 * of `WIRE_SYSTEM_EVENT_TYPES` carries a `statement`, so the cost today is nil.
 *
 * Returns the payload UNCHANGED (same reference) when there is no `statement`,
 * so no other event's debug record is disturbed.
 */
export function redactStatedReason(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!payload || !('statement' in payload)) return payload
  const { statement, ...rest } = payload
  return { ...rest, statement_present: typeof statement === 'string' && statement.length > 0 }
}

/**
 * WHERE a dissent would be addressed: the finding, and the run it was read on.
 *
 * Named apart from `FindingDissentInput` because the two answer different
 * questions. The address is knowable the moment the composer opens; the
 * statement is the thing the user has not written yet.
 */
export interface FindingDissentAddress {
  findingId: string | null | undefined
  analysisId: string | null | undefined
}

/**
 * ⭐⭐ IS THERE SOMEWHERE TO SEND THIS — asked WITHOUT the statement, so the
 * surface can ask it BEFORE the user has typed one.
 *
 * ⚠⚠ THIS EXISTS BECAUSE THE COPY ON THE TEXTAREA IS A PRIVACY DISCLOSURE, AND
 * A DISCLOSURE THAT ARRIVES AFTER THE FACT IS NOT ONE. The prompt is read while
 * the user decides what to type, so it has to say whether those words will leave
 * the browser — and the only sentence that can be trusted to say so is one
 * derived from the SEND'S OWN TEST. A second predicate written beside the first
 * is this estate's signature defect: it agrees on the day it is written and
 * drifts into stating something false. So `buildFindingDissentEvent` CONSUMES
 * this rather than repeating it, and a later clause added to the address has
 * exactly one place to go.
 *
 * ⚠ THE STATEMENT CLAUSE IS DELIBERATELY OUTSIDE IT, and leaving it in would
 * have recreated the defect. An empty draft is not sendable, so a prompt keyed
 * on the whole of `buildFindingDissentEvent` would read "this stays in this
 * browser" at exactly the moment the textarea is blank — which is the moment
 * the user is deciding what to type. The address is a fact about the world; the
 * statement is a fact about the words that do not exist yet.
 *
 * ⚠ SO THE COPY CAN ONLY ERR TOWARDS DISCLOSURE, AND THAT IS THE SAFE ERROR.
 * Sending is strictly NARROWER than this: a blank or over-long statement, a
 * board with no persisted identity, a decision switched mid-compose, or a failed
 * durable write each leave the words local while the prompt has already warned
 * they would travel. Over-warning costs the user nothing. Under-warning is the
 * defect.
 */
export function isSendableAddress<T extends FindingDissentAddress>(
  address: T,
): address is T & { findingId: string; analysisId: string } {
  return isSendableAnalysisId(address.analysisId) && isSendableFindingId(address.findingId)
}

export interface FindingDissentInput extends FindingDissentAddress {
  /** The user's words. Passed through VERBATIM when sendable. */
  statement: string | null | undefined
}

/**
 * Build the `finding_dissent` system event, or `null` when any half of the
 * address or the statement itself is not sendable.
 *
 * A `null` return is the instruction "record locally and leave the copy at its
 * local wording". It is never an error to report at the user, and it must never
 * be routed around by substituting a placeholder.
 */
export function buildFindingDissentEvent(input: FindingDissentInput): WireSystemEvent | null {
  // ⚠ THE ADDRESS TEST IS NOT INLINED HERE. It is the same call the textarea's
  // copy makes, so the sentence the user reads cannot drift from what this does.
  if (!isSendableAddress(input)) return null
  const { findingId, analysisId, statement } = input
  if (!isSendableStatement(statement)) return null
  return {
    type: 'finding_dissent',
    payload: {
      finding_id: findingId,
      analysis_id: analysisId,
      // ⚠ THE ORIGINAL, NOT THE TRIMMED COPY. The words are the record.
      statement,
    },
  }
}
