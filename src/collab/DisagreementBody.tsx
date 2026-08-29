/**
 * COLLAB — WHY TWO VIEWS DIFFER, rendered structurally.
 *
 * The reveal answers "what did everyone say?". This answers "where do you
 * differ, on what basis, and what should you ask about it?" — which is the
 * difference between a list of numbers and a shared piece of reasoning.
 *
 * ── EVERY SENTENCE OF REASONING COPY COMES FROM CEE ───────────────────────
 * `headline` and `question` are rendered VERBATIM from the response. This
 * component composes no interpretation of its own, and that is a hard rule
 * rather than a style preference: those strings are pinned by a CEE suite that
 * asserts, across every string that module can emit, that none of them averages,
 * ranks or names a winner. Copy written HERE would sit outside that guarantee
 * and nothing in this repo would notice it drift.
 *
 * ⚠ If a designer wants different words, they change `disagreement-copy.ts` in
 * CEE, where the guard is. Do not "improve" them locally.
 *
 * ── AND WHAT THIS COMPONENT MUST NEVER GROW ───────────────────────────────
 * No mean, no midpoint, no "recommended", no consensus line, no ordering of
 * people by how well-supported their view looks. `spread` is rendered as two
 * attributed endpoints and a distance — as a sentence AND, since the strip
 * landed, as a picture — never as a single number standing in for the
 * positions. A lone dissenter renders exactly like anyone else.
 *
 * ⚠ THE PICTURE IS HELD TO A STRICTER VERSION OF THAT RULE, NOT A LOOSER ONE.
 * A drawn average is more persuasive than a written one, so `SpreadStrip` may
 * carry no mean line, no midpoint tick, no shaded band and no box plot — only
 * the two real endpoints, one dot per person at their own number, and the
 * model's own value marked as the model's. Its header states the rule; this
 * one names it too, because the temptation arrives at THIS call site.
 */

import { AlertTriangle, ExternalLink, Quote } from 'lucide-react'

import { typography } from '../styles/typography'
import { formatPanelValue } from './formatPanelValue'
import { SpreadSection } from './SpreadStrip'
import type {
  DisagreementEvidence,
  DisagreementTarget,
  DisagreementView,
} from './collabService'

const CARD = 'rounded-[20px] border border-panel-border bg-panel p-6 shadow-1 sm:p-8'

/**
 * ⚠ A SECOND, INDEPENDENT SCHEME CHECK. CEE already validates evidence URLs to
 * http/https with the URL parser and stores the normalised form, so this is
 * defence in depth — and it is worth having precisely because the failure it
 * guards is silent: a stored `javascript:` href renders as an ordinary link
 * carrying a colleague's name, and the person who clicks it has every reason to
 * trust it. Two independent gates on a stored-XSS path is the correct number
 * when one of them lives in another service on another deploy cadence.
 *
 * Returns null for anything it will not render as a link. The body text is
 * still shown — the evidence is not lost, only its link.
 */
