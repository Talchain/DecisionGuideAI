/**
 * Tests for DecisionHealthRing SVG component.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionHealthRing } from '../DecisionHealthRing'

describe('DecisionHealthRing', () => {
  it('renders with correct overall score for all zeros', () => {
    render(
      <DecisionHealthRing dimensions={{ structure: 0, evidence: 0, coverage: 0, verified: 0 }} />
    )
    expect(screen.getByText('0')).toBeDefined()
  })

  it('renders with correct overall score for perfect model', () => {
    render(
      <DecisionHealthRing dimensions={{ structure: 1, evidence: 1, coverage: 1, verified: 1 }} />
    )
    expect(screen.getByText('100')).toBeDefined()
  })

  it('renders with correct overall score for mixed values', () => {
    render(
      <DecisionHealthRing dimensions={{ structure: 0.8, evidence: 0.6, coverage: 0.4, verified: 0.2 }} />
    )
    // Average: (0.8 + 0.6 + 0.4 + 0.2) / 4 = 0.5 → 50
    expect(screen.getByText('50')).toBeDefined()
  })

  it('clamps values to [0, 1]', () => {
    render(
      <DecisionHealthRing dimensions={{ structure: 1.5, evidence: -0.3, coverage: 0.5, verified: 0.5 }} />
    )
    // Clamped: (1 + 0 + 0.5 + 0.5) / 4 = 0.5 → 50
    expect(screen.getByText('50')).toBeDefined()
  })

  it('renders 3 arc pairs (background + filled) and center text', () => {
    const { container } = render(
      <DecisionHealthRing dimensions={{ structure: 0.5, evidence: 0.5, coverage: 0.5, verified: 0.5 }} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    // 3 arcs × 2 paths each (background + filled) = 6 paths, plus 2 text elements
    const paths = svg!.querySelectorAll('path')
    expect(paths.length).toBe(6)
  })

  it('renders "ready" label in centre', () => {
    render(
      <DecisionHealthRing dimensions={{ structure: 0.5, evidence: 0.5, coverage: 0.5, verified: 0.5 }} />
    )
    expect(screen.getByText('ready')).toBeDefined()
  })

  it('uses danger colour for low dimension values', () => {
    const { container } = render(
      <DecisionHealthRing dimensions={{ structure: 0.2, evidence: 0.2, coverage: 0.2, verified: 0.2 }} />
    )
    const svg = container.querySelector('svg')!
    // All filled arcs should use danger colour (value < 40%)
    const filledPaths = svg.querySelectorAll('g > path:nth-child(2)')
    filledPaths.forEach((path) => {
      expect(path.getAttribute('stroke')).toBe('var(--danger)')
    })
  })

  it('uses success colour for high dimension values', () => {
    const { container } = render(
      <DecisionHealthRing dimensions={{ structure: 0.9, evidence: 0.9, coverage: 0.9, verified: 0.9 }} />
    )
    const svg = container.querySelector('svg')!
    const filledPaths = svg.querySelectorAll('g > path:nth-child(2)')
    filledPaths.forEach((path) => {
      expect(path.getAttribute('stroke')).toBe('var(--success)')
    })
  })

  it('uses warning colour for mid-range dimension values', () => {
    const { container } = render(
      <DecisionHealthRing dimensions={{ structure: 0.5, evidence: 0.5, coverage: 0.5, verified: 0.5 }} />
    )
    const svg = container.querySelector('svg')!
    const filledPaths = svg.querySelectorAll('g > path:nth-child(2)')
    filledPaths.forEach((path) => {
      expect(path.getAttribute('stroke')).toBe('var(--warning)')
    })
  })

  it('applies correct threshold at boundary values', () => {
    const { container: c39 } = render(
      <DecisionHealthRing dimensions={{ structure: 0.39, evidence: 0.39, coverage: 0.39, verified: 0.39 }} />
    )
    const filled39 = c39.querySelector('svg g > path:nth-child(2)')!
    expect(filled39.getAttribute('stroke')).toBe('var(--danger)')

    const { container: c40 } = render(
      <DecisionHealthRing dimensions={{ structure: 0.40, evidence: 0.40, coverage: 0.40, verified: 0.40 }} />
    )
    const filled40 = c40.querySelector('svg g > path:nth-child(2)')!
    expect(filled40.getAttribute('stroke')).toBe('var(--warning)')

    const { container: c69 } = render(
      <DecisionHealthRing dimensions={{ structure: 0.69, evidence: 0.69, coverage: 0.69, verified: 0.69 }} />
    )
    const filled69 = c69.querySelector('svg g > path:nth-child(2)')!
    expect(filled69.getAttribute('stroke')).toBe('var(--warning)')

    const { container: c70 } = render(
      <DecisionHealthRing dimensions={{ structure: 0.70, evidence: 0.70, coverage: 0.70, verified: 0.70 }} />
    )
    const filled70 = c70.querySelector('svg g > path:nth-child(2)')!
    expect(filled70.getAttribute('stroke')).toBe('var(--success)')
  })
})
