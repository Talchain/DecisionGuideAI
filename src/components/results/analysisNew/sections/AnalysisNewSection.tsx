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
  /**
   * What to say when there is nothing. Absent = render the heading and nothing
   * else, which is the right answer when an empty message would add no
   * comprehension (§19).
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
  emptyMessage,
  onFocusTarget,
  onRunIntervention,
  testId,
}: AnalysisNewSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const limit = preview ?? findings.length
  const visible = expanded ? findings : findings.slice(0, limit)
  const hidden = findings.length - visible.length

  return (
    <section className="space-y-1" data-testid={testId} aria-labelledby={`${testId}-heading`}>
      <h3 id={`${testId}-heading`} className={`${typography.panelHeader} text-text-header`}>
        {title}
      </h3>

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
