/**
 * ActionNode component tests
 * Tests rendering, icon, and description display
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ActionNode } from '../ActionNode'
import { NODE_REGISTRY } from '../../domain/nodes'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

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
  deletable: true,
  selectable: true,
  draggable: true,
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
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [], edges: [] })
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null })
  })

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

  it('states missing detail without inventing task metadata or changing on selection', () => {
    const { rerender } = renderWithProvider()
    expect(screen.queryByTestId('action-summary')).toBeNull()
    expect(screen.getByText('No action details captured.')).toBeInTheDocument()

    rerender(<ReactFlowProvider><ActionNode {...defaultProps} selected /></ReactFlowProvider>)
    expect(screen.getByText('No action details captured.')).toBeInTheDocument()
    expect(screen.queryByTestId('action-connections')).toBeNull()
  })

  it('uses authored body when description is absent or blank', () => {
    renderWithProvider({ data: { ...defaultProps.data, description: '  ', body: 'Interview five customers about renewal.' } })
    expect(screen.getByTestId('action-summary')).toHaveTextContent('Interview five customers about renewal.')
  })

  it('keeps selected cards compact and opens complete description and body through the existing control', () => {
    const description = 'Run a pilot with the support team. '.repeat(20)
    const body = 'Test whether shared triage reduces repeated escalations.\nRecord conflicting feedback too.'
    const data = { ...defaultProps.data, description, body }
    const { rerender } = renderWithProvider({ data })
    expect(screen.getByTestId('action-summary').textContent).toBe(description)
    expect(screen.getByTestId('action-summary')).toHaveClass('line-clamp-2')
    expect(screen.queryByText(/Test whether shared triage/)).toBeNull()

    rerender(<ReactFlowProvider><ActionNode {...defaultProps} data={data} selected /></ReactFlowProvider>)
    expect(screen.getByTestId('action-summary')).toHaveClass('line-clamp-2')
    fireEvent.click(screen.getByRole('button', { name: 'Expand description' }))
    expect(screen.getByText(/Test whether shared triage/)).toHaveTextContent('Record conflicting feedback too.')
    expect(screen.getByTestId('action-summary')).toHaveClass('group-aria-expanded:hidden')
    expect(screen.getByRole('button', { name: 'Collapse description' })).toBeInTheDocument()
  })

  it('does not duplicate matching body text or render malformed content as an object', () => {
    const { rerender } = renderWithProvider({ selected: true, data: { ...defaultProps.data, description: 'Run interviews', body: ' Run interviews ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Expand description' }))
    expect(document.querySelector('.node-description')?.textContent?.trim()).toBe('Run interviews')

    rerender(<ReactFlowProvider><ActionNode {...defaultProps} selected data={{ ...defaultProps.data, description: { text: 'bad' }, body: 42 }} /></ReactFlowProvider>)
    expect(screen.getByText('No action details captured.')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).toBeNull()
  })

  it('shows actual connections before analysis without claiming what the action achieves', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'assumption', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Customers want assisted onboarding' } },
        { id: 'consequence', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Renewal rate' } },
        { id: 'unnamed', type: 'factor', position: { x: 0, y: 0 }, data: { label: '  ' } },
      ],
      edges: [
        { id: 'in', source: 'assumption', target: defaultProps.id },
        { id: 'out', source: defaultProps.id, target: 'consequence' },
        { id: 'unknown-label', source: defaultProps.id, target: 'unnamed' },
        { id: 'dangling', source: defaultProps.id, target: 'missing' },
        { id: 'unrelated', source: 'assumption', target: 'consequence' },
      ],
    })
    renderWithProvider()
    expect(screen.getByText('Linked: Customers want assisted onboarding (+2)')).toBeInTheDocument()
    const context = screen.getByTestId('action-connections')
    expect(context).not.toHaveTextContent(/confidence|owner|due|confirmed|missing/)
  })

  it('keeps Ask bound to the specific action before the existing conversation sends', async () => {
    const action = { id: defaultProps.id, type: 'action', position: { x: 0, y: 0 }, data: { ...defaultProps.data, description: 'Interview customers.', body: 'Record which assumption the interviews challenge.' } }
    useCanvasStore.setState({ nodes: [
      { id: 'other-action', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Another action' } },
      action,
    ] })
    const sendMessage = vi.fn(() => {
      expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([defaultProps.id])
      expect(useCanvasStore.getState().nodes.find(node => node.id === defaultProps.id)?.data).toEqual(action.data)
    })
    useGuidanceStore.setState({ _sendMessage: sendMessage })
    renderWithProvider({ data: action.data })
    fireEvent.click(screen.getByRole('button', { name: 'Ask Olumi about Send notification' }))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Explain the role of "Send notification" in this decision model.'))
    expect(screen.getByRole('button', { name: 'More actions for Send notification' })).toBeInTheDocument()
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
    expect(defaultSize.width).toBe(220)
    expect(defaultSize.height).toBe(100)
  })
})
