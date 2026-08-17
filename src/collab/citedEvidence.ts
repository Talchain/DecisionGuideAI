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
 * The stance phrase is CEE-authored, which keeps ONE authority for the word.
 *
 * ⚠ AND IT IS NOT COVERED BY CEE'S COPY GUARD — an earlier version of this
 * header claimed it was, and that was overstated. `disagreement-copy.ts`'s
 * `everyString()` derives from `STANDING_SENTENCES` plus the headlines and
 * questions; `STANCE_PHRASE` is NOT in it. So a causal phrase shipped in
 * `STANCE_PHRASE` would pass this bundle's banned-register assertion unseen,
 * because that assertion runs over what CEE SERVED and CEE is trusted for this
 * field. Deferring to CEE is still right — two authorities on one user-facing
 * word is worse — but it is deference, not a proof, and it must not be cited as
 * a backstop it is not.
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
  /**
   * CEE's fixed word for the stance — a BARE VERB (`supports` / `challenges` /
   * `qualifies`, `disagreement-copy.ts:126-130`), not a sentence fragment.
   *
   * ⚠ IT NEEDS AN OBJECT TO READ AS ENGLISH, and CEE supplies one at its own
   * render site. A surface that drops it in after a comma emits "Ada attached
   * this, challenges".
   */
  readonly stance_phrase: string
  /**
   * WHOSE position the evidence is about, R-2-resolved by CEE, or null when it
   * is about the factor rather than a person. The object of `stance_phrase`.
   *
   * ⚠ The LABEL only. `about_participant_id` is deliberately not carried — the
   * same no-identifier rule the author id follows.
   */
  readonly about_label: string | null
  readonly kind: 'note' | 'link'
  /** The participant's own words. Verbatim. */
  readonly body: string
  /**
   * An http/https URL, or null.
   *
   * ⚠ RE-CHECKED HERE EVEN THOUGH CEE NORMALISES AT APPEND TIME. The view
   * arrives through an unvalidated `as DisagreementView` cast
   * (`collabService.ts:446`), so "validated server-side" is a claim about the
   * producer and not about the bytes this function received. This value feeds an
   * `href`, and `javascript:` in an href is the one place a skewed or hostile
   * payload becomes script execution.
   */
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
   * ⭐⭐ THE SHAPE GUARD, AND IT IS NOT DEFENSIVE PADDING — IT WAS A CRASH.
   *
   * `fetchOwnerDisagreement` returns `(await res.json()) as DisagreementView` —
   * a CAST, with no validation anywhere. A 200 whose body is `{}` (an older CEE,
   * a schema skew, a proxy error page) therefore reaches here with
   * `per_target === undefined`, and iterating it THROWS DURING RENDER. Because
   * this hook is called from the factor panels, the throw takes down the whole
   * inspector subtree — so the participant's NAME leaves the screen too.
   *
   * That is this feature's central claim failing one seam past the reader gate:
   * "malformity costs the citation, never the attribution" was TRUE of
   * `readElicitedFrom` and FALSE here. Schema skew is this estate's hazard #1
   * and it is precisely the trigger.
   *
   * A malformed view is `view_unavailable` — the same state as a failed load,
   * which is what it is.
   */
  if (!Array.isArray(view.per_target)) {
    return { state: 'unresolved', reason: 'view_unavailable' }
  }

  /**
   * ⚠ BOUND BY `event_id` ACROSS EVERY TARGET IN THE VIEW — and the reason is
   * ROBUSTNESS TO GROUPING, not the verifier's scope.
   *
   * ⚠⚠ AN EARLIER VERSION OF THIS COMMENT SAID CEE "requires only that the row
   * belong to the same ROUND". THAT IS FALSE, and it was refuted at CEE's bytes:
   * `apply-verification.ts:282-287` binding (f) requires `evidence_attached` AND
   * the same round AND `cited.target.kind === 'factor' && cited.target.id ===
   * target_id`, refusing with "That evidence is not on this round for this
   * factor." So a citation is always on the SAME FACTOR as the value.
   *
   * The wide search STAYS, because the two directions are not symmetric: a
   * search wider than the producer can never report a FALSE ABSENCE, whereas a
   * search narrower than the view's grouping can. This function must not encode
   * an assumption about which `per_target` row CEE files an evidence row under.
   *
   * ⭐ WHAT IS *NOT* SCOPED BY THE VERIFIER IS THE AUTHOR — deliberately, and
   * CEE says so in the same region: applying Grace's number BECAUSE ADA
   * CHALLENGED IT "is the most valuable case this whole feature has". Never add
   * an author-equality check.
   *
   * The match is by id, never by a predicate another row could satisfy — no
   * "the first note", no "the one from this author" (trap 19).
   */
  for (const target of view.per_target) {
    // Same cast, same hazard, one level down: a row whose `evidence` is absent
    // must skip, never throw.
    if (!Array.isArray(target?.evidence)) continue
    for (const row of target.evidence) {
      if (row?.event_id !== ref.evidence_event_id) continue

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

      /**
       * The scheme allowlist. `http:`/`https:` only, decided by the URL PARSER
       * rather than by a string prefix test — `javascript:alert(1)#https://x`
       * defeats a `startsWith`, and a malformed string must be dropped rather
       * than thrown on.
       */
      let url: string | null = null
      if (typeof row.url === 'string' && row.url.trim() !== '') {
        try {
          const parsed = new URL(row.url.trim())
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') url = row.url.trim()
        } catch {
          url = null
        }
      }

      const aboutLabel =
        typeof row.about_label === 'string' && row.about_label.trim() !== ''
          ? row.about_label.trim()
          : null

      return {
        state: 'cited',
        evidence: {
          author_label: authorLabel,
          stance_phrase: stancePhrase,
          about_label: aboutLabel,
          kind: row.kind,
          body,
          url,
        },
      }
    }
  }

  return { state: 'unresolved', reason: 'evidence_not_found' }
}
