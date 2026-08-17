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
 * The connective, and the whole of this bundle's authored copy.
 *
 * ⚠ IT IS A REPORT OF AN ACT, NOT OF A CONSEQUENCE. "attached" is what happened
 * and is verifiable from the evidence row itself. Anything in the register of
 * "because", "which is why", "the reason for", "supports this value" or
 * "justifies" asserts a link between the citation and the applied number that
 * nothing upstream has checked.
 */
function attributionSentence(authorLabel: string, stancePhrase: string): string {
  return `${authorLabel} attached this, ${stancePhrase}`
}

export function CitedEvidenceNote({
  resolution,
}: {
  resolution: CitedEvidenceResolution
}): JSX.Element | null {
  if (resolution.state !== 'cited') return null

  const { author_label, stance_phrase, kind, body, url } = resolution.evidence
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
            {attributionSentence(author_label, stance_phrase)}
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
