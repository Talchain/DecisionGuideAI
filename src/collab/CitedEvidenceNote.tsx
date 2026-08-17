/**
 * COLLAB — the cited-evidence line on a factor panel.
 *
 * ── ⭐ WHAT IT MAY SAY, AND THE ONE THING IT MAY NOT ──────────────────────
 * It says WHO attached a piece of evidence to this round, the stance CEE
 * recorded for it, and the words they wrote. It does NOT say the citation caused
 * the change. CEE's verifier checks that the cited evidence exists, belongs to
 * the round and names the factor — it does not read `stance` and does not read
 * `about_participant_id` — so "…as the reason for this change" is a causal claim
 * the server never established. A 15 Aug review found exactly that sentence
 * shipped, and this component is where it must not come back.
 *
 * The rule it inherits is `inspectorStrings.ts`'s, in Paul's words: ATTRIBUTE,
 * NEVER ENDORSE. "Apply Grace's value" is not "Grace was correct", and citing
 * Ada's note is not "Ada was right".
 *
 * ── EVERY SENTENCE-BEARING STRING IS CEE'S ────────────────────────────────
 * `stance_phrase` and `author_label` arrive from the server; `body` is the
 * participant's own words, verbatim. The only copy this file owns is the
 * connective — deliberately minimal, and deliberately not a claim.
 *
 * ── UNRESOLVED RENDERS NOTHING ────────────────────────────────────────────
 * All four unresolved reasons render `null`. There is no spinner and no "loading
 * citation" text: three of the four reasons are indistinguishable from "nothing
 * was cited" to a user who cannot act on the difference, and the fourth
 * (`view_unavailable`) is transient. An empty line that later fills is honest; a
 * placeholder asserting a citation exists before one has resolved is not.
 */

import { FileText, Link2 } from 'lucide-react'

import type { CitedEvidenceResolution } from './citedEvidence'

export const CITED_EVIDENCE_TESTID = 'collab-cited-evidence'

/**
 * The sentence, composed the way CEE composes it.
 *
 * ⚠⚠ THE FIRST VERSION WAS BROKEN ENGLISH ON EVERY REAL CITATION, and the
 * reason is worth keeping: it read `${author} attached this, ${stancePhrase}`,
 * which assumed `stance_phrase` was a fragment like "challenging this". It is
 * not. CEE's `STANCE_PHRASE` is a BARE VERB — `supports` / `challenges` /
 * `qualifies` (`disagreement-copy.ts:126-130`) — so production rendered
 * **"Ada attached this, challenges"**. The fixture that passed carried
 * "challenging this", a string CEE never emits: the oracle came from this
 * lane's head instead of from the producer (trap 13c), and a full mutant kit
 * scored perfectly against it.
 *
 * ⭐ SO THE OBJECT IS SUPPLIED, MIRRORING CEE'S OWN RENDER SITE
 * (`disagreement-read-model.ts:365-366`):
 *
 *     const about = e.about_label !== null ? `${e.about_label}'s position` : 'this factor'
 *     `- Evidence from ${e.author_label}, ${e.stance_phrase} ${about}: "${e.body}"`
 *
 * ⚠ THAT MIRROR IS A CROSS-SERVICE HAZARD AND IS ACCEPTED KNOWINGLY. The
 * `about` composition now exists in two services, so a change to CEE's form
 * drifts this one silently — the hand-maintained-mirror defect, across a
 * boundary. It is taken because the alternative is worse: dropping the stance
 * loses the fact that a colleague CHALLENGED the number, which is the most
 * valuable thing this line can say. The durable fix is CEE serving a
 * sentence-form phrase; until then this comment is the marker.
 *
 * ⚠ IT REPORTS A STANCE, NEVER A CONSEQUENCE. "Ada challenges Grace's position"
 * is a fact recorded on the evidence row. Anything in the register of "because",
 * "which is why", "the reason for" or "justifies" asserts a link between the
 * citation and the applied number that CEE never checked.
 */
function attributionSentence(
  authorLabel: string,
  stancePhrase: string,
  aboutLabel: string | null,
): string {
  const about = aboutLabel !== null ? `${aboutLabel}'s position` : 'this factor'
  return `${authorLabel} ${stancePhrase} ${about}`
}

export function CitedEvidenceNote({
  resolution,
}: {
  resolution: CitedEvidenceResolution
}): JSX.Element | null {
  if (resolution.state !== 'cited') return null

  const { author_label, stance_phrase, about_label, kind, body, url } = resolution.evidence
  const Icon = kind === 'link' ? Link2 : FileText

  return (
    <div
      data-testid={CITED_EVIDENCE_TESTID}
      className="mt-2 pt-2 border-t border-panel-border"
    >
      <div className="flex items-start gap-1.5">
        <Icon size={12} className="text-info mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-xs text-text-muted">
            {attributionSentence(author_label, stance_phrase, about_label)}
          </div>
          {/* The participant's own words. Verbatim, never summarised. */}
          <div className="text-xs text-text-body mt-0.5 break-words">{body}</div>
          {url !== null && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-info underline break-all mt-0.5 inline-block"
            >
              {url}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
