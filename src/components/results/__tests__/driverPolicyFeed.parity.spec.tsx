/**
 * C4 fix 2 — cross-surface basis parity (adversarial review, both findings
 * verifier-reproduced against the real store).
 *
 * The Drivers panel (useResultsSectionData) and the canvas hook
 * (useNodeDisplayMetadata) disclosed CONTRADICTORY bases for the SAME report:
 * the panel fed selectDriverDisplayModel its five-source merge (which KEEPS
 * metric-less rows → coverage incomplete → set-relative fallback), while the
 * hook fed it a private factor_sensitivity-only feed filtered through
 * extractPolicyRow (drops no-finite-metric rows → coverage complete →
 * absolute producer scale). Result: the canvas pill said "absolute" while the
 * panel said "relative, top always 100%".
 *
 * Fix under test (build-brief §12.4 single-selector doctrine): ONE shared row
 * feed — selectDriverPolicyFeed, the panel's merge extracted into a pure
 * per-report-memoised function — consumed by BOTH surfaces. These specs drive
 * the REAL canvas store and both REAL hooks, then assert basis AND value
 * agree, for the exact review fixture and for a drivers_payload-only report.
 *
 * Also pinned here (fix 1 integration truth): the degenerate wire fixture
 * flows through the real data layer into DriversSection and renders NO
 * relative-scale caption.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { useResultsSectionData, selectDriverPolicyFeed } from '../useResultsSectionData'
import { useNodeDisplayMetadata } from '../../../canvas/hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../../../canvas/store'
import { DriversSection } from '../DriversSection'
import type { ResultsReport } from '../types'

function setCompleteReport(report: Record<string, unknown>): void {
  act(() => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, report } as never,
      runMeta: {} as never,
      nodes: [] as never,
      edges: [] as never,
      hasCompletedFirstRun: true,
      rawV2Response: null,
    } as never)
  })
}

const baseReport = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  schema: 'report.v1',
  meta: { seed: 1, elapsed_ms: 100 },
  drivers_status: 'computed',
  ...overrides,
})

beforeEach(() => {
  act(() => {
    useCanvasStore.setState({
      results: { status: 'idle' } as never,
      runMeta: {} as never,
      nodes: [] as never,
      edges: [] as never,
      hasCompletedFirstRun: false,
      rawV2Response: null,
    } as never)
  })
})

describe('C4 fix 2 — panel and canvas resolve the SAME basis and value from one feed', () => {
  it('review fixture (A with influence_score + metric-less B): both surfaces say relative, A = 1.0', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
        { factor_id: 'B', confidence: 0.7 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowA = panel.result.current.drivers.drivers.find(d => d.factorKey === 'A')
    expect(rowA?.displayProvenance).toBe('normalised_elasticity')
    expect(rowA?.displayInfluence).toBe(1)

    const canvas = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(canvas.result.current.influenceProvenance).toBe(rowA?.displayProvenance)
    expect(canvas.result.current.influence).toBe(rowA?.displayInfluence)
  })

  it('drivers_payload-only report: both surfaces agree on the verdict for the same row', () => {
    setCompleteReport(baseReport({
      drivers_payload: {
        drivers: [
          { node_id: 'X', elasticity: 0.7 },
          { node_id: 'Y', elasticity: 0.35 },
        ],
      },
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowX = panel.result.current.drivers.drivers.find(d => d.factorKey === 'X')
    expect(rowX?.displayProvenance).toBe('normalised_elasticity')
    expect(rowX?.displayInfluence).toBe(1)

    const canvas = renderHook(() => useNodeDisplayMetadata('X', 'factor'))
    expect(canvas.result.current.influenceProvenance).toBe(rowX?.displayProvenance)
    expect(canvas.result.current.influence).toBe(rowX?.displayInfluence)
    expect(canvas.result.current.sensitivityRank).toBe(1)
  })

  it('full producer coverage: both surfaces say absolute with the producer value', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
        { factor_id: 'B', influence_score: 0.3, elasticity: 0.2, confidence: 0.7 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowA = panel.result.current.drivers.drivers.find(d => d.factorKey === 'A')
    expect(rowA?.displayProvenance).toBe('influence_score')
    expect(rowA?.displayInfluence).toBeCloseTo(0.6)

    const canvas = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(canvas.result.current.influenceProvenance).toBe('influence_score')
    expect(canvas.result.current.influence).toBeCloseTo(0.6)
  })
})

describe('selectDriverPolicyFeed — feed contract', () => {
  it('is memoised per report object (same identity for repeated reads)', () => {
    const report = baseReport({
      factor_sensitivity: [{ factor_id: 'A', elasticity: 0.5 }],
    }) as ResultsReport
    const first = selectDriverPolicyFeed(report)
    const second = selectDriverPolicyFeed(report)
    expect(second).toBe(first)
    expect(first.policyRows).toHaveLength(1)
  })

  it('keeps metric-less rows (the coverage-verdict input the old private feed dropped)', () => {
    const report = baseReport({
      factor_sensitivity: [
        { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
        { factor_id: 'B', confidence: 0.7 },
      ],
    }) as ResultsReport
    const feed = selectDriverPolicyFeed(report)
    expect(feed.policyRows.map(r => r.key)).toEqual(['A', 'B'])
    expect(feed.displayModel.get('A')?.provenance).toBe('normalised_elasticity')
    expect(feed.displayModel.get('A')?.value).toBe(1)
    expect(feed.displayModel.get('B')?.value).toBe(0)
  })

  it('returns an empty feed for a missing report', () => {
    expect(selectDriverPolicyFeed(null).policyRows).toHaveLength(0)
    expect(selectDriverPolicyFeed(undefined).rawFactors).toHaveLength(0)
  })
})

describe('C4 fix 1 integration truth — degenerate wire fixture through the real data layer', () => {
  it('renders no relative-scale caption when the real data layer collapses every value to 0', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { factor_id: 'A', elasticity: 0.0005, influence_score: 0.4 },
        { factor_id: 'B', elasticity: 0.0002 },
        { factor_id: 'C', elasticity: 0.0001 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const data = panel.result.current.drivers
    expect(data.hasMagnitudeData).toBe(false)
    expect(data.drivers.every(d => d.displayInfluence === 0)).toBe(true)

    render(<DriversSection data={data} goalLabel="test" />)
    expect(screen.queryByTestId('influence-scale-caption')).toBeNull()
    expect(screen.queryByText(/always shows 100%/)).toBeNull()
  })
})
