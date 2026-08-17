/**
 * COLLAB — resolving a persisted CITATION to the piece of panel evidence it
 * names, at render time.
 *
 * ── THE GAP THIS CLOSES ───────────────────────────────────────────────────
 * From 0.41.0 CEE stamps `observed_state.elicited_from.evidence_event_id` when
 * the owner applies a panellist's value AND cites a colleague's note or link as
 * part of that decision (`system-events/factor-value-edit.ts:362-384`). The
 * write path is complete and wire-witnessed. **No mounted surface read it back**,
 * because `participantNames.readElicitedFrom` dropped the member and every
 * attribution surface goes through that one function. So the product recorded
 * why a value was adopted and then showed nobody — chronic failure #1, on the
 * attribution family.
 *
 * ── WHY THIS IS A SEPARATE MODULE FROM `participantNames.ts` ──────────────
 * Two questions, two sources, two failure modes. "Whose number is this" is
 * answered from the ROSTER (`/rounds/:id/preview`, ids → names). "What did the
 * owner cite" is answered from the OWNER DISAGREEMENT VIEW, the only projection
 * that carries evidence rows. Folding them would put a heavier fetch behind
 * every name pill, which is exactly the trade `fetchRoundRoster`'s header
 * rejected — the name lookup must stay on `/preview`.
 *
 * ── ⭐ THE COPY IS CEE'S, AND THAT IS A CORRECTNESS PROPERTY ──────────────
 * This module returns the SERVER'S OWN `stance_phrase` and `author_label` and
 * composes no sentence of its own. That is not deference for its own sake: a
 * review on 15 Aug found the citation copy asserting a causality the server had
 * never verified — "…as the reason for this change" — when the verifier checks
 * only that the evidence EXISTS, belongs to the round and names the factor. It
 * does not read `stance` and it does not read `about_participant_id`. So this
 * surface may say WHAT was cited and WHO wrote it, and must never say the
 * citation CAUSED the change.
 *
 * The stance phrase is CEE-authored and pinned by CEE's own copy guard, which
 * asserts over every string that module can emit that none of them resolves the
 * disagreement. A phrase composed in this bundle would sit outside that proof.
 *
 * ── ⭐ THE ASYMMETRY IS THE FEATURE, NOT A BUG TO NORMALISE ───────────────
 * The cited evidence is frequently authored by a DIFFERENT person from the value
 * that was applied: the designed path applies Grace's number while citing Ada's
 * challenge to it. So `author_label` here is resolved and rendered
 * INDEPENDENTLY of the value's attributed author, and the two must never be
 * collapsed or assumed equal. An author-equality check would destroy the case
 * the feature exists for.
 *
 * ── WHY THE REASONS ARE DISTINCT ──────────────────────────────────────────
 *   · `no_citation`        — the owner applied without citing. The ordinary case.
 *   · `view_unavailable`   — the disagreement view is not loaded YET, or could
 *                            not be loaded (signed out, another scenario's
 *                            round). TRANSIENT; a later render may resolve.
 *   · `evidence_not_found` — the view loaded and holds no row with that id.
 *   · `body_unusable`      — a row exists and its body is empty.
 * A surface that collapsed these would render the same thing for "nothing was
 * cited" and "something WAS cited and I cannot show it", and the second is a
 * fact the owner needs.
 */

import type { DisagreementView } from './collabService'
import { readElicitedFrom } from './participantNames'

/** A citation reference: which round, and which evidence row within it. */
export interface CitationRef {
  round_id: string
  evidence_event_id: string
}

/**
 * The resolved citation, as a surface renders it.
 *
 * ⚠ NO IDENTIFIER RIDES ALONG, deliberately — the same invariant
 * `participantNames.ts` holds for names. `event_id` is not carried here and
 * neither is `authored_by`: a uuid in a sentence position reads to the user as
 * content, and `author_label` is the only name-shaped thing that has been
 * through CEE's R-2 pseudonym resolution.
 */
