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

/**
 * ⭐ CONTRACT v3.1 SHAPE GEOMETRY (FRAME-03, OR-05, OR-09) — the contract's
 * `shape()` paths (24-unit box) ÷ 2 into this 12-unit box.
 */
describe('NodeShapeIndicator — contract v3.1 geometry', () => {
  const extents = (points: string) => {
    const pts = points.trim().split(/\s+/).map(p => p.split(',').map(Number))
    const xs = pts.map(p => p[0])
    const ys = pts.map(p => p[1])
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), pts }
  }

  it('the Question hexagon is FLAT-TOP, pointed left and right (`M6 2h12l6 10-6 10H6L0 12z` ÷ 2)', () => {
    const { container } = render(<NodeShapeIndicator nodeKind="decision" />)
    const points = container.querySelector('polygon')!.getAttribute('points')!
    expect(points).toBe('3.25,1.5 8.75,1.5 11.5,6 8.75,10.5 3.25,10.5 0.5,6')
    const { pts } = extents(points)
    // Two vertices share the top edge (flat top); the extreme x vertices sit at mid-height (points).
    expect(pts.filter(p => p[1] === 1.5)).toHaveLength(2)
    expect(pts.filter(p => p[1] === 6).map(p => p[0]).sort((a, b) => a - b)).toEqual([0.5, 11.5])
  })

  it('outcome ▲ and risk ▼ share ONE 12-unit box and identical extents — they differ only in direction', () => {
    const up = render(<NodeShapeIndicator nodeKind="outcome" />).container
    const down = render(<NodeShapeIndicator nodeKind="risk" />).container
    expect(up.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 12 12')
    expect(down.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 12 12')
    const a = extents(up.querySelector('polygon')!.getAttribute('points')!)
    const b = extents(down.querySelector('polygon')!.getAttribute('points')!)
    expect([a.w, a.h]).toEqual([11, 10])
    expect([b.w, b.h]).toEqual([11, 10])
  })

  it('an optional outline is spread onto the shape; absent, the shape carries no stroke', () => {
    const outlined = render(<NodeShapeIndicator nodeKind="goal" stroke="var(--bg-panel)" strokeWidth={0.6} />).container
    const shape = outlined.querySelector('polygon')!
    expect(shape.getAttribute('stroke')).toBe('var(--bg-panel)')
    expect(shape.getAttribute('stroke-width')).toBe('0.6')
    const plain = render(<NodeShapeIndicator nodeKind="goal" />).container
    expect(plain.querySelector('polygon')!.getAttribute('stroke')).toBeNull()
  })
})
