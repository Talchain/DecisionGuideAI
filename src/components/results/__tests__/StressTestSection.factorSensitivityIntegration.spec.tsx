/**
 * StressTestSection — factor_sensitivity integration test (Brief 5.8B D4).
 *
 * Locks the brief's authoritative-source rule end-to-end: the
 * Disconfirmation context line must derive its `topDriverConfidence`
 * value from `report.factor_sensitivity[i].confidence` via the data
 * hook's `DriverItem.confidence` mapping (useResultsSectionData.ts:
 * 1526-1527), NOT from any per-row triage `confidence` field that
 * might shadow it.
 *
 * Approach: stand up a fake PLoT report shape where:
 *   - `factor_sensitivity[0].confidence = 0.3` (BELOW the 0.5 gate
 *     → context line MUST appear)
 *   - the corresponding driver's per-row triage data has no
 *     confidence override
 * Then render `<StressTestSection drivers={data.drivers.drivers} ... />`
 * and assert the context line appears with the factor label.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore, type ResultsState } from '../../../canvas/store'
import { StressTestSection } from '../StressTestSection'
import type { Node, Edge } from 'reactflow'

// ── Typed test fixtures ─────────────────────────────────────────────────────
// The integration test only needs to seed a tiny subset of the canvas store.
// We declare named fixture types and use `satisfies` so any drift in the
// fixture keys is a TypeScript error rather than a runtime failure. The
// project's loose-cast budget for src/components/results/ stays at the
// D1 baseline.
//
// Two `unknown`-typed casts remain at the boundary, by necessity:
//   - `report as unknown as ResultsState['report']` — `ResultsState.report`
//     is `ReportV1 | null`, a wide PLoT shape with many required fields the
//     integration test legitimately doesn't supply. Casting through
//     `unknown` keeps the cast restricted to the boundary; the fixture
//     payload itself is fully typed via `satisfies ReportFixture`.
//   - `Node` casts inside `buildFactorNodes` — React Flow's `Node<T>`
//     carries internal fields (positionAbsolute, dragging, selected,
//     handleBounds) that test fixtures legitimately don't supply.
// Both casts are "I-promise-this-shape-is-enough" boundary contracts; the
// fixture builders themselves stay structurally type-checked.

interface FactorSensitivityFixture {
  factor_id: string
  label: string
  sensitivity_score: number
  importance_rank: number
  /**
   * Authoritative top-driver confidence. Flows through `useResultsSectionData`
   * into `DriverItem.confidence` and then into the StressTestSection
   * Disconfirmation context-line gate.
   */
  confidence: number
}

interface OptionComparisonFixture {
  option_id: string
  option_label: string
  win_probability: number
  expected_value: number
}

interface ReportFixture {
  run: { critique: never[] }
  robustness: { fragile_edges: never[] }
  option_comparison: OptionComparisonFixture[]
  recommendation: { option_id: string }
  factor_sensitivity: FactorSensitivityFixture[]
}

function buildResultsState(report: ReportFixture): ResultsState {
  return {
    status: 'complete',
    progress: 100,
    // ResultsState.report is ReportV1 | null at the type level. The fixture
    // is a structural subset of ReportV1 — cast through `unknown` so the
    // narrowing happens at the boundary where the canvas store consumes it,
    // not via `any`.
    report: report as unknown as ResultsState['report'],
  }
}

function buildFactorNodes(): Node[] {
  return [
    { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } } as unknown as Node,
    { id: 'fac_top', type: 'factor', data: { label: 'Customer churn rate', kind: 'factor' }, position: { x: 0, y: 0 } } as unknown as Node,
  ]
}

function setupCanvasState({
  topDriverConfidence,
}: {
  topDriverConfidence: number
}) {
  // `satisfies ReportFixture` checks the literal structurally against the
  // declared interface — drift in the fixture keys (e.g. renaming
  // `factor_sensitivity` upstream) becomes a compile error rather than
  // surfacing as a runtime test failure. Each per-row literal also uses
  // satisfies for the same reason.
  const report = {
    run: { critique: [] },
    robustness: { fragile_edges: [] },
    option_comparison: [
      { option_id: 'opt_a', option_label: 'Option A', win_probability: 0.7, expected_value: 100 } satisfies OptionComparisonFixture,
      { option_id: 'opt_b', option_label: 'Option B', win_probability: 0.3, expected_value: 60 } satisfies OptionComparisonFixture,
    ],
    recommendation: { option_id: 'opt_a' },
    factor_sensitivity: [
      {
        factor_id: 'fac_top',
        label: 'Customer churn rate',
        sensitivity_score: 0.9,
        importance_rank: 1,
        confidence: topDriverConfidence,
      } satisfies FactorSensitivityFixture,
    ],
  } satisfies ReportFixture
  useCanvasStore.setState({
    results: buildResultsState(report),
    hasCompletedFirstRun: true,
    runMeta: {},
    nodes: buildFactorNodes(),
    edges: [] as Edge[],
  })
}

describe('StressTestSection — factor_sensitivity → DriverItem.confidence integration', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0, report: null },
      hasCompletedFirstRun: false,
    })
  })

  it('Disconfirmation context line fires when factor_sensitivity[0].confidence < 0.5', () => {
    setupCanvasState({ topDriverConfidence: 0.3 })
    const { result } = renderHook(() => useResultsSectionData())

    // Verify the data hook propagated the confidence faithfully.
    const drivers = result.current.drivers.drivers
    expect(drivers).toHaveLength(1)
    expect(drivers[0].confidence).toBe(0.3)

    render(
      <StressTestSection
        drivers={drivers}
        fragileEdges={[]}
        winnerLabel="Option A"
        alternativeLabel="Option B"
      />,
    )

    const card = screen.getByTestId('stress-test-disconfirmation')
    // Context line is the data-flow contract assertion: confidence < 0.5
    // → "The analysis depends on {topDriverLabel}, which has limited
    // evidence." The {topDriverLabel} interpolation also confirms the
    // driver label flowed through end-to-end.
    expect(card).toHaveTextContent(
      'The analysis depends on Customer churn rate, which has limited evidence.',
    )
  })

  it('Disconfirmation context line is suppressed when factor_sensitivity[0].confidence >= 0.5', () => {
    setupCanvasState({ topDriverConfidence: 0.8 })
    const { result } = renderHook(() => useResultsSectionData())

    const drivers = result.current.drivers.drivers
    expect(drivers[0].confidence).toBe(0.8)

    render(
      <StressTestSection
        drivers={drivers}
        fragileEdges={[]}
        winnerLabel="Option A"
        alternativeLabel="Option B"
      />,
    )

    const card = screen.getByTestId('stress-test-disconfirmation')
    expect(card).not.toHaveTextContent('limited evidence')
  })
})
