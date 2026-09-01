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
import type { ReactNode } from 'react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { DisclosureRow } from '../DisclosureRow'
import { SectionShell } from './SectionShell'
import type { AnalysisNewFinding } from '../analysisNewTypes'

/**
 * ⭐⭐ A ROW BADGE MAY CARRY A CLAIM ABOUT ITS OWN ROW. IT MAY NOT RESTATE A
 * CLAIM ABOUT THE RUN.
 *
 * `provisional` and `not_assessed` are row-scoped: the view model sets them per
 * finding, from that finding's own data (`d.isDefaultedConfidence`,
 * `g.confidence == null`). `stale` is not — it is `isStale ? 'stale' :
 * undefined`, one run-level boolean stamped onto EVERY key insight. So a stale
 * run rendered "From an earlier run" up to `KEY_INSIGHT_PREVIEW` times, under a
 * ribbon that had already said it, under an eyebrow that had said it again.
 * Measured on staging `19fe8710`: three surfaces, one fact, all three true.
 *
 * ⚠ THE FACT IS NOT REMOVED, THE RESTATEMENTS ARE. `AtAGlance`'s ribbon states
 * it once, names the CONDITION ('changed' vs 'unconfirmed' — different
 * questions, `staleReason.ts`), and now cannot be dropped by an empty glance.
 * This function only decides how many times the surface says it.
 *
 * ⚠ DERIVED FROM THE MARKER'S SCOPE, NOT A LIST OF SECTIONS. Written as "drop
 * the run-scoped marker" rather than "drop markers in Key insights", so a later
 * `staleMarker` stamped on drivers or uncertainty is covered without anyone
 * remembering to update a list (CLAUDE.md trap 12).
 */
const RUN_SCOPED_MARKERS: ReadonlySet<NonNullable<AnalysisNewFinding['marker']>> = new Set(['stale'])

function withoutRunScopedMarker(finding: AnalysisNewFinding): AnalysisNewFinding {
  if (!finding.marker || !RUN_SCOPED_MARKERS.has(finding.marker)) return finding
  const { marker: _dropped, ...rest } = finding
  return rest
}

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
  /**
   * Rendered ABOVE the findings, inside the opened section — for a section
   * whose data has a visual form as well as a prose form.
   *
   * ⚠ IT DOES NOT KEEP AN EMPTY SECTION ALIVE. The early return below still
   * fires on no findings and no empty message, deliberately: a chart with no
   * rows under a heading is the same "heading promising content" defect §19
   * records, and the two are derived from ONE filtered list upstream, so they
   * are empty together or not at all.
   */
  header?: ReactNode
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
  header,
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
      /**
       * ⭐ A SECTION HOLDING EXACTLY ONE ITEM OPENS ITSELF.
       *
       * Progressive disclosure earns its keep by hiding BULK. At one item it
       * hides nothing worth hiding and charges a click for it: the collapsed
       * row — heading, count, chevron — is about as tall as the single line it
       * conceals, so the reader pays an interaction and gains no vertical
       * space. A count of "1" is also the least informative label this panel
       * produces; it tells you how many and never whether it matters.
       *
       * ⚠ THE HEIGHT ARGUMENT IS WHY IT STOPS AT ONE. `SectionShell`'s
       * default-closed rule exists because this panel measured 1,584px against
       * a 769px viewport — opening a section with several rows would spend that
       * fix. One row cannot.
       */
      defaultOpen={findings.length === 1}
      subtitle={subtitle}
      testId={testId}
    >
      {caveat ? (
        <p className={`${typography.panelMeta} text-text-light pb-1`} data-testid={`${testId}-caveat`}>
          {caveat}
        </p>
      ) : null}

      {/* ⚠ BELOW THE CAVEAT, ON PURPOSE. The caveat says what basis the
          magnitudes are on ("largest in this set", not a share of the outcome);
          a reader who meets the bars first has already formed the reading it
          exists to prevent. */}
      {header ?? null}

      {findings.length === 0 ? (
        emptyMessage ? (
          <p className={`${typography.panelBody} text-text-light`} data-testid={`${testId}-empty`}>
            {emptyMessage}
          </p>
        ) : null
      ) : (
        <>
          <div id={`${testId}-list`}>
            {visible.map((f) => (
              <DisclosureRow
                key={f.id}
                finding={withoutRunScopedMarker(f)}
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
              // The revealed rows are rendered ABOVE this button, so without a
              // jump target a screen-reader user hears "expanded" and finds
              // nothing ahead of them. One fix here covers every section that
              // uses this shared pattern.
              aria-controls={`${testId}-list`}
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
