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
import { action } from '../panelSurfaces'

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
   * ⚠ ABSENT MEANS THE WHOLE SECTION DISAPPEARS — heading included — UNLESS a
   * `header` is supplied, which is itself content. An earlier
   * version rendered the heading alone, on the reasoning that a heading costs
   * little. MOUNTED PRE-RUN, THAT WAS WRONG: three bare headings stacked up
   * ("Key insights", "Drivers and dynamics", "Uncertainty and gaps"), ~19px
   * each, each one promising content and delivering none. A heading is a claim
   * that there is something under it. When there is nothing and nothing
   * truthful to say about the nothing, the honest render is no render.
   */
  emptyMessage?: string | null
  onFocusTarget?: (targetId: string) => void
  /** Routes a row to the editor for its subject. Threaded, never composed here. */
  onReviewTarget?: (targetId: string) => void
  onRunIntervention?: (recommendationId: string) => void
  /** Work through a finding with Olumi. Passed straight through to the row. */
  onAskOlumi?: (finding: AnalysisNewFinding) => void
  /**
   * Rendered ABOVE the findings, inside the opened section — for a section
   * whose data has a visual form as well as a prose form.
   *
   * ⚠⚠ THIS DOCBLOCK USED TO SAY THE OPPOSITE, AND IT WAS THE AUTHORITY A
   * MAINTAINER WOULD READ. It said "IT DOES NOT KEEP AN EMPTY SECTION ALIVE",
   * arguing that a chart and its rows come from ONE filtered list upstream and
   * so are empty together. That is true of DRIVERS and false of SENSITIVITY,
   * whose header carries producer statements (convergence, tipping points)
   * built from a DIFFERENT array than its findings — which is exactly how a
   * real threshold came to be deleted by a guard about findings.
   *
   * ⭐ A HEADER IS CONTENT. It keeps the section alive, and `sectionOpensItself`
   * below decides whether the section may also hide it.
   */
  header?: ReactNode
  /** Row icon. Furniture — it never encodes a value. */
  icon?: LucideIcon
  testId: string
  /**
   * V2 gap 23: forwarded to `SectionShell` verbatim. `'label'` is for a
   * caller that nests this section INSIDE another `SectionShell` ("Drivers
   * and dynamics" inside "What moves the outcome") — see `SectionShell`'s own
   * doc for why the demotion drops the heading tag entirely rather than just
   * restyling it, and why it does not touch disclosure behaviour. Default
   * `'h3'`, the shape every other caller of this component already gets.
   */
  headingLevel?: 'h3' | 'label'
}

/**
 * ⭐⭐ A ROW THAT ADVERTISES NOTHING MAY NOT HIDE SOMETHING.
 *
 * `SectionShell` UNMOUNTS a closed region (`SectionShell.tsx`, `{open ? … :
 * null}`), so content behind a closed section is not "one click away" — it is
 * ABSENT FROM THE DOCUMENT. That is only honest where the collapsed row tells
 * the reader what is behind it, and the count badge is that advertisement.
 * `SectionShell` coerces a count of 0 to no badge at all, on its own stated
 * grounds: "a 0 promises nothing is behind the row and then invites a press
 * anyway".
 *
 * So NO FINDINGS + A HEADER is the one combination where the row promises
 * nothing and the body is real producer output. Witnessed on the sensitivity
 * section: a run that found a tipping point and no sensitivity rows rendered
 * "What would change your mind" with no count, closed, and the threshold
 * sentence nowhere in the document — the section guard was widened to keep it
 * alive, and it still could not be read.
 *
 * ⚠ `emptyMessage` IS THE DISCRIMINATOR, AND IT ANSWERS A DIFFERENT QUESTION
 * FROM `header` (trap 21). A header is CONTENT — something the run produced.
 * An empty message is a STATEMENT ABOUT ABSENCE — true, worth keeping
 * reachable, and not worth the height budget by default. Drivers passes an
 * unconditional chart as its header AND an empty message on every post-run
 * path, so it is untouched by this; without the `emptyMessage` conjunct it
 * would auto-open on every driverless run to show an empty chart above a
 * sentence explaining there is nothing to chart.
 *
 * ⚠ AND THE HEIGHT ARGUMENT IS WHY THIS ARM IS SAFE. `SectionShell`'s
 * default-closed rule exists because this panel measured 1,584px against a
 * 769px viewport. The findings arm stops at one row for that reason; a header
 * with NO rows under it cannot spend that budget either.
 */
