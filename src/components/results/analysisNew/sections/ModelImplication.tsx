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
      {/*
        ⚠⚠ THE STALE MARKER IS A SIBLING OF THE HEADING, NOT A CHILD OF IT, AND
        THAT IS TWO FIXES IN ONE.
        
        It sat inside the `<h3>`, inheriting `panelHeader`'s weight — `panelMeta`
        declares none of its own — so it carried a raw weight utility to escape.
        That trips `raw-typography`, and this component's own header says "no raw
        weights". Moving the marker out removes the inheritance instead of
        overriding it.

        ⚠ THE TOKEN NAMES ARE DELIBERATELY NOT SPELLED HERE. `check-ds-compliance`'s
        `panel-typography-scoped` rule matches raw lines and, unlike its
        `production-hex` sibling, sets no `stripComments` — so a comment
        DESCRIBING a weight utility is counted as USING one. A comment that spells
        one of the three weights that rule matches trips the DS ratchet (measured
        by injection) — a DIFFERENT guard from the one the fix was for
        (`raw-typography`, which strips comments), and one that cannot see the
        original token at all. Reported rather than fixed: that rule is a shared
        CI guard and changing what it detects is an estate-wide change, not mine
        to make from inside a panel PR.
        
        ⭐ AND THE CLOSURE GUARD ONLY FIRED BECAUSE THIS PR IS THE MOUNT. The file
        had no production importers at base, so `shell-conformance`'s
        `raw-typography` — which walks the dock's import closure — had never
        scanned it. The path-scoped DS ratchet HAD scanned it on every run and
        cannot see this token (above). The weight was not latent: this PR added
        it at `733a886`, after the mount at `8bbbba7`, and the closure guard
        named it on the next run. Had the file still been dark, only the DS
        ratchet would have scanned it — and it cannot see this token. A
        component in this path that is dark has one guard, and that guard is
        blind to five of the eight raw weights.
        
        It is also better as markup: the marker is a qualifier on the SECTION,
        not part of its name, and `aria-labelledby` points at this heading.
      */}
      <div className="flex items-center gap-1.5">
        <h3
          id={`${testId}-title`}
          className={`${typography.panelHeader} text-text flex items-center gap-1.5 m-0 min-w-0 flex-1`}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-light" />
          <span className="min-w-0">{COPY.sections.implications}</span>
        </h3>
        {isStale ? (
          <span
            className={`${typography.panelMeta} text-text-light shrink-0`}
            data-testid={`${testId}-stale`}
          >
            {COPY.markers.stale}
          </span>
        ) : null}
      </div>

      {/* ⚠ THE LEAD GOES WITH THE ASK, NOT SEPARATELY.
          `needsTargetLead` is "Only one reading of this run is available." — a
          statement of a LIMITATION whose only job is to set up the sentence that
          says how to lift it. Suppressing the ask on its own left the panel
          announcing a dead end: a limitation stated, its remedy deleted, and
          nothing on the strip explaining that a target unlocks a second reading.
          Raised by review, and it is the right catch — the first fix removed a
          duplicate ask and created a worse sentence than the one it removed.
          The outcome claim below stands on its own and is untouched. */}
      {needsTarget && targetAskedElsewhere ? null : (
        <p
          className={`${typography.panelBody} text-text-light mt-1.5 mb-0`}
          data-testid={`${testId}-lead`}
        >
          {diverged
            ? COPY.implications.divergedLead
            : needsTarget
              ? COPY.implications.needsTargetLead
              : COPY.implications.alignedLead(implication.label)}
        </p>
      )}

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
