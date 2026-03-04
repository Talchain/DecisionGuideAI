/**
 * Unit tests for NodeShapeIndicator
 * T1: Shape indicator renders for each node type, no all-caps text
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { NodeShapeIndicator } from '../NodeShapeIndicator'
import type { NodeType } from '../../domain/nodes'

const NODE_TYPES: NodeType[] = ['factor', 'option', 'goal', 'decision', 'risk', 'outcome', 'action', 'constraint']

describe('NodeShapeIndicator', () => {
  it.each(NODE_TYPES)('renders an SVG for nodeKind "%s"', (nodeKind) => {
    const { container } = render(<NodeShapeIndicator nodeKind={nodeKind} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it.each(NODE_TYPES)('SVG has aria-hidden for "%s"', (nodeKind) => {
    const { container } = render(<NodeShapeIndicator nodeKind={nodeKind} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('applies custom size', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="factor" size={20} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('20')
    expect(svg?.getAttribute('height')).toBe('20')
  })

  it('defaults to size 12', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="goal" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('12')
  })

  it('renders a circle shape for factor', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="factor" />)
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('renders a rect shape for option', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="option" />)
    expect(container.querySelector('rect')).not.toBeNull()
  })

  it('renders a polygon for goal (diamond)', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="goal" />)
    expect(container.querySelector('polygon')).not.toBeNull()
  })

  it('renders a polygon for decision (hexagon)', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="decision" />)
    expect(container.querySelector('polygon')).not.toBeNull()
  })

  it('renders a polygon for risk (inverted triangle)', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="risk" />)
    expect(container.querySelector('polygon')).not.toBeNull()
  })

  it('renders two circles for outcome (ringed circle)', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="outcome" />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })

  it('applies className prop', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="factor" className="test-class" />)
    const svg = container.querySelector('svg')
    // SVGAnimatedString — use getAttribute for portability in JSDOM
    expect(svg?.getAttribute('class')).toContain('test-class')
  })
})