export function sectionOpensItself(
  findingCount: number,
  hasHeader: boolean,
  hasEmptyMessage: boolean,
): boolean {
  if (findingCount === 1) return true
  return findingCount === 0 && hasHeader && !hasEmptyMessage
}

export function AnalysisNewSection({
  title,
  findings,
  preview,
  caveat,
  subtitle,
  emptyMessage,
  onFocusTarget,
  onReviewTarget,
  onRunIntervention,
  onAskOlumi,
  icon,
  header,
  testId,
  headingLevel,
}: AnalysisNewSectionProps) {
  const [expanded, setExpanded] = useState(false)

  // Nothing to show, and nothing truthful to say about its absence: render
  // NOTHING, not a heading over empty space (§19, corrected at the mount).
  /**
   * ⛔ A HEADER IS CONTENT — and this predicate asked a narrower question than
   * its job (trap 21). It answered *"are there FINDINGS?"* while the section's
   * actual question is *"is there anything to show?"*.
   *
   * Found by independent review on #1625: the sensitivity section passes
   * `emptyMessage={null}`, so a run that produced a real tipping point
   * ("Tech Lead Presence would have to rise from 0.6 to 0.96 before Two
   * Developers comes out ahead") and no sensitivity rows had that sentence
   * DISCARDED here — a producer statement deleted by a guard about a different
   * field. The convergence header cannot reach this case (it needs two rows),
   * so nothing that renders today changes.
   */
  if (findings.length === 0 && !emptyMessage && !header) return null

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
       * THE LICENCE `SectionShell` ASKS EVERY CALLER TO STATE: this section
       * opens itself where disclosure would hide something the collapsed row
       * does not advertise — one finding, or a header with no findings under
       * it. The argument for both arms, and the reason the second needs the
       * `emptyMessage` conjunct, is on `sectionOpensItself` above.
       *
       * ⚠ STATED ONCE, NOT TWICE. This used to carry the whole argument, which
       * made it a second copy of a rule that now has a named home — the mirror
       * this file's own header warns about (trap 12).
       */
      defaultOpen={sectionOpensItself(findings.length, Boolean(header), Boolean(emptyMessage))}
      subtitle={subtitle}
      testId={testId}
      headingLevel={headingLevel}
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
                onReviewTarget={onReviewTarget}
                onRunIntervention={onRunIntervention}
                onAskOlumi={onAskOlumi}
                testIdPrefix={testId}
                /* ⭐ ONE FINDING, ONE DOOR. The section above opens itself on
                   a single finding, for a reason it states: one row cannot
                   spend the height budget. The row then stayed SHUT, so
                   opening the section revealed a second closed door and the
                   reader spent two clicks on one sentence — measured on
                   deployed staging, "Key insights 1" open with its single
                   insight collapsed beneath it.

                   ⚠ THIS IS THE FINDINGS ARM ONLY, and it no longer shares an
                   expression with the section's. `sectionOpensItself` also
                   opens a section whose only content is a HEADER — a case that
                   by definition has no rows, so a row-level rule cannot speak
                   to it. Two questions, written apart (trap 21). With two or
                   more findings this is false and every row opens on demand,
                   because THEN the height argument actually bites. */
                defaultOpen={findings.length === 1}
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
              className={`${typography.panelMeta} ${action('inline')} mt-1`}
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
