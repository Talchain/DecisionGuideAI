/**
 * PropertiesPanel - Inspector Routing Tests
 * Tests that panel correctly routes to NodeInspector/EdgeInspector based on selection
 * Timer/debounce logic is now owned by inspectors (tested separately)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PropertiesPanel } from '../PropertiesPanel'
import { useCanvasStore } from '../../store'

// Mock inspectors to avoid complex dependencies
vi.mock('../../ui/NodeInspector', () => ({
  NodeInspector: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="node-inspector" aria-label="Node properties">
      Inspector for node {nodeId}
    </div>
  )
}))

vi.mock('../../ui/EdgeInspector', () => ({
  EdgeInspector: ({ edgeId }: { edgeId: string }) => (
    <div data-testid="edge-inspector" aria-label="Edge properties">
      Inspector for edge {edgeId}
    </div>
  )
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    }
    return selector ? selector(state) : state
  })
}))

describe('PropertiesPanel - Inspector Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows NodeInspector when exactly one node is selected', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        selection: { nodeIds: new Set(['node-1']), edgeIds: new Set() }
      }
      return selector ? selector(state) : state
    })

    const { getByLabelText, getByTestId } = render(<PropertiesPanel />)
    
    expect(getByTestId('node-inspector')).toBeDefined()
    expect(getByLabelText('Node properties')).toBeDefined()
  })

  it('shows EdgeInspector when exactly one edge is selected', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        selection: { nodeIds: new Set(), edgeIds: new Set(['edge-1']) }
      }
      return selector ? selector(state) : state
    })

    const { getByLabelText, getByTestId } = render(<PropertiesPanel />)
    
    expect(getByTestId('edge-inspector')).toBeDefined()
    expect(getByLabelText('Edge properties')).toBeDefined()
  })

  it('shows empty guidance when nothing selected', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        selection: { nodeIds: new Set(), edgeIds: new Set() }
      }
      return selector ? selector(state) : state
    })

    const { getByText } = render(<PropertiesPanel />)
    
    expect(getByText('Select a node or edge to edit its details.')).toBeDefined()
  })

  it('handles rapid selection switching without crashes', () => {
    // Start with node selected
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        selection: { nodeIds: new Set(['node-1']), edgeIds: new Set() }
      }
      return selector ? selector(state) : state
    })

    const { rerender, getByTestId, getByText } = render(<PropertiesPanel />)
    expect(getByTestId('node-inspector')).toBeDefined()

    // Switch to edge
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        selection: { nodeIds: new Set(), edgeIds: new Set(['edge-1']) }
      }
      return selector ? selector(state) : state
    })
    rerender(<PropertiesPanel />)
    expect(getByTestId('edge-inspector')).toBeDefined()

    // Switch to empty
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        selection: { nodeIds: new Set(), edgeIds: new Set() }
      }
      return selector ? selector(state) : state
    })
    rerender(<PropertiesPanel />)
    expect(getByText('Select a node or edge to edit its details.')).toBeDefined()

    // No crashes - test passes
  })
})
