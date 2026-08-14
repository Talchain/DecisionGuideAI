/**
 * COLLAB — resolving a persisted `elicited_from` reference to a PERSON'S NAME,
 * at render time.
 *
 * ── WHY RESOLUTION IS A MODULE AND NOT A LOOKUP AT EACH SURFACE ────────────
 * schemas 0.40.0's `RoundParticipantRefSchema` persists `{round_id,
 * participant_id}` and NOTHING ELSE, and its header states the reason as a
 * rule rather than a preference:
 *
 *   "IDS ONLY, `.strict()`, DELIBERATELY. Display names are resolved at render
 *    time from round data and are NEVER persisted into the graph — a display
 *    name inside `scenarios.graph` would sit beyond the R-2 redaction
 *    routine's reach."
 *
 * So every attribution surface faces the same question ("who is
 * `participant_id`?") and has the same two ways to get it wrong: print the raw
 * id as though it were a name, or guess. This module is the ONE answer, and it
 * is a pure function so the answer can be tested without a network, a session,
 * or a rendered tree.
 *
 * ── THE INVARIANT THAT IS THE WHOLE POINT ─────────────────────────────────
 * **A `named` result carries a name a human wrote. An unresolved result carries
 * NO IDENTIFIER AT ALL** — not the participant id, not the round id, not a
 * truncated or prefixed form of either. A uuid rendered where a name belongs
 * reads to the user as a name (it sits in the same sentence position, in the
 * same pill), and it is a name for nobody. `__tests__/participantNames.spec.ts`
 * asserts this against the SERIALISED result, so a future field cannot
 * reintroduce an id by riding along.
 *
 * ── WHY THE REASONS ARE DISTINCT AND NOT ONE `null` ───────────────────────
 * Four different things can stop a name resolving, and they are not the same
 * fact about the world:
 *   · `no_attribution`     — the value was never applied from a panel answer.
 *                            The ordinary case for almost every factor.
 *   · `roster_unavailable` — round data is not loaded YET, or could not be
 *                            loaded. TRANSIENT; a later render may resolve.
 *   · `not_on_roster`      — the round has no row for this participant.
 *   · `label_unusable`     — a row exists and its label is empty.
 * A surface that collapses these into "no name" renders the same copy for "this
 * number is nobody's panel answer" and "this IS somebody's panel answer and I
 * cannot say whose" — and the second must keep saying the value came from the
 * panel. That is why callers get the reason, not a bare `string | null`.
 *
 * ⚠ THE LABEL IS ALREADY R-2 RESOLVED WHEN IT ARRIVES, AND MUST BE.
 * `display_name` on a roster entry is CEE's `p.pseudonym ?? p.display_name`
 * (`collab/rounds-service.ts:217`, the preview projection). This module must
 * therefore be fed SERVER round data and never a client-side copy of a name:
 * `collab/openRoundRecord.ts` keeps names in `localStorage`, and a name cached
 * there survives the redaction that replaced it, so resolving from that record
 * would reinstate a name R-2 exists to detach. Named here because the record is
 * the nearest available source and the wrong one.
 */

/**
 * The persisted attribution reference (schemas 0.40.0
 * `RoundParticipantRefSchema`), as it is READ rather than as it is written.
 *
 * `participant_id` consumes `AuthoredBySchema`, which admits the reserved
 * literals `'owner'` and `'assistant'` as well as a uuid — so it is a string
 * here, not a uuid-shaped type, and a reserved literal is handled by ordinary
 * roster lookup (it has no roster row, so it lands on `not_on_roster`, which is
 * truthful). Deliberately NOT special-cased into invented copy: CEE only stamps
 * this field after verifying the id against the round's own participant rows,
 * so a reserved literal arriving here would mean something has changed upstream
 * and the honest answer is that this surface cannot name them.
 */
export interface RoundParticipantRef {
  round_id: string
  participant_id: string
}

/**
 * One row of a round's roster, as CEE's owner preview serves it.
 *
 * `display_name` IS the R-2-resolved label (pseudonym after redaction) — the
 * field name is CEE's, kept verbatim so the two sides grep to each other.
 */
export interface RosterEntry {
  participant_id: string
  display_name: string
}

export type NameUnresolvedReason =
  | 'no_attribution'
  | 'roster_unavailable'
  | 'not_on_roster'
  | 'label_unusable'

export type ParticipantNameResolution =
  | { readonly state: 'named'; readonly label: string }
  | { readonly state: 'unresolved'; readonly reason: NameUnresolvedReason }

/**
 * Read a `{round_id, participant_id}` reference off a value that came through a
 * `.passthrough()` schema.
 *
 * `ObservedStateSchema` is `.passthrough()`, so `elicited_from` reaches the
 * client as whatever the wire carried — this function is the boundary that
 * turns "whatever the wire carried" into a typed reference or nothing. It
 * validates both members even though only `participant_id` is used for the
 * lookup: a reference missing its `round_id` cannot be resolved against the
 * right round's roster, and treating it as attribution would invite a lookup
 * against WHICHEVER roster happened to be loaded.
 */
export function readElicitedFrom(value: unknown): RoundParticipantRef | null {
  if (typeof value !== 'object' || value === null) return null
  const ref = value as { round_id?: unknown; participant_id?: unknown }
  if (typeof ref.round_id !== 'string' || ref.round_id.trim() === '') return null
  if (typeof ref.participant_id !== 'string' || ref.participant_id.trim() === '') return null
  return { round_id: ref.round_id, participant_id: ref.participant_id }
}

/**
 * Resolve one attribution reference against one round's roster.
 *
 * `roster === null` means "not available" (not loaded yet, or the load failed)
 * and is DISTINCT from `[]`, which means "this round genuinely has no
 * participants" — the first is transient and the second is a fact. They return
 * different reasons for that reason.
 */
export function resolveParticipantName(
  elicitedFrom: unknown,
  roster: readonly RosterEntry[] | null | undefined,
): ParticipantNameResolution {
  const ref = readElicitedFrom(elicitedFrom)
  if (ref === null) return { state: 'unresolved', reason: 'no_attribution' }

  if (roster === null || roster === undefined) {
    return { state: 'unresolved', reason: 'roster_unavailable' }
  }

  const row = roster.find((entry) => entry.participant_id === ref.participant_id)
  if (row === undefined) return { state: 'unresolved', reason: 'not_on_roster' }

  // A row can exist with an unusable label: CEE's redaction writes a pseudonym,
  // but an owner-entered display name is only `.min(1)` at the mint boundary
  // and whitespace passes that. Trimming here — rather than at the surface —
  // keeps "is this label printable" one decision in one place.
  const label = typeof row.display_name === 'string' ? row.display_name.trim() : ''
  if (label === '') return { state: 'unresolved', reason: 'label_unusable' }

  return { state: 'named', label }
}
