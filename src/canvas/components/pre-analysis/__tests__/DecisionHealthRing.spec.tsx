/**
 * Tests for DecisionHealthRing SVG component.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionHealthRing } from '../DecisionHealthRing'

describe('DecisionHealthRing', () => {
  it('renders with correct overall score for all zeros', () => {
    render(
      <DecisionHealthRing completeness={0} evidence={0} balance={0} calibration={0} />
    )
    // Overall score should be 0
    expect(screen.getByText('0')).toBeDefined()
  })

  it('renders with correct overall score for perfect model', () => {
    render(
      <DecisionHealthRing completeness={1} evidence={1} balance={1} calibration={1} />
    )
    expect(screen.getByText('100')).toBeDefined()
  })

  it('renders with correct overall score for mixed values', () => {
    render(
      <DecisionHealthRing completeness={0.8} evidence={0.6} balance={0.4} calibration={0.2} />
    )
    // Average: (0.8 + 0.6 + 0.4 + 0.2) / 4 = 0.5 → 50
    expect(screen.getByText('50')).toBeDefined()
  })

  it('clamps values to [0, 1]', () => {
    render(
      <DecisionHealthRing completeness={1.5} evidence={-0.3} balance={0.5} calibration={0.5} />
    )
    // Clamped: (1 + 0 + 0.5 + 0.5) / 4 = 0.5 → 50
    expect(screen.getByText('50')).toBeDefined()
  })

  it('renders 3 arc pairs (background + filled) and center text', () => {
    const { container } = render(
      <DecisionHealthRing completeness={0.5} evidence={0.5} balance={0.5} calibration={0.5} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    // 3 arcs × 2 paths each (background + filled) = 6 paths, plus 2 text elements
    const paths = svg!.querySelectorAll('path')
    expect(paths.length).toBe(6)
  })

  it('renders calibration bar', () => {
    render(
      <DecisionHealthRing completeness={0.5} evidence={0.5} balance={0.5} calibration={0.75} />
    )
    expect(screen.getByText('Calibration')).toBeDefined()
    expect(screen.getByText('75%')).toBeDefined()
  })

  it('renders legend with dimension labels', () => {
    render(
      <DecisionHealthRing completeness={0.5} evidence={0.5} balance={0.5} calibration={0.5} />
    )
    expect(screen.getByText(/Completeness/)).toBeDefined()
    expect(screen.getByText(/Evidence/)).toBeDefined()
    expect(screen.getByText(/Balance/)).toBeDefined()
  })
})
