/**
 * V7WhatIWasGivenSection — ROADMAP 2.973, "what I was given / what I used".
 *
 * The product's answer to *"what did you keep, and what did you leave out?"*.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The 2026-08-08 context-integrity trace drove the deployed system with three
 * real strategic briefs and measured that quantities surviving into the model
 * with unit AND magnitude intact were 3/17, 5/14 and 1/14 — and that the user
 * is told none of it. The brief itself is persisted byte-verbatim and read by
 * nothing. This section reads it, beside CEE's derived manifest of what did not
 * make it, so the loss is visible instead of silent.
 *
 * ── PROGRESSIVE DISCLOSURE (P5) ────────────────────────────────────────────
 * Collapsed by default, one quiet line. It does not shout, it does not colour
 * itself like a warning, and it never blocks anything. Reuses the house
 * disclosure idiom verbatim (`V7EvidenceDisclosure`: `useState(false)` +
 * full-width `aria-expanded` button + `ChevronDown` rotate) and
 * `WhatOlumiAddedSection`'s deliberate plain-`div` rows — a transparency
 * surface must not borrow the visual grammar of action cards.
 *
 * ── THE HONESTY RULE THIS COMPONENT ENFORCES ───────────────────────────────
 * `manifest === null` means CEE told us NOTHING (its deployed build predates
 * the field, or the shape failed to validate). It is rendered as an explicit
 * "we cannot show you this" — NEVER as an empty list. An empty list here would
 * tell a user whose figures we demonstrably dropped that everything survived,
 * which is a worse lie than the silence it replaces, because it carries the
 * authority of a measurement.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { typography } from '../../../styles/typography'
import { useContextIntegrityStore } from '../../../canvas/stores/contextIntegrityStore'
import type { NotModelledItem } from '../../../adapters/cee/notModelled'

/** Rows shown per group before "show all". Keeps the open state scannable. */
const VISIBLE_ROWS = 8

const COPY = {
  heading: 'What I was given, and what I used',
  briefHeading: 'Your brief, as you wrote it',
  absentHeading: 'Figures you stated that are not in the model',
  proseHeading: 'Mentioned in the explanation, but not used as a value',
  keptHeading: 'Figures that reached the model',
  declaredHeading: 'Things I considered and left out',
  declaredUnknown:
    'The drafting step did not record anything it left out. That is not the same as leaving nothing out — it did not report either way.',
  notTrackedLead: 'This list only covers figures you stated. It does not track:',
  unknown:
    'This version cannot show what was left out. The model was built before this check existed, so nothing here should be read as "nothing was dropped".',
  noBrief: 'No original brief is stored for this decision.',
} as const

/**
 * Human labels for the loss classes CEE reports as untracked. An unrecognised
 * code is rendered VERBATIM rather than dropped — the producer owns this
 * vocabulary, and silently hiding a class we do not have copy for would defeat
 * the entire point of the field.
 */
const NOT_TRACKED_COPY: Readonly<Record<string, string>> = {
  competing_or_dissenting_proposals: "colleagues' competing proposals",
  corrections_and_second_thoughts: 'corrections and second thoughts',
  named_evidence_sources_and_their_pedigree: 'where your evidence came from',
  qualitative_constraints_and_rules: 'constraints stated in words rather than numbers',
  stated_confidence_and_self_flagged_weakness: 'how confident you said you were',
  statements_the_drafting_model_did_not_report_discarding:
    'anything the drafting step discarded without recording it',
}

