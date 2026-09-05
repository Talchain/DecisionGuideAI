/**
 * What your model implies — the two readings, and whether they agree.
 *
 * ── WHAT THIS RENDERS AND WHY IT IS NOT A COLLAPSED ROW ────────────────────
 * Every other section on this surface rests as a one-line disclosure row, and
 * that IA is right: the tab's job is a 5-to-10-second read, and detail belongs
 * one click away. This block is the deliberate exception, for one reason —
 * when the two readings DISAGREE, that disagreement is the most decision-
 * relevant sentence the run produced, and a reader who never opens the row
 * never learns their two most defensible readings point at different options.
 * A finding that changes the decision cannot rest behind a chevron.
 *
 * It is kept to three short lines so the exception costs the first viewport
 * almost nothing: a lead, the two claims, and a close.
 *
 * ── ⚠ IT DECIDES NOTHING ───────────────────────────────────────────────────
 * Every sentence here arrives pre-composed on the view model. This component
 * chooses no option, formats no number, and compares nothing. If it is ever
 * tempted to, the rule it would be re-implementing lives in
 * `utils/selectGoalLeader.ts` and must be called, not copied.
 *
 * ── DS v5 ──────────────────────────────────────────────────────────────────
 * Three sizes only (`panelHeader` / `panelBody` / `panelMeta`), sentence case,
 * no raw weights. COMPLETE borders only — never a one-sided accent edge, which
 * is a categorical rule here and a CI guard. Fluid at the 280px dock floor and
 * at the 480px drag maximum; no viewport breakpoint decides panel layout.
 */

import { GitBranch, Target } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ModelImplication as ModelImplicationModel } from '../analysisNewTypes'

export interface ModelImplicationProps {
  implication: ModelImplicationModel
  /**
   * ⚠ THIS BLOCK IS THE ONLY ONE ON THE PANEL THAT DOES NOT REST BEHIND A
   * CHEVRON, and it makes the strongest claim on the surface — which is exactly
   * why it needs its own staleness qualifier rather than relying on the ribbon
   * far above it. Raised by review when the block was first mounted: before
   * that it had no importers, so the exposure did not exist.
   *
   * `markers.stale` is the panel's existing word for this ("From an earlier
   * run") — not a second wording of one fact.
   */
  isStale?: boolean
  /**
   * ⚠ WHETHER ANOTHER SURFACE IS ALREADY ASKING FOR THE SUCCESS TARGET.
   *
   * The `needs_target` reading closes with "Set a success target and the same
   * run also answers which option is most likely to hit it" — an ASK. The model
   * strip asks for the same thing, and `successTargetAskedOnce.spec.tsx` exists
   * because this panel once put one fact on screen four times, three of them
   * here. Mounting this block created a new claimant that neither ask-once
   * guard could see, because neither mentions `implication` or `needs_target`.
   *
   * When the strip is already asking, this block keeps its OUTCOME reading and
   * drops the ask. The finding is not lost; the third request for one thing is.
   */
  targetAskedElsewhere?: boolean
  testId?: string
}

/**
 * One reading. The marker is a dot, never a number or a rank — these two
 * readings are not ordered and drawing "1." and "2." would imply a precedence
 * the run does not establish.
 */
function Claim({ sentence, testId }: { sentence: string; testId: string }) {
  return (
    <li className={`${typography.panelBody} text-text flex gap-2 m-0`} data-testid={testId}>
      <span aria-hidden="true" className="text-text-light select-none">
        &bull;
      </span>
      <span>{sentence}</span>
    </li>
  )
}

export function ModelImplication({
  implication,
  isStale = false,
  targetAskedElsewhere = false,
  testId = 'analysis-new-implication',
}: ModelImplicationProps) {
  if (implication.kind === 'none') return null

  const diverged = implication.kind === 'diverged'
  const needsTarget = implication.kind === 'needs_target'

  /**
   * ⚠ TINT AND ICON CARRY EMPHASIS, NEVER A VERDICT. Divergence is not a
   * warning: both readings are sound, and colouring it as a problem would tell
   * the reader to discount the single most useful thing on the surface. The
   * diverged state gets the attention tint because it is the state worth
   * stopping on, not because anything went wrong.
   */
  const Icon = diverged ? GitBranch : Target
  const frame = diverged
    ? 'border-info/30 bg-info/10'
    : 'border-panel-border bg-panel-hover'

  return (
    <section
      className={`rounded-md border ${frame} p-3`}
      data-testid={testId}
      data-implication-kind={implication.kind}
      aria-labelledby={`${testId}-title`}
    >
      <h3
        id={`${testId}-title`}
        className={`${typography.panelHeader} text-text flex items-center gap-1.5 m-0`}
      >
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-light" />
        <span className="min-w-0 flex-1">{COPY.sections.implications}</span>
        {isStale ? (
          <span
            className={`${typography.panelMeta} text-text-light shrink-0 font-normal`}
            data-testid={`${testId}-stale`}
          >
            {COPY.markers.stale}
          </span>
        ) : null}
      </h3>

      <p className={`${typography.panelBody} text-text-light mt-1.5 mb-0`} data-testid={`${testId}-lead`}>
        {diverged
          ? COPY.implications.divergedLead
          : needsTarget
            ? COPY.implications.needsTargetLead
            : COPY.implications.alignedLead(implication.label)}
      </p>

      <ul className="list-none p-0 mt-2 mb-0 space-y-1">
        <Claim sentence={implication.outcome.sentence} testId={`${testId}-outcome`} />
        {implication.kind !== 'needs_target' && (
          <Claim sentence={implication.goal.sentence} testId={`${testId}-goal`} />
        )}
      </ul>

      {needsTarget && targetAskedElsewhere ? null : (
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
          data-testid={`${testId}-resolve`}
        >
          {diverged
            ? COPY.implications.divergedResolve
            : needsTarget
              ? COPY.implications.needsTargetUnlock
              : COPY.implications.alignedResolve}
        </p>
      )}
    </section>
  )
}
