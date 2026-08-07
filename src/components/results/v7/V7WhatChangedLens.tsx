/**
 * V7WhatChangedLens — the "What changed in the result" lens body (V7 Lane L5,
 * spec row 6d + Paul-question P4).
 *
 * Reads LOCAL run history READ-ONLY and renders a run-over-run summary — the
 * p50 median (with delta), the model-edges-changed line, and the drivers
 * added/removed — from the two most recent stored runs, or the honest empty
 * state "Snapshot unavailable — rerun to compare." when fewer than two runs
 * exist. That empty state is the COMMON CASE on the live V5 path: run
 * history's only writer is Run-button-gated on results.seed, so it is usually
 * empty (verified live, PR #426 saga).
 *
 * ⚠ DELIBERATE, FLAGGED DEVIATION (see PR body): src/canvas/store/runHistory.ts
 * carries a "must NEVER back a 'What changed' surface … Do not wire this in"
 * header. V6-RESPEC-2026-07-23 row 6d + the L5 brief explicitly override that
 * for READ-ONLY consumption on this new lens (Paul-ruled, dated). This
 * component adds NO new writers to run history — it only reads the existing
 * compareRuns / computeRunSummary exports — and never fabricates a comparison.
 *
 * Presentational leaf: the live run array is passed in (owned by V7LensGroup),
 * so this component is a pure function of its props. COMPLETE borders only.
 */

import { useMemo } from 'react'
import { typography } from '@/styles/typography'
import { compareRuns, computeRunSummary, type StoredRun } from '@/canvas/store/runHistory'
import { V7_LENS_COPY } from './v7LensCopy'

const C = V7_LENS_COPY.whatChanged

export interface V7WhatChangedLensProps {
  /** The live run array (latest first), read once in V7LensGroup. */
  runs: StoredRun[]
}

/** ≥2 stored runs — the shared predicate for "there is something to compare".
 * Used by both this lens's empty-state gate and V7LensGroup's tab availability
 * so the two cannot disagree about when the What-changed lens has data. */
export function hasComparableRuns(runs: StoredRun[]): boolean {
  return runs.length >= 2
}

function driverLabel(d: { id?: string; label?: string }): string {
  return d.label ?? d.id ?? 'Unknown driver'
}

export function V7WhatChangedLens({ runs }: V7WhatChangedLensProps) {
  const latest = runs[0]
  const prior = runs[1]

  // Derive the run-over-run summary + driver deltas once, keyed by the two run
  // ids — stored runs are immutable, so the ids fully determine the result.
  const derived = useMemo(() => {
    if (!latest || !prior) return null
    const summary = computeRunSummary(latest, prior)
    // compareRuns(A, B): driversAdded = in B not A. Pass prior as A and latest
    // as B so "added" reads as new-in-the-latest-run and "removed" as gone-since.
    const comparison = compareRuns(prior.id, latest.id)
    return {
      summary,
      added: comparison?.driversAdded ?? [],
      removed: comparison?.driversRemoved ?? [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the run ids: stored runs are immutable, so the ids fully determine the memo (same pattern as WhatChangedChip's version-keyed read)
  }, [latest?.id, prior?.id])

  // Honest empty state — the common case. Fewer than two runs means there is
  // nothing to compare; never fabricate a delta.
  if (!hasComparableRuns(runs) || !derived) {
    return (
      <div data-testid="v7-what-changed-empty">
        <p className={`${typography.panelBody} text-text-header font-semibold`}>{C.heading}</p>
        <p className={`${typography.panelBody} text-text-body mt-1`}>{C.empty}</p>
        <p className={`${typography.panelMeta} text-text-light mt-1`}>{C.emptyDetail}</p>
      </div>
    )
  }

  const { summary, added, removed } = derived

  return (
    <div className="space-y-2" data-testid="v7-what-changed">
      <p className={`${typography.panelBody} text-text-header font-semibold`}>{C.heading}</p>

      <dl className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className={`${typography.panelMeta} text-text-light`}>{C.p50Label}</dt>
          <dd className={`${typography.panelBody} text-text-body text-right`}>
            {summary.p50Text}
            {summary.deltaText && (
              <span className="text-text-light" data-testid="v7-what-changed-delta">
                {' '}
                {summary.deltaText}
              </span>
            )}
          </dd>
        </div>
        {summary.edgesChangedText && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className={`${typography.panelMeta} text-text-light`}>{C.edgesLabel}</dt>
            <dd className={`${typography.panelBody} text-text-body text-right`} data-testid="v7-what-changed-edges">
              {summary.edgesChangedText}
            </dd>
          </div>
        )}
      </dl>

      {added.length === 0 && removed.length === 0 ? (
        <p className={`${typography.panelMeta} text-text-light`}>{C.noDriverChange}</p>
      ) : (
        <div className="space-y-1">
          {added.length > 0 && (
            <p className={`${typography.panelMeta} text-text-body`} data-testid="v7-what-changed-drivers-added">
              <span className="text-text-header">{C.driversAddedLabel}:</span>{' '}
              {added.map(driverLabel).join(', ')}
            </p>
          )}
          {removed.length > 0 && (
            <p className={`${typography.panelMeta} text-text-body`} data-testid="v7-what-changed-drivers-removed">
              <span className="text-text-header">{C.driversRemovedLabel}:</span>{' '}
              {removed.map(driverLabel).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default V7WhatChangedLens
