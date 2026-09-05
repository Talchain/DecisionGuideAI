/**
 * Analysis (New) — "Deeper analysis and evidence" (level 3).
 *
 * ONE collapsed region, never a fifth top-level IA section (§18). Everything
 * technical lands here: run identity, what the run covered, provenance, and the
 * grounded decision-quality prompts.
 *
 * ⚠ THE COVERAGE GROUP IS THE ONE MOST LIKELY TO BE MISREAD, AND THE ADAPTER
 * ALREADY GUARDS IT: those rows describe what this run did and did not cover.
 * They are NOT a readiness verdict. `RunAdmission` remains the sole authority
 * on whether analysis may run, and nothing on this surface reads it or speaks
 * for it. Uneven coverage is provenance; it does not make a result invalid, and
 * it is never offered as the cause of an ordering.
 *
 * ⚠⚠ AND ONE THING HERE IS DELIBERATELY *NOT* LEVEL 3.
 *
 * The two warning strips render OUTSIDE the collapsed region, always. They
 * carry what the ENGINE raised about this run, and on the existing Analysis tab
 * both are mounted in `ResultsBody`'s unconditional current-view group — that
 * tab refuses to collapse them. This tab is a separate `OutputsDock` branch and
 * never mounts `ResultsBody`, so until they were carried here they reached no
 * screen at all on this surface. A warning the product knows and does not say
 * is the worst thing this section can do; a warning behind a chevron the reader
 * never opens is the same thing with an alibi.
 *
 * They are the SAME components the existing tab mounts, fed the same producer
 * entries. Not a second rendering of the same idea — the same rendering. That
 * is what makes "two spellings of one disclosure" impossible here rather than
 * merely unlikely.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { SCIENCE_LIMITATIONS_DISCLOSURE } from '../../analysisMethodCopy'
import type { DeeperAnalysisSection } from '../analysisNewTypes'

export interface DeeperAnalysisProps {
  deeper: DeeperAnalysisSection
  testId?: string
}

export function DeeperAnalysis({ deeper, testId = 'analysis-new-deeper' }: DeeperAnalysisProps) {
  const [open, setOpen] = useState(false)

  const hasGroups = deeper.groups.length > 0

  // Nothing to inspect renders nothing at all — an empty expander is an
  // affordance that lies about having content behind it. Pre-run this is the
  // whole section: the adapter returns every list empty rather than describing
  // a run that has not happened.
  //
  // ⚠ THE WARNING STRIPS ARE NOT HERE ANY MORE, and the reason is placement,
  // not ownership. #1039 mounted them above this toggle because they had no
  // consumer on this tab at all. That was right about the absence and wrong
  // about the position: this section sits at the BOTTOM, and a caveat that
  // arrives after the reading it qualifies is a footnote. They now mount at the
  // top of `AnalysisNewTabBody`, outside any collapsible.
  if (!hasGroups) return null

  return (
    <section data-testid={testId}>
      {hasGroups ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={open ? `${testId}-region` : undefined}
            className={`${typography.panelBody} text-text-light flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-toggle`}
          >
            {open ? (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {COPY.sections.deeper}
          </button>

          {open ? (
            <div id={`${testId}-region`} className="mt-2 space-y-3 pl-5">
              {deeper.groups.map((group) => (
                <div key={group.title} data-testid={`${testId}-group`}>
                  <h4 className={`${typography.panelMeta} text-text-header`}>{group.title}</h4>
                  {/* ⚠ THE KEY IS POSITIONAL, AND THE REASON IS NARROWER THAN
                      IT FIRST LOOKED — stated at the measurement, not at the
                      hunch.
                      It was `r.label`, and labels are NOT unique here: a
                      producer that raises the same inference-warning code about
                      two different nodes yields two rows sharing one label,
                      which is exactly what the real capture at `a9fc1564` did.
                      React warns on that and calls the behaviour unsupported
                      ("may be duplicated and/or omitted").
                      ⚠ NO OMISSION IS DEMONSTRATED. A probe rendered a
                      duplicate-keyed pair and then re-rendered it with a third
                      row inserted, at this React version: all rows rendered
                      both times, and reverting this key to `r.label` left the
                      row-count case GREEN — a surviving mutant, recorded rather
                      than dressed up. So this is precautionary against a
                      behaviour React declines to guarantee, plus the removal of
                      a real console warning; it is NOT a fix for a witnessed
                      dropped row. Row order is the producer's emission order
                      and is never re-sorted here, so the index is a stable
                      identity by construction. */}
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {group.rows.map((r, i) => (
                      <div key={`${i}:${r.label}`} className="contents">
                        {/* ⚠ A STATEMENT ROW IS NOT A TERM/DEFINITION PAIR, and
                            rendering it as one is what printed a machine code to
                            the user. Its `label` is the producer's code: kept in
                            the DOM for support, tests and assistive tech, but not
                            given the `<dt>` column, because the column's whole
                            visual job is "this names the thing beside it" and a
                            code does not name a sentence.
                            The `<dl>` stays valid — every `<dd>` still has its
                            `<dt>` — and the six term/definition groups are
                            untouched, since the flag is opt-in per row.

                            ⚠⚠ THE CODE IS NOT PRINTED AFTER THE SENTENCE EITHER,
                            AND THE FIRST VERSION OF THIS CHANGE WAS WRONG TO DO
                            SO (review S1). It appended ` (ROOT_NODE_DEFAULT_VALUE)`
                            de-emphasised, citing "the estate's ratified shape".
                            That generalised a ruling scoped to ONE surface:
                            `auditInferenceWarningsNeverBareCode.spec.tsx` opens
                            "The Model card's audit trail…", and the rule it
                            enforces — `humaniseCritique.ts`'s own words — is that
                            "a machine code is correct content for an AUDIT TRAIL
                            and wrong content for a CAVEAT STRIP". This group is
                            the caveat surface; the Model tab is the audit trail,
                            and it lists the code regardless, which is where that
                            fallback sentence already points the reader.
                            The disconfirming case was live in the repo the whole
                            time: `AdvancedSection.tsx:383-398` renders the
                            IDENTICAL entries — the same
                            `selectHumanisedInferenceWarningsOutsideStrip` call —
                            as a bare sentence with no code at all. Printing it
                            here would have made this panel the only surface
                            showing SCREAMING_SNAKE to a reader.
                            The code stays in the DOM twice over — the `sr-only`
                            `<dt>` (so the `<dl>` keeps a term and support can
                            quote it) and `data-gap-code` — so nothing loses
                            traceability. Pinned in both directions by
                            `gapCodeIsNotTheHeading.spec.tsx`. */}
                        {r.statement ? (
                          <>
                            <dt className="sr-only">{r.label}</dt>
                            <dd
                              className={`${typography.panelMeta} text-text-body break-words min-w-0 col-span-2`}
                              data-gap-code={r.label || undefined}
                            >
                              {r.value}
                            </dd>
                          </>
                        ) : (
                          <>
                            <dt className={`${typography.panelMeta} text-text-light break-words`}>{r.label}</dt>
                            <dd className={`${typography.panelMeta} text-text-body break-words min-w-0`}>{r.value}</dd>
                          </>
                        )}
                      </div>
                    ))}
                  </dl>
                </div>
              ))}

              {/* ⚠ THE STANDING METHOD DISCLOSURE, and it is a trust surface,
                  not furniture. The existing tab states it inside "Advanced and
                  receipts" on every run; without it this panel is quietly more
                  confident than the analysis warrants. Imported from the one
                  constant both surfaces read — see `analysisMethodCopy.ts` for
                  why it is not typed out again here. */}
              <p
                className={`${typography.panelMeta} text-text-light`}
                data-testid={`${testId}-science-limitations`}
              >
                {SCIENCE_LIMITATIONS_DISCLOSURE}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
