import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TornadoChart, type TornadoRow } from '../TornadoChart'
import type { FlipThreshold } from '../types'

// Mock focusHelpers
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

// Mock uiStore
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: { getState: () => ({ setActiveOutputTab: vi.fn() }) },
}))

const rows: TornadoRow[] = [
  { factorKey: 'factor-1', label: 'Factor One', lowOutcome: 100, highOutcome: 500, canFocus: true },
  { factorKey: 'factor-2', label: 'Factor Two', lowOutcome: 200, highOutcome: 400, canFocus: true },
]

/**
 * Codex R3-SF4: the flip marker was REMOVED. flip_value is a factor-space
 * value; the tornado bars span outcome-space (the recommended option's
 * p10–p90). Positioning one against the other was an invalid coordinate
 * mapping that placed the "Flips at" diamond at a meaningless point. These
 * tests pin the removal: no marker renders even with fully valid producer
 * flip data. Re-enable rendering only when factor-space bounds
 * (factorLow/factorHigh) are threaded through the tornado data pipeline —
 * see the header comment in TornadoChart.tsx.
 */
describe('TornadoChart flip markers (removed — Codex R3-SF4)', () => {
  it('renders NO marker even when flip_value is present and certified', () => {
    const flipThresholds: FlipThreshold[] = [
      { label: 'Factor One', node_id: 'factor-1', current_value: 300, flip_value: 400, unit: '$' },
    ]

    render(
      <TornadoChart
        rows={rows}
        expectedOutcome={300}
        flipThresholds={flipThresholds}
      />,
    )

    expect(screen.queryByTestId('flip-marker')).toBeNull()
    expect(screen.queryByTitle(/Flips at/)).toBeNull()
  })

  it('renders NO markers for multiple rows with valid flip data', () => {
    const flipThresholds: FlipThreshold[] = [
      { label: 'Factor One', node_id: 'factor-1', current_value: 300, flip_value: 400 },
      { label: 'Factor Two', node_id: 'factor-2', current_value: 300, flip_value: 350 },
    ]

    render(
      <TornadoChart
        rows={rows}
        expectedOutcome={300}
        flipThresholds={flipThresholds}
      />,
    )

    expect(screen.queryByTestId('flip-marker')).toBeNull()
  })

  it('accepting flipThresholds without rendering markers does not break the chart', () => {
    const flipThresholds: FlipThreshold[] = [
      { label: 'Factor Two', node_id: 'factor-2', current_value: 300, flip_value: null, flip_reason: 'no_bracket' },
    ]

    render(
      <TornadoChart
        rows={rows}
        expectedOutcome={300}
        flipThresholds={flipThresholds}
      />,
    )

    expect(screen.getByTestId('tornado-chart')).toBeInTheDocument()
    expect(screen.getByText('Factor One')).toBeInTheDocument()
    expect(screen.getByText('Factor Two')).toBeInTheDocument()
  })
})
