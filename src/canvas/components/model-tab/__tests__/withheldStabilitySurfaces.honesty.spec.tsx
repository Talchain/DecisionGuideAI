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
 * honestly as "came out ahead in N% of simulated scenarios", shown a second
 * time under a name that implies an independent robustness measurement.
 *
 * Three surfaces rendered that percentage and are removed here:
 *   · StatusBar          — the `status-stability` segment, `"{N}% stability"`
 *   · ModelHealthSection — the collapsed header summary half, `"{N}% stability"`
 *   · ModelHealthSection — the expanded audit-trail `Stability  {N}%` row
 *   · TrajectorySection  — the expert table's `Stability %` column
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
import { StatusBar } from '../StatusBar'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'
import { TrajectorySection } from '../../../compare-tab/TrajectorySection'
import type { AnalysisSnapshot } from '../../../compare-tab/types'

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

function snapshot(overrides: Partial<AnalysisSnapshot> = {}): AnalysisSnapshot {
  return {
    runId: 'run-1',
    runNumber: 1,
    timestamp: '2026-02-20T10:00:00Z',
    source: 'session',
    graphHash: 'hash-1',
    nodeCount: 2,
    edgeCount: 1,
    winnerId: 'opt-1',
    winnerLabel: 'Option A',
    winnerProbability: 60,
    runnerUpId: null,
    runnerUpLabel: null,
    runnerUpProbability: null,
    recommendationStability: LEGACY_STABILITY,
    stabilityLabel: 'stable',
    fragileEdgeCount: 2,
    evidenceCoverage: '3/5',
    topFactors: [],
    influenceConcentration: 40,
    topCalibrationFactor: '',
    topCalibrationFactorId: '',
    topElasticity: 0,
    rankFlipRate: 0,
    goalProbability: null,
    jointGoalProbability: null,
    edgeEValues: [],
    seedUsed: 42,
    responseHash: 'resp-1',
    editSummary: '',
    ...overrides,
  } as AnalysisSnapshot
}

// ───────────────────────────────────────────────────────────────────────────
describe('StatusBar — the "{N}% stability" segment cannot render', () => {
  it('POSITIVE CONTROL: the bar renders its surviving post-analysis segments', () => {
    render(
      <StatusBar
        factorsToVerify={2}
        fragileEdgeCount={4}
        contestedCount={1}
        hasAnalysisData
      />,
    )
    // Without these, every absence assertion below would be unfalsifiable — a
    // bar that rendered nothing at all also contains no percentage.
    expect(screen.getByTestId('status-verify')).toHaveTextContent('2 to verify')
    expect(screen.getByTestId('status-fragile')).toHaveTextContent('4 fragile')
    expect(screen.getByTestId('status-contested')).toHaveTextContent('1 contested')
  })

  it('renders no stability segment even when handed a legacy recommendationStability', () => {
    const { container } = render(
      <StatusBar
        {...withRemoved(
          {
            factorsToVerify: 2,
            fragileEdgeCount: 4,
            contestedCount: 1,
            hasAnalysisData: true,
          },
          { recommendationStability: LEGACY_STABILITY },
        )}
      />,
    )

    // Bound by IDENTITY (the segment's own testid), not by a text predicate
    // another segment could satisfy.
    expect(screen.queryByTestId('status-stability')).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(PCT_STABILITY)
    expect(container.textContent ?? '').not.toContain(`${LEGACY_PCT}%`)
  })

  it('renders no stability segment for a legacy value that would round to a DIFFERENT figure', () => {
    // A second value guards against a test that only ever proved "71" absent
    // (e.g. because 71 never appeared for an unrelated reason).
    const { container } = render(
      <StatusBar
        {...withRemoved(
          {
            factorsToVerify: 0,
            fragileEdgeCount: 0,
            contestedCount: 3,
            hasAnalysisData: true,
          },
          { recommendationStability: 0.42 },
        )}
      />,
    )
    expect(screen.getByTestId('status-contested')).toHaveTextContent('3 contested')
    expect(screen.queryByTestId('status-stability')).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toContain('42%')
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('ModelHealthSection — neither header nor audit row can render a stability %', () => {
  it('header summary carries the quality score and NO stability percentage, with the field injected', () => {
    render(
      <ModelHealthSection
        auditTrail={withRemoved(BASE_AUDIT, { recommendationStability: LEGACY_STABILITY })}
        ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }}
      />,
    )
    const tierLabel = screen.getByTestId('accordion-tier-label')
    // POSITIVE CONTROL: the header summary exists and still says something.
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

// ───────────────────────────────────────────────────────────────────────────
describe('TrajectorySection expert table — the "Stability %" column cannot render', () => {
  it('POSITIVE CONTROL: the surviving columns and their values render', () => {
    render(<TrajectorySection snapshots={[snapshot()]} showExpert />)
    for (const header of ['Run', 'Evidence', 'Conc. %', 'Flip rate', 'Fragile', 'Seed']) {
      expect(screen.getByText(header), `header "${header}" must survive`).toBeInTheDocument()
    }
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders no Stability column header and no percentage cell for a LEGACY snapshot value', () => {
    // The fixture's `recommendationStability` is 0.71 — exactly the
    // pre-withdrawal case a persisted `v5_handler_facts` row reproduces.
    const { container } = render(<TrajectorySection snapshots={[snapshot()]} showExpert />)

    expect(screen.queryByText('Stability %')).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toContain(`${LEGACY_PCT}%`)
  })

  it('column COUNT is pinned, so a reinstated column cannot hide behind a renamed header', () => {
    // A header-text assertion alone is defeated by reinstating the column under
    // a different label. The arity is the identity-bound check.
    const { container } = render(<TrajectorySection snapshots={[snapshot()]} showExpert />)
    expect(container.querySelectorAll('thead th')).toHaveLength(6)
    expect(container.querySelectorAll('tbody tr td')).toHaveLength(6)
  })
})