function QuantityRows({
  items,
  testId,
}: {
  items: readonly NotModelledItem[]
  testId: string
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, VISIBLE_ROWS)
  const moreCount = items.length - visible.length

  return (
    <div className="space-y-1" data-testid={testId}>
      {visible.map((item) => (
        // Keyed and addressed by IDENTITY (offset + literal), never by value:
        // a brief can state the same figure twice and they are different facts.
        <div
          key={`${item.charOffset}:${item.literal}`}
          data-testid={`${testId}-row`}
          data-char-offset={item.charOffset}
          data-kind={item.kind}
          className="flex items-baseline gap-2 rounded px-2 py-1 odd:bg-panel-hover/40"
        >
          <span className={`${typography.panelBody} font-medium text-text-body`}>
            {item.literal}
          </span>
        </div>
      ))}
      {moreCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          data-testid={`${testId}-show-all`}
          className={`${typography.panelMeta} px-2 py-1 text-text-light underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          Show {moreCount} more
        </button>
      )}
    </div>
  )
}

export function V7WhatIWasGivenSection() {
  const [open, setOpen] = useState(false)
  const briefText = useContextIntegrityStore((s) => s.briefText)
  const manifest = useContextIntegrityStore((s) => s.manifest)

  // Nothing to say at all: no brief on file AND no manifest. Rendering an empty
  // shell would be noise, and the group's `empty:hidden` keeps layout clean.
  if (briefText === null && manifest === null) return null

  const tally = manifest?.status === 'derived' ? manifest.quantities : null
  const items = tally?.items ?? []
  const absent = items.filter((i) => i.verdict === 'absent')
  const proseOnly = items.filter((i) => i.verdict === 'prose_only')
  const kept = items.filter((i) => i.verdict === 'in_model')

  // The one-line summary. It states a COUNT, never a reassurance, and when we
  // have no manifest it says so rather than falling back to a zero.
  const subtitle =
    tally === null
      ? 'We cannot show what was left out'
      : `${absent.length} of ${tally.total} figures you stated are not in the model`

  return (
    <section
      data-testid="what-i-was-given-section"
      className="rounded-lg border border-panel-border bg-panel px-3 py-1.5"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="what-i-was-given-body"
        onClick={() => setOpen((o) => !o)}
        data-testid="what-i-was-given-toggle"
        className="flex w-full items-center gap-2 rounded py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} block text-text-header`}>
            {COPY.heading}
          </span>
          <span
            className={`${typography.panelMeta} block text-text-light`}
            data-testid="what-i-was-given-summary"
          >
            {subtitle}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id="what-i-was-given-body" className="mt-1 space-y-3 pb-2">
          {/* ── What I was given: the user's own words, verbatim ── */}
          <div>
            <h4 className={`${typography.panelHeader} text-text-header`}>
              {COPY.briefHeading}
            </h4>
            {briefText === null ? (
              <p className={`${typography.panelBody} text-text-light`}>{COPY.noBrief}</p>
            ) : (
              <blockquote
                data-testid="what-i-was-given-brief"
                className={`${typography.panelBody} mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-panel-border bg-panel-hover/40 px-2 py-1.5 text-text-body`}
              >
                {briefText}
              </blockquote>
            )}
          </div>

          {/* ── What I used: only ever rendered from a DERIVED manifest ── */}
          {tally === null ? (
            <p
              data-testid="what-i-was-given-unknown"
              className={`${typography.panelBody} text-text-light`}
            >
              {COPY.unknown}
            </p>
          ) : (
            <>
              {absent.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.absentHeading}
                  </h4>
                  <QuantityRows items={absent} testId="what-i-was-given-absent" />
                </div>
              )}
              {proseOnly.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.proseHeading}
                  </h4>
                  <QuantityRows items={proseOnly} testId="what-i-was-given-prose" />
                </div>
              )}
              {kept.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.keptHeading}
                  </h4>
                  <QuantityRows items={kept} testId="what-i-was-given-kept" />
                </div>
              )}
            </>
          )}

          {/* ── What the drafting step itself said it left out ──
                 The highest-value half: it covers competing proposals and other
                 non-numeric losses that the figure check is blind to. Rendered
                 VERBATIM — these are the model's own reasons, and paraphrasing
                 them would put our words in its mouth. */}
          {manifest !== null && manifest.declaredExclusions.status === 'reported' && (
            <div>
              <h4 className={`${typography.panelHeader} text-text-header`}>
                {COPY.declaredHeading}
              </h4>
              <ul className="mt-1 space-y-1" data-testid="what-i-was-given-declared">
                {manifest.declaredExclusions.items.map((text) => (
                  <li
                    key={text}
                    data-testid="what-i-was-given-declared-row"
                    className={`${typography.panelBody} rounded px-2 py-1 text-text-body odd:bg-panel-hover/40`}
                  >
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* An empty exclusion list is NOT "nothing was excluded", and saying
              so is the whole reason this branch exists rather than rendering
              nothing. On the trace corpus the brief that lost the most reported
              exactly this. */}
          {manifest !== null && manifest.declaredExclusions.status !== 'reported' && (
            <p
              data-testid="what-i-was-given-declared-unknown"
              className={`${typography.panelBody} text-text-light`}
            >
              {COPY.declaredUnknown}
            </p>
          )}

          {/* ── The caveat travels with the findings, always. Without it the
                 list above reads as exhaustive, and it is not. ── */}
          {manifest !== null && manifest.notTracked.length > 0 && (
            <p
              data-testid="what-i-was-given-not-tracked"
              className={`${typography.panelMeta} text-text-light`}
            >
              {COPY.notTrackedLead}{' '}
              {manifest.notTracked.map((c) => NOT_TRACKED_COPY[c] ?? c).join('; ')}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
