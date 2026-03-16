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

describe('TornadoChart flip markers (A4)', () => {
  it('renders flip marker when flip_value is present', () => {
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

    const markers = screen.getAllByTestId('flip-marker')
    expect(markers).toHaveLength(1)
    expect(markers[0]).toHaveAttribute('title', 'Flips at $400')
  })

  it('does not render marker when flip_value is null', () => {
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

    expect(screen.queryByTestId('flip-marker')).toBeNull()
  })

  it('does not render marker when flip_reason is heuristic', () => {
    const flipThresholds: FlipThreshold[] = [
      { label: 'Factor One', node_id: 'factor-1', current_value: 300, flip_value: 400, flip_reason: 'heuristic' as any },
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

  it('renders markers for multiple rows with valid flip data', () => {
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

    const markers = screen.getAllByTestId('flip-marker')
    expect(markers).toHaveLength(2)
  })
})
