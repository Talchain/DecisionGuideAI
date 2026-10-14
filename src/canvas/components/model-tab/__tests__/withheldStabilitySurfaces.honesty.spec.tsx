/**
 * WITHHELD STABILITY SURFACES — REMOVED (ROADMAP 2.1273).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS REMOVED AND WHY A NULL-GUARD COULD NOT HAVE DONE IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PLoT deliberately WITHHOLDS `robustness.recommendation_stability`
 * (`src/routes/v2/run.ts` at PLoT `8bf54150`): ISL derives it as
 * `option_wins[winner] / n_samples`, i.e. the leading option's
 * `win_probability` RELABELLED, carrying zero independent information. The UI
 * rendered it as "{N}% stability" — the same quantity a user already reads
 * honestly as "supported in N% of simulated scenarios", shown a second
 * time under a name that implies an independent robustness measurement.
 *
 * Three surfaces rendered that percentage and are removed here:
 *   · ModelHealthSection — the collapsed header summary half, `"{N}% stability"`
 *   · ModelHealthSection — the expanded audit-trail `Stability  {N}%` row
 *   · TrajectorySection  — the expert table's `Stability %` column
 *
 * ⚠ NARROWED 2026-09-11 — ONE SUBJECT WAS DELETED, NOT EXCUSED. A fourth
 * surface, `StatusBar`'s `status-stability` segment, was pinned here too.
 * `StatusBar.tsx` was removed with the v1 Model stack (Paul's ruling,
 * 2026-09-11): it sat inside `ModelTabBody`'s `LEGACY_DETAILED_EDITOR_MOUNTED =
 * false` gate and `ModelTabBody` was its only importer. Its case is gone because
 * the component is gone. The record of what it rendered, and why that was
 * dishonest, is retained in this header on purpose (trap 14b) — the two
 * `ModelHealthSection` cases and the `TrajectorySection` case below are
 * unchanged and still carry the rule for the surfaces that survive.
 *
 * ⚠ NARROWED 2026-10-07 — ONE MORE SUBJECT DELETED, NOT EXCUSED. The
 * `TrajectorySection` expert-table case (its `Stability %` column, pinned absent
 * with a 6-column arity check) is gone because the component is gone: the whole
 * pre-v3 Compare body (`CompareTabBody` and everything only it reached) was
 * deleted with zero production importers, re-derived at the deletion head. The
 * live Compare tab (`CompareRunPairBody`) renders no stability figure at all.
 * (plus a dead read in `OutputsDock` → `derivePostFooterMeta`, whose own F7
 * pins live in `canvas/components/utils/__tests__/postAnalysisFooter.spec.ts`,
 * and a fully dead `components/results/TrustOneLiner.tsx`, deleted.)
 *
 * ⚠⚠ THE LOAD-BEARING POINT OF THIS FILE — EVERY TEST INJECTS THE REMOVED
 * INPUT. On a FRESH run the field is simply absent (wire-witnessed 2026-08-17:
 * `enrichment.robustness` carried 11 keys, none of them
 * `recommendation_stability`), so a spec that merely OMITS the value would pass
 * against a component that still happily renders one — a guard agreeing with
 * itself (CLAUDE.md trap 13b). The live hazard is a HYDRATED payload written
 * BEFORE the withdrawal, where the value IS PRESENT and `!= null` is TRUE:
 *
 *   · `scenarios.analysis` JSONB → `hooks/hydrateAnalysis.ts` →
 *     `adapters/plot/v2/responseMapper.ts` (passes the field through verbatim)
 *     → `lib/mappers/mapRobustness.ts` → `ModelTabBody` → StatusBar / Model card
 *   · `v5_handler_facts` rows → `canvas/stores/persistedRunSnapshotFactory.ts`
 *     → `AnalysisSnapshot.recommendationStability` → TrajectorySection
 *
 * Both hydration paths are SIGNED-IN ONLY (guest persistence is gated off in
 * `hooks/useScenario.ts`; `v5_handler_facts` RLS is `auth.uid() = user_id` and
 * guest rows carry a NULL user_id) — which bounds severity, not existence.
 *
 * So each test below forces a legacy value in and asserts no percentage
 * escapes. That is the only assertion shape a restore-the-render mutant fails.
 *
 * CLAIM TYPE: rendered text / DOM presence within jsdom. NOT a visibility claim.
 *
 * REINSTATEMENT TRIGGER (all surfaces): PLoT supplies a genuine numeric
 * robustness/stability field that is distinct from the leader's win probability.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({
    children,
    title,
    tierLabel,
    testId,
  }: {
    children: React.ReactNode
    title: string
    tierLabel?: string
    testId?: string
  }) => (
    <div data-testid={testId}>
      <span>{title}</span>
      {tierLabel && <span data-testid="accordion-tier-label">{tierLabel}</span>}
      {children}
    </div>
  ),
}))

/**
 * Inject a prop/field the component no longer declares.
 *
 * The removal is only meaningful if a caller that STILL supplies the old value
 * gets no percentage rendered — a test that merely omits it would also pass
 * against a component that still reads it. Same technique, same rationale, as
 * `withRemovedProp` in `evpiSurfacesRemoved.canvas.honesty.spec.tsx`. The cast
 * is deliberate and local to this file.
 */