export function safeHref(url: string | null): string | null {
  if (url === null || url === '') return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function EvidenceCard({ evidence }: { evidence: DisagreementEvidence }): JSX.Element {
  const href = safeHref(evidence.url)
  return (
    <li
      data-testid={`disagreement-evidence-${evidence.event_id}`}
      data-stance={evidence.stance}
      className={`${typography.body} rounded-md border border-panel-border bg-canvas p-4 text-text-body`}
    >
      {/* ⭐ ATTRIBUTION FIRST, then what it does, then whose position it is
          about. The author label is the SERVER-resolved one (pseudonymised if
          the person has been redacted), never an id this bundle holds. */}
      <p className={typography.bodySmall}>
        <strong className="font-semibold text-text-header">{evidence.author_label}</strong>{' '}
        <span className="text-text-light">
          {evidence.stance_phrase}{' '}
          {evidence.about_label !== null
            ? `${evidence.about_label}’s view`
            : 'this factor'}
        </span>
      </p>
      <p className="mt-2 flex gap-2 text-text-body">
        <Quote className="mt-1 h-3.5 w-3.5 shrink-0 text-text-light" aria-hidden />
        {/* The person's own words, verbatim. */}
        <span data-testid={`disagreement-evidence-body-${evidence.event_id}`}>{evidence.body}</span>
      </p>
      {href !== null && (
        <a
          data-testid={`disagreement-evidence-link-${evidence.event_id}`}
          href={href}
          // `noopener` is the security half (a target=_blank opener can navigate
          // this tab); `noreferrer` keeps a private staging URL out of the
          // destination's logs.
          target="_blank"
          rel="noopener noreferrer"
          className={`${typography.bodySmall} mt-2 inline-flex items-center gap-1 text-text-header underline`}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open the source
        </a>
      )}
      {evidence.url !== null && href === null && (
        // Visible, not swallowed. Somebody attached a link this product will not
        // open, and the honest thing is to say so rather than silently drop it.
        <p className={`${typography.bodySmall} mt-2 text-text-light`}>
          A link was attached that cannot be opened safely, so it is not shown.
        </p>
      )}
    </li>
  )
}

function TargetSection({ row }: { row: DisagreementTarget }): JSX.Element {
  return (
    <section data-testid={`disagreement-target-${row.target.id}`} className={`${CARD} mt-6`}>
      <h2 className={`${typography.h4} text-text-header`}>
        {row.label !== '' ? row.label : row.target.id}
      </h2>

      {/* CEE's words, verbatim. */}
      <p
        data-testid={`disagreement-headline-${row.target.id}`}
        data-shape={row.shape}
        className={`${typography.bodySmall} mt-2 text-text-light`}
      >
        {row.headline}
      </p>

      {row.model_value_at_version !== null && (
        <p className={`${typography.bodySmall} mt-1 text-text-light`}>
          The model held {formatPanelValue(row.model_value_at_version)} for this when the round opened.
        </p>
      )}

      {row.spread !== null && (
        // TWO ENDPOINTS AND A DISTANCE, now DRAWN as well as stated.
        // Deliberately still not "the average is X" and still not a bar with a
        // midpoint marker: both would put a number on screen that nobody in the
        // room actually said, and a drawn one is the more persuasive of the two.
        // `SpreadSection` keeps the sentence and the picture together so no
        // caller can mount the picture without the words.
        <SpreadSection
          targetId={row.target.id}
          spread={row.spread}
          positions={row.positions}
          modelValue={row.model_value_at_version}
        />
      )}

      <ul className="mt-4 space-y-3">
        {row.positions.map((p) => (
          <li
            key={p.participant_id}
            data-testid={`disagreement-position-${p.participant_id}`}
            data-pole={p.pole ?? 'none'}
            className={`${typography.body} rounded-md border border-panel-border p-4 text-text-body`}
          >
            <strong className="font-semibold text-text-header">{p.display_label}</strong>
            {p.kind === 'declined' ? (
              <span className="text-text-light"> chose not to answer this one.</span>
            ) : (
              <>
                <span data-testid={`disagreement-value-${p.participant_id}`}> {formatPanelValue(p.value)}</span>
                {/* ⭐ THE STATED BASIS IS THE POINT OF THIS SURFACE. Where the
                    reveal shows it as an aside, here it is the thing being
                    compared — and its ABSENCE is called out, because a position
                    nobody explained is the one you cannot interrogate. */}
                {p.stated_basis !== null && p.stated_basis !== '' ? (
                  <p
                    data-testid={`disagreement-basis-${p.participant_id}`}
                    className={`${typography.bodySmall} mt-2 text-text-body`}
                  >
                    &ldquo;{p.stated_basis}&rdquo;
                  </p>
                ) : (
                  <p
                    data-testid={`disagreement-no-basis-${p.participant_id}`}
                    className={`${typography.bodySmall} mt-2 text-text-light`}
                  >
                    No reason given.
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {row.evidence.length > 0 && (
        <div className="mt-5">
          <h3 className={`${typography.bodySmall} font-semibold text-text-header`}>
            Evidence people attached
          </h3>
          <ul className="mt-2 space-y-3">
            {row.evidence.map((e) => (
              <EvidenceCard key={e.event_id} evidence={e} />
            ))}
          </ul>
        </div>
      )}

      {/* CEE's question, verbatim, last — after the reader has the positions it
          refers to. Absent when there is nothing to interrogate: a surface that
          always has something to say teaches people to stop reading it. */}
      {row.question !== null && (
        <p
          role="note"
          data-testid={`disagreement-question-${row.target.id}`}
          className={`${typography.body} mt-5 flex gap-2 rounded-md border border-panel-border bg-canvas p-4 text-text-body`}
        >
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-text-light" aria-hidden />
          <span>{row.question}</span>
        </p>
      )}
    </section>
  )
}

export function DisagreementBody({ view }: { view: DisagreementView }): JSX.Element {
  return (
    <div data-testid="collab-disagreement">
      <h1 className={`${typography.h2} text-text-header`}>Where you differ</h1>
      {/* ⭐ CEE'S WORDS, VERBATIM — and this paragraph is the reason the rule at
          the top of this file needed enforcing rather than stating. It used to
          be written HERE, which put the one sentence promising that nothing is
          combined outside the guard that proves nothing is combined.

          ⚠ Rendered only when the server sent one. There is deliberately NO
          fallback string: a local default would be a second authority wearing
          the clothes of resilience, and an absent sentence is honest where an
          invented one is not. */}
      {typeof view.standing_note === 'string' && view.standing_note !== '' && (
        <p data-testid="disagreement-standing-note" className={`${typography.body} mt-3 text-text-body`}>
          {view.standing_note}
        </p>
      )}
      {view.per_target.map((row) => (
        <TargetSection key={`${row.target.kind}:${row.target.id}`} row={row} />
      ))}
    </div>
  )
}
