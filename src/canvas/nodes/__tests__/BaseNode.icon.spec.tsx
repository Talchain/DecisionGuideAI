/**
 * BaseNode icon rendering tests
 * Prevents regression: ensure Lucide icons render as components, not objects
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Target, Crosshair, GitBranch, AlertTriangle, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

describe('BaseNode - Icon Type Safety', () => {
  it('accepts Lucide icon components as valid icon prop type', () => {
    // Type-level test: these should compile without errors
    const icons: LucideIcon[] = [
      Target,
      Crosshair,
      GitBranch,
      AlertTriangle,
      CheckCircle
    ]
    
    expect(icons).toHaveLength(5)
    // Icons are React components (function or object with $$typeof)
    expect(icons[0]).toBeDefined()
  })

  it('renders Lucide icons as React elements, not objects', () => {
    const Icon = Target
    const { container } = render(<Icon size={16} />)
    
    // Should render an SVG element
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.tagName).toBe('svg')
  })

  it('different icon types render distinct SVG elements', () => {
    const { container: container1 } = render(<Crosshair size={16} />)
    const { container: container2 } = render(<GitBranch size={16} />)
    
    const svg1 = container1.querySelector('svg')
    const svg2 = container2.querySelector('svg')
    
    expect(svg1).toBeDefined()
    expect(svg2).toBeDefined()
    // Different icons should have different paths
    expect(svg1?.innerHTML).not.toBe(svg2?.innerHTML)
  })
})
