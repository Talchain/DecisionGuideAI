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

  // V6: Outcome is now an upward triangle, not a ringed circle
  it('renders polygon (upward triangle) for outcome', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="outcome" />)
    const polygon = container.querySelector('polygon')
    expect(polygon).not.toBeNull()
    expect(container.querySelectorAll('circle').length).toBe(0)
  })

  it('outcome polygon points upward (apex at top)', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="outcome" />)
    const polygon = container.querySelector('polygon')
    // Points: "7,1 13,13 1,13" — apex y=1 (top), base y=13 (bottom)
    const points = polygon?.getAttribute('points') ?? ''
    const ys = points.split(' ').map(p => Number(p.split(',')[1]))
    expect(Math.min(...ys)).toBeLessThan(Math.max(...ys))
    // The minimum y (apex) should be at or near the top (small value)
    expect(Math.min(...ys)).toBeLessThanOrEqual(2)
  })

  it('applies className prop', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="factor" className="test-class" />)
    const svg = container.querySelector('svg')
    // SVGAnimatedString — use getAttribute for portability in JSDOM
    expect(svg?.getAttribute('class')).toContain('test-class')
  })
})
