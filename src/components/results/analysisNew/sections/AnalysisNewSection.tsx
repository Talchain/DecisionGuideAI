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

import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { DisclosureRow } from '../DisclosureRow'
import { SectionShell } from './SectionShell'
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
  /** Row icon. Furniture — it never encodes a value. */
  icon?: LucideIcon
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
  icon,
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
    <SectionShell
      title={title}
      icon={icon}
      // ⚠ THE COUNT IS THE ACTUAL LIST LENGTH, and it is `null` — no number at
      // all — when the section is empty. A collapsed row reading "0" invites a
      // click on nothing; the honest empty section still opens to its sentence,
      // which is a claim about the run and must stay reachable.
      count={findings.length > 0 ? findings.length : null}
      subtitle={subtitle}
      testId={testId}
    >
      {caveat ? (
        <p className={`${typography.panelMeta} text-text-light pb-1`} data-testid={`${testId}-caveat`}>
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
          <div>
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
              className={`${typography.panelMeta} text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info mt-1`}
              data-testid={`${testId}-show-more`}
            >
              {expanded ? COPY.disclosure.collapse : COPY.disclosure.moreDrivers(hidden)}
            </button>
          ) : null}
        </>
      )}
    </SectionShell>
  )
}
