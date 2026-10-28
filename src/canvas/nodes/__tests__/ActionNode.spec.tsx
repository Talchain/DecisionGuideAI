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
import words from '../shared/__tests__/fixtures/q1-words-graph.hand-made.json'

// Mock ResizeObserver for React Flow
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    Handle: () => null, // Simplified handle for tests
  }
})

// Q1 readers: the saved read a limit card's withheld reason comes from; none unless a row sets one.
const savedRead = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../shared/savedGraph', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), useSavedGraph: () => savedRead.graph }))

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

  it('keeps Ask bound to the specific action — the resting coaching icon PRE-FILLS the question, never sends it silently (Paul 23 Sep point 6; contract v3)', async () => {
    const action = { id: defaultProps.id, type: 'action', position: { x: 0, y: 0 }, data: { ...defaultProps.data, description: 'Interview customers.', body: 'Record which assumption the interviews challenge.' } }
    useCanvasStore.setState({ nodes: [
      { id: 'other-action', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Another action' } },
      action,
    ] })
    const sendMessage = vi.fn()
    const dispatch = vi.fn(() => {
      expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([defaultProps.id])
      expect(useCanvasStore.getState().nodes.find(node => node.id === defaultProps.id)?.data).toEqual(action.data)
    })
    useCanvasStore.setState({ hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
    useGuidanceStore.setState({ _sendMessage: sendMessage, _prefillChat: vi.fn(), _dispatchAction: dispatch, _isConversationBusy: () => false } as never)
    renderWithProvider({ data: action.data })
    fireEvent.click(screen.getByRole('button', { name: 'Ask Olumi about Send notification' }))
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'ask:explain', source: 'chip', message: 'What does ‘Send notification’ do in this decision, and what is it assumed to depend on?' })))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(sendMessage).not.toHaveBeenCalled()
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

// Q1 readers (DL GO G5, 28 Oct): a limit card (`mp:limit:<id>`, kind 'action') whose outcome is not calculable says why,
// in the goal card's one muted line, from the saved read's `withheld_reason`. Hand-made graph.
describe('ActionNode — a limit card that is not calculated says why', () => {
  const limit = words.nodes.find((n) => n.id === 'mp:limit:budget')!
  beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [] }); savedRead.graph = null })
  it('"Not calculated yet: <reason>", muted', () => {
    savedRead.graph = words
    renderWithProvider({ id: limit.id, data: { label: limit.label, description: limit.description, type: 'action' } })
    const line = screen.getByTestId('action-withheld-reason-mp:limit:budget')
    expect(line.textContent).toBe('Not calculated yet: Its figure is not given yet.')
    expect(line.className).toContain('text-text-light')
  })
  it('CONTRAST: no saved reason, or a card that is not a limit, has no such line', () => {
    renderWithProvider({ id: limit.id, data: { label: limit.label, type: 'action' } })
    expect(screen.queryByTestId('action-withheld-reason-mp:limit:budget')).toBeNull()
    const g = structuredClone(words) as { nodes: Array<Record<string, unknown>> }
    g.nodes.push({ id: 'action-1', kind: 'action', label: 'Send notification', withheld_reason: 'Not a limit.' })
    savedRead.graph = g
    renderWithProvider()
    expect(screen.queryByText(/Not calculated yet/)).toBeNull()
  })
})
