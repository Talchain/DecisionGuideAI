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
import { useCanvasStore } from '../../../canvas/store'
import { StressTestSection } from '../StressTestSection'

function setupCanvasState({
  topDriverConfidence,
}: {
  topDriverConfidence: number
}) {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        run: { critique: [] },
        robustness: { fragile_edges: [] },
        option_comparison: [
          {
            option_id: 'opt_a',
            option_label: 'Option A',
            win_probability: 0.7,
            expected_value: 100,
          },
          {
            option_id: 'opt_b',
            option_label: 'Option B',
            win_probability: 0.3,
            expected_value: 60,
          },
        ],
        recommendation: { option_id: 'opt_a' },
        factor_sensitivity: [
          {
            factor_id: 'fac_top',
            label: 'Customer churn rate',
            sensitivity_score: 0.9,
            importance_rank: 1,
            // Authoritative confidence — value flows through the data
            // hook into DriverItem.confidence, then into StressTestSection's
            // Disconfirmation context-line gate.
            confidence: topDriverConfidence,
          },
        ],
      },
    } as any,
    hasCompletedFirstRun: true,
    runMeta: {},
    nodes: [
      { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'fac_top', type: 'factor', data: { label: 'Customer churn rate', kind: 'factor' }, position: { x: 0, y: 0 } },
    ] as any,
    edges: [],
  })
}

describe('StressTestSection — factor_sensitivity → DriverItem.confidence integration', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0, report: null } as any,
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
