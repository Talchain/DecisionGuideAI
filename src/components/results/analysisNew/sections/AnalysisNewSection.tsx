/**
 * Analysis (New) — the generic section shell used by Key insights, Drivers and
 * dynamics, and Uncertainty and gaps.
 *
 * Deliberately RESTRAINED (§10): a heading, an optional caveat line, hairline-
 * separated rows, and a "Show more" when the list is longer than its preview.
 * No card, no border, no nested container. The only section with a stronger
 * visual treatment is Strengthen the reasoning, and it earns it by being the
 * thing the experiment is testing.
 *
 * ⚠ THE "SHOW MORE" COUNT IS DERIVED FROM THE ACTUAL LIST, NOT PASSED IN. A
 * hand-passed count is a mirror, and a truncation that misreports how much it
 * hid reads as "you have seen everything" when you have not.
 */

import { useState } from 'react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { DisclosureRow } from '../DisclosureRow'
import type { AnalysisNewFinding } from '../analysisNewTypes'

export interface AnalysisNewSectionProps {
  title: string
  findings: AnalysisNewFinding[]
  /** How many rows before "Show more". Absent = show all. */
  preview?: number
  /**
   * Rendered under the heading when the section's data carries a caveat the
   * user must read to interpret it correctly (e.g. set-relative influence).
   */
  caveat?: string | null
  /** First-use explanation. Lives in the heading's title, never as a resting row. */
  subtitle?: string
  /**
   * What to say when there is nothing.
   *
   * ⚠ ABSENT MEANS THE WHOLE SECTION DISAPPEARS — heading included. An earlier
   * version rendered the heading alone, on the reasoning that a heading costs
   * little. MOUNTED PRE-RUN, THAT WAS WRONG: three bare headings stacked up
   * ("Key insights", "Drivers and dynamics", "Uncertainty and gaps"), ~19px
   * each, each one promising content and delivering none. A heading is a claim
   * that there is something under it. When there is nothing and nothing
   * truthful to say about the nothing, the honest render is no render.
   */
  emptyMessage?: string | null
  onFocusTarget?: (targetId: string) => void
  onRunIntervention?: (recommendationId: string) => void
  testId: string
}

export function AnalysisNewSection({
  title,
  findings,
  preview,
  caveat,
  subtitle,
  emptyMessage,
  onFocusTarget,
  onRunIntervention,
  testId,
}: AnalysisNewSectionProps) {
  const [expanded, setExpanded] = useState(false)

  // Nothing to show, and nothing truthful to say about its absence: render
  // NOTHING, not a heading over empty space (§19, corrected at the mount).
  if (findings.length === 0 && !emptyMessage) return null

  const limit = preview ?? findings.length
  const visible = expanded ? findings : findings.slice(0, limit)
  const hidden = findings.length - visible.length

  return (
    <section className="space-y-1" data-testid={testId} aria-labelledby={`${testId}-heading`}>
      {/* ⚠ THE HEADER IS THE COUNT, AND THE COUNT REPLACES THE SUBCOPY.
          "Top findings from the analysis" / "Recommended next steps" answered a
          first-use question permanently, on every visit, for every user — four
          such lines cost ~64px of a ~590px panel before a single finding was
          shown. A count is the one thing that changes per run, so it is the one
          thing worth the row. The explanation moves to the heading's `title`. */}
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${testId}-heading`} className={`${typography.panelHeader} text-text-header`} title={subtitle}>
          {title}
        </h3>
        {findings.length > 0 ? (
          <span className={`${typography.panelMeta} text-text-light shrink-0`} data-testid={`${testId}-count`}>
            {findings.length}
          </span>
        ) : null}
      </div>

      {caveat ? (
        <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-caveat`}>
          {caveat}
        </p>
      ) : null}

      {findings.length === 0 ? (
        emptyMessage ? (
          <p className={`${typography.panelBody} text-text-light`} data-testid={`${testId}-empty`}>
            {emptyMessage}
          </p>
        ) : null
      ) : (
        <>
          <div className="mt-1">
            {visible.map((f) => (
              <DisclosureRow
                key={f.id}
                finding={f}
                onFocusTarget={onFocusTarget}
                onRunIntervention={onRunIntervention}
                testIdPrefix={testId}
              />
            ))}
          </div>
          {hidden > 0 || expanded ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={`${typography.panelMeta} text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              data-testid={`${testId}-show-more`}
            >
              {expanded ? COPY.disclosure.collapse : COPY.disclosure.moreDrivers(hidden)}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}
