/**
 * ActionNode component tests
 * Tests rendering, icon, and description display
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ActionNode } from '../ActionNode'
import { NODE_REGISTRY } from '../../domain/nodes'

// Mock ResizeObserver for React Flow
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    Handle: () => null, // Simplified handle for tests
  }
})

const defaultProps = {
  id: 'action-1',
  data: { label: 'Send notification', type: 'action' },
  type: 'action',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderWithProvider = (props = {}) => {
  return render(
    <ReactFlowProvider>
      <ActionNode {...defaultProps} {...props} />
    </ReactFlowProvider>
  )
}

describe('ActionNode', () => {
  it('renders with label', () => {
    renderWithProvider()
    expect(screen.getByText('Send notification')).toBeDefined()
  })

  it('renders description when provided', () => {
    renderWithProvider({
      data: {
        label: 'Deploy app',
        type: 'action',
        description: 'Push to production server',
      },
    })
    expect(screen.getByText('Deploy app')).toBeDefined()
    expect(screen.getByText('Push to production server')).toBeDefined()
  })

  it('does not render description when not provided', () => {
    const { container } = renderWithProvider()
    // Only the label should be present, no description div
    const descriptionDiv = container.querySelector('[style*="opacity: 0.7"]')
    expect(descriptionDiv).toBeNull()
  })

  it('uses correct metadata from NODE_REGISTRY', () => {
    const metadata = NODE_REGISTRY.action
    expect(metadata).toBeDefined()
    expect(metadata.label).toBe('Action')
    expect(metadata.icon).toBeDefined()
  })

  it('has displayName set for debugging', () => {
    expect(ActionNode.displayName).toBe('ActionNode')
  })
})

describe('ActionNode - NODE_REGISTRY integration', () => {
  it('action has Zap icon in registry', () => {
    const { icon } = NODE_REGISTRY.action
    expect(icon).toBeDefined()
    // Lucide icons are forwardRef components (objects with $$typeof)
    // They can be either functions or objects depending on how they're exported
    expect(typeof icon === 'function' || typeof icon === 'object').toBe(true)
  })

  it('action has correct default dimensions', () => {
    const { defaultSize } = NODE_REGISTRY.action
    expect(defaultSize.width).toBe(180)
    expect(defaultSize.height).toBe(70)
  })
})
