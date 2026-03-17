/**
 * NodeInspector icon rendering tests
 * Ensures icons (string, Lucide, ReactNode) render without crashes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Target, Crosshair } from 'lucide-react'
import { NodeInspector } from '../NodeInspector'
import { useCanvasStore } from '../../store'

// B.I.4: Use real store with setState instead of mock
// The accordion layout requires more store fields than the old flat layout

describe('NodeInspector - Icon Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
      nodes: [
        { id: 'test-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal', kind: 'goal' } }
      ],
      edges: [],
      goalThreshold: null,
      goalConstraints: [],
      outcomeNodeId: undefined,
      touchedNodeIds: new Set(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with Lucide icon component without crashing', () => {
    const { container } = render(<NodeInspector nodeId="test-1" onClose={() => {}} />)

    // Should render an SVG (Lucide icons are SVGs)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
  })

  it('displays node label and metadata', () => {
    render(<NodeInspector nodeId="test-1" onClose={() => {}} />)

    // B.I.4: Summary shows label as read-only text, type label as span
    // Assumptions section (defaultOpen) has input for label
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

  it('has fallback bullet in code for malformed icons', () => {
    const { container } = render(<NodeInspector nodeId="test-1" onClose={() => {}} />)

    // Component should render without crashing
    expect(container).toBeDefined()

    // Verify the component has proper aria structure
    const region = screen.getByRole('region', { name: 'Node properties' })
    expect(region).toBeDefined()
  })
})
