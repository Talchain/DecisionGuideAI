/**
 * WhatHasToHold — ISL's per-constraint satisfaction, on a reasoning surface for
 * the first time.
 *
 * ⭐⭐ THE DATA WAS ALREADY HERE. `constraint_analysis` is computed on every run
 * carrying goal constraints, arrives at `useResultsSectionData:2264`, and had
 * ZERO consumers anywhere under `analysisNew/`. Nothing new is requested and
 * nothing new is computed: the builder reads the producer's fields and this
 * renders them.
 *
 * ⛔ IT RENDERS NO VERDICT. There is no "on track" / "at risk" arm, no
 * threshold at which a row changes colour, and no summary word over the set.
 * A probability is the producer's; a judgement about whether it is good enough
 * is the reader's, and it depends on things this panel cannot see. The section
 * states the number, the threshold it belongs to, and which constraint the
 * producer says is tightest.
 *
 * ⚠ NO NEW AMBER. `amberIsRationed.spec.tsx` holds a decreasing ratchet, and a
 * section of probability bars is exactly where a status colour would spread
 * fastest. The binding constraint is marked with a WORD, which is also the
 * non-colour carrier SC 1.4.1 requires.
 *
 * ⚠ THE BAR IS `aria-hidden` AND THE FIGURE IS NOT. Same decision as
 * `DriverInfluenceChart`, for the same stated reason: a bar carries no
 * accessible magnitude, so the number beside it is what a screen reader gets,
 * and it is the producer's own.
 */
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { surface } from '../panelSurfaces'
import type { ConstraintsSection } from '../analysisNewTypes'

export interface WhatHasToHoldProps {
  constraints: ConstraintsSection
  testId?: string
}

/** The producer sends ASCII; the surface reads better in unicode. */
const OPERATOR_GLYPH: Record<string, string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
  '==': '=',
}

const pct = (v: number): string => `${Math.round(v * 100)}%`

export function WhatHasToHold({
  constraints,
  testId = 'analysis-new-constraints',
}: WhatHasToHoldProps) {
  /**
   * ⚠ A HEADING IS A CLAIM THAT THERE IS SOMETHING UNDER IT — the rule every
   * other section on this tab enforces for itself. No rows, no section: a run
   * with no constraints has nothing to say here, and "no constraints were set"
   * is a different sentence that belongs where targets are set.
   */
  if (constraints.rows.length === 0) return null

  return (
    <section className={surface('neutral')} data-testid={testId} aria-labelledby={`${testId}-h`}>
      <h3 id={`${testId}-h`} className={`${typography.panelHeader} text-text-header`}>
        {COPY.sections.whatHasToHold}
      </h3>
      {constraints.optionLabel !== null && (
        <p className={`${typography.panelMeta} text-text-light mt-0.5`} data-testid={`${testId}-scope`}>
          {COPY.constraints.scope(constraints.optionLabel)}
        </p>
      )}

      <ul className="mt-2 space-y-2" data-testid={`${testId}-rows`}>
        {constraints.rows.map((row) => (
          <li key={`${row.label}-${row.operator}-${row.threshold}`} data-testid={`${testId}-row`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`${typography.panelBody} text-text-body min-w-0 break-words`}>
                {row.label} {OPERATOR_GLYPH[row.operator] ?? row.operator} {row.threshold}
              </span>
              <span
                className={`${typography.panelMeta} text-text-light shrink-0 tabular-nums`}
                data-testid={`${testId}-prob`}
              >
                {pct(row.probSatisfied)}
              </span>
            </div>
            {/* The track is the reference the bar means nothing without. */}
            <span className="flex h-2 mt-0.5 bg-panel-hover rounded-sm" aria-hidden="true">
              <span
                className="h-full rounded-sm bg-info"
                style={{ width: `${Math.round(row.probSatisfied * 100)}%` }}
                data-testid={`${testId}-bar`}
              />
            </span>
            {(row.binding || row.nearMissFraction !== null) && (
              <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
                {row.binding ? COPY.constraints.binding : null}
                {row.binding && row.nearMissFraction !== null ? ' · ' : null}
                {row.nearMissFraction !== null
                  ? COPY.constraints.nearMiss(pct(row.nearMissFraction))
                  : null}
              </p>
            )}
          </li>
        ))}
      </ul>

      {constraints.jointProbability !== null && (
        <p
          className={`${typography.panelBody} text-text-body mt-2`}
          data-testid={`${testId}-joint`}
        >
          {COPY.constraints.joint(pct(constraints.jointProbability))}
        </p>
      )}
    </section>
  )
}