export interface CitedEvidence {
  /** The R-2-resolved label of whoever ATTACHED the evidence. */
  readonly author_label: string
  /** CEE's fixed word for the stance. Rendered verbatim, never re-worded. */
  readonly stance_phrase: string
  readonly kind: 'note' | 'link'
  /** The participant's own words. Verbatim. */
  readonly body: string
  /** http/https only, normalised server-side at append time. */
  readonly url: string | null
}

export type CitationUnresolvedReason =
  | 'no_citation'
  | 'view_unavailable'
  | 'evidence_not_found'
  | 'body_unusable'

export type CitedEvidenceResolution =
  | { readonly state: 'cited'; readonly evidence: CitedEvidence }
  | { readonly state: 'unresolved'; readonly reason: CitationUnresolvedReason }

/**
 * Read a citation reference off a value that came through a `.passthrough()`
 * schema.
 *
 * Delegates the wire-shape decision to `readElicitedFrom` rather than
 * re-validating `round_id` here. That is deliberate: two functions deciding
 * independently what a valid `elicited_from` looks like is the
 * hand-maintained-mirror defect, and this estate has paid for it before with two
 * same-named hash functions. One gate, one answer.
 */
export function readCitation(elicitedFrom: unknown): CitationRef | null {
  const ref = readElicitedFrom(elicitedFrom)
  if (ref === null) return null
  if (ref.evidence_event_id === undefined) return null
  return { round_id: ref.round_id, evidence_event_id: ref.evidence_event_id }
}

/**
 * Resolve one citation against one round's disagreement view.
 *
 * `view === null` means "not available" (not loaded yet, or the load failed) and
 * is DISTINCT from a view that loaded and holds no matching row — the first is
 * transient, the second is a fact about the round.
 */
export function resolveCitedEvidence(
  elicitedFrom: unknown,
  view: DisagreementView | null | undefined,
): CitedEvidenceResolution {
  const ref = readCitation(elicitedFrom)
  if (ref === null) return { state: 'unresolved', reason: 'no_citation' }

  if (view === null || view === undefined) {
    return { state: 'unresolved', reason: 'view_unavailable' }
  }

  /**
   * ⚠ BOUND BY `event_id` ACROSS EVERY TARGET, NOT BY THE TARGET UNDER THE
   * CURSOR. The citation names an evidence ROW, and CEE's verifier requires only
   * that the row belong to the same ROUND — a note attached to a neighbouring
   * factor is a legitimate citation. Scoping this search to one target would
   * silently render `evidence_not_found` for a citation the server verified and
   * accepted, and the surface would report an absence that is not real.
   *
   * The match is by id, never by a predicate another row could satisfy — no
   * "the first note", no "the one from this author" (trap 19).
   */
  for (const target of view.per_target) {
    for (const row of target.evidence) {
      if (row.event_id !== ref.evidence_event_id) continue

      // A row can exist with an unusable body. `body` is the participant's own
      // words and is the whole content of the citation; an empty one has nothing
      // to show, and that is a distinct state from "no row".
      const body = typeof row.body === 'string' ? row.body.trim() : ''
      if (body === '') return { state: 'unresolved', reason: 'body_unusable' }

      const authorLabel = typeof row.author_label === 'string' ? row.author_label.trim() : ''
      const stancePhrase = typeof row.stance_phrase === 'string' ? row.stance_phrase.trim() : ''

      /**
       * ⚠ AN ABSENT LABEL OR STANCE PHRASE IS `body_unusable`, NOT A LOCAL
       * SUBSTITUTE. Both come from CEE, and both are exactly the fields a
       * UI-side default would turn into a second authority — an unattributed
       * quotation, or a stance this bundle invented. The honest outcome when
       * CEE has not supplied them is to render no citation at all.
       */
      if (authorLabel === '' || stancePhrase === '') {
        return { state: 'unresolved', reason: 'body_unusable' }
      }

      return {
        state: 'cited',
        evidence: {
          author_label: authorLabel,
          stance_phrase: stancePhrase,
          kind: row.kind,
          body,
          url: typeof row.url === 'string' && row.url.trim() !== '' ? row.url : null,
        },
      }
    }
  }

  return { state: 'unresolved', reason: 'evidence_not_found' }
}