function withRemoved<P>(props: P, removed: Record<string, unknown>): P {
  return { ...props, ...removed } as P
}

/** The exact legacy value a pre-withdrawal payload carries, and its rendering. */
const LEGACY_STABILITY = 0.71
const LEGACY_PCT = '71'

/** Any "{N}% stability" / bare "{N}%" claim sourced from the withheld field. */
const PCT_STABILITY = /\d+\s*%\s*stability/i

const BASE_AUDIT: AuditTrailData = {
  seedUsed: '325022',
  responseHash: '4d11687e9836abcdef',
  nSamples: 1000,
  repairsApplied: null,
  inferenceWarnings: null,
  autoNoiseApplied: null,
  autoNoiseProvenance: null,
  stabilityPenaltyFactor: null,
}

// ───────────────────────────────────────────────────────────────────────────
describe('ModelHealthSection — neither header nor audit row can render a stability %', () => {
  it('header summary carries the quality score and NO stability percentage, with the field injected', () => {
    // ⚠ EXPERT TIER: the header figures moved behind the expert toggle (Paul,
    // 9 Sep 2026), so plain renders no pill and this injection test needs the
    // tier that has one. What it proves is unchanged — with the legacy field
    // INJECTED, the header still cannot render a percentage.
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection
          auditTrail={withRemoved(BASE_AUDIT, { recommendationStability: LEGACY_STABILITY })}
          ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }}
        />
      </DetailToggleContext.Provider>,
    )
    const tierLabel = screen.getByTestId('accordion-tier-label')
    // POSITIVE CONTROL: the header pill exists and still says something.
    // ⚠ Back on `overall` — see the sibling note in `ModelHealthSection.spec.tsx`.
    // This briefly read `'coverage 7'` to match a header that had replaced
    // `overall` with its three dimensions; that was a control following a
    // regression rather than catching it.
    expect(tierLabel).toHaveTextContent('7.2 / 10')
    expect(tierLabel.textContent ?? '').not.toMatch(PCT_STABILITY)
    expect(tierLabel.textContent ?? '').not.toContain(`${LEGACY_PCT}%`)
  })

  it('expanded audit trail renders its other receipts but no Stability row, with the field injected', () => {
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection
          auditTrail={withRemoved(BASE_AUDIT, { recommendationStability: LEGACY_STABILITY })}
        />
      </DetailToggleContext.Provider>,
    )

    // POSITIVE CONTROLS: the audit block is mounted AND populated. Without
    // these, the absence assertions would pass against a collapsed/absent
    // audit trail that could not have rendered anything (the exact vacuity the
    // EVPI sibling spec was corrected for).
    const audit = screen.getByTestId('model-health-audit')
    expect(audit).toBeInTheDocument()
    expect(screen.getByText('325022')).toBeInTheDocument()
    expect(screen.getByText('4d11687e9836')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()

    // The row label is gone, and so is its value. Both are asserted: a mutant
    // that restores the value cell without the label must still fail.
    expect(screen.queryByText('Stability')).not.toBeInTheDocument()
    expect(audit.textContent ?? '').not.toContain(`${LEGACY_PCT}%`)
    expect(audit.textContent ?? '').not.toMatch(PCT_STABILITY)
  })

  it('the surviving "Stability penalty" receipt is NOT collateral damage', () => {
    // `stabilityPenaltyFactor` is a DIFFERENT quantity (a multiplier PLoT does
    // emit) and must survive. This pins the removal's blast radius: a change
    // that deleted the penalty row too would go red here.
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection auditTrail={{ ...BASE_AUDIT, stabilityPenaltyFactor: 0.9 }} />
      </DetailToggleContext.Provider>,
    )
    expect(screen.getByText('Stability penalty')).toBeInTheDocument()
    expect(screen.getByText('0.90x')).toBeInTheDocument()
  })
})
