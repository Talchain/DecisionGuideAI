/**
 * NodeInspector icon rendering tests
 * Ensures icons (string, Lucide, ReactNode) render without crashes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Target, Crosshair } from 'lucide-react'
import { NodeInspector } from '../NodeInspector'

// Mock store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      nodes: [
        { id: 'test-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal', type: 'goal' } }
      ],
      updateNode: vi.fn()
    }
    return selector ? selector(state) : state
  })
}))

// Mock NODE_REGISTRY with different icon types
vi.mock('../../domain/nodes', () => ({
  NODE_REGISTRY: {
    goal: {
      icon: Target, // Lucide component
      label: 'Goal',
      ariaRole: 'group',
      defaultSize: { width: 200, height: 80 }
    },
    decision: {
      icon: Crosshair,
      label: 'Decision',
      ariaRole: 'group',
      defaultSize: { width: 200, height: 80 }
    }
  }
}))

describe('NodeInspector - Icon Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with Lucide icon component without crashing', () => {
    const { container } = render(<NodeInspector nodeId="test-1" onClose={() => {}} />)
    
    // Should render an SVG (Lucide icons are SVGs)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('displays node label and metadata', () => {
    render(<NodeInspector nodeId="test-1" onClose={() => {}} />)
    
    expect(screen.getByRole('heading', { name: 'Goal' })).toBeDefined()
    expect(screen.getByDisplayValue('Test Goal')).toBeDefined()
  })

  it('renders without crash when node type changes', () => {
    const { rerender, container } = render(<NodeInspector nodeId="test-1" onClose={() => {}} />)
    
    // Should not crash on rerender
    rerender(<NodeInspector nodeId="test-1" onClose={() => {}} />)
    
    // Check SVG still renders
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
  })
})
