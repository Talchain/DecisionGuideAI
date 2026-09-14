import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { GenericNodePanel } from '../panels/GenericNodePanel'

const fixture = vi.hoisted(() => ({
  nodes: [] as Node[],
  edges: [] as Edge[],
  saveDescription: vi.fn(),
}))

vi.mock('../../../store', () => ({
  useCanvasStore: (selector: (state: { nodes: Node[]; edges: Edge[] }) => unknown) => selector(fixture),
}))

// Receive the existing mutation call without exercising a writer or bypassing
// the InspectorRouter's disabled fieldset in the product.
vi.mock('../useInspectorMutations', () => ({
  useNodeMutations: (nodeId: string) => ({
    setDescription: (value: string) => fixture.saveDescription(nodeId, value),
  }),
}))

const panelProps = { nodeId: 'action-a', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const node = (id: string, data: Record<string, unknown>, type = 'action'): Node => ({
  id, type, data, position: { x: 0, y: 0 },
})

describe('GenericNodePanel authored context', () => {
  beforeEach(() => {
    fixture.nodes = []
    fixture.edges = []
    fixture.saveDescription.mockReset()
    panelProps.onNavigate.mockReset()
  })

  it('keeps a complete long description readable within the existing disabled fieldset', () => {
    const description = 'Ask the pilot team what failed and record contrasting feedback.\n'.repeat(15)
    fixture.nodes = [node('action-a', { description, body: 'Check whether assisted onboarding helps.' })]
    render(<fieldset disabled><GenericNodePanel {...panelProps} /></fieldset>)

    const field = screen.getByRole('textbox', { name: 'Description' })
    expect(field).toHaveValue(description)
    expect(field).toBeDisabled()
    expect(field).toHaveAttribute('maxlength', '500')
    expect(screen.getByTestId('inspector-generic-body')).toHaveTextContent('Check whether assisted onboarding helps.')
    expect(fixture.saveDescription).not.toHaveBeenCalled()
  })

  it('fits the existing description field to its measured content and preserves its mutation route', () => {
    fixture.nodes = [node('action-a', { description: 'Run the pilot', body: 'Keep the interview notes.' })]
    render(<GenericNodePanel {...panelProps} />)
    const field = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 280 })
    Object.defineProperty(field, 'offsetHeight', { configurable: true, value: 62 })
    Object.defineProperty(field, 'clientHeight', { configurable: true, value: 60 })

    fireEvent.change(field, { target: { value: 'Run interviews with both customer groups.' } })
    expect(field.style.height).toBe('282px')
    fireEvent.blur(field)
    expect(fixture.saveDescription).toHaveBeenCalledTimes(1)
    expect(fixture.saveDescription).toHaveBeenCalledWith('action-a', 'Run interviews with both customer groups.')
    expect(fixture.nodes[0].data.body).toBe('Keep the interview notes.')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('shows body-only content as plain readable text, including line breaks', () => {
    const body = 'Record the assumption being tested.\nKeep <strong>contradictory</strong> observations too.'
    fixture.nodes = [node('action-a', { body })]
    render(<GenericNodePanel {...panelProps} />)
    const detail = within(screen.getByTestId('inspector-generic-body')).getByText(/Record the assumption/)
    expect(detail.textContent).toBe(body)
    expect(detail).toHaveClass('whitespace-pre-wrap', 'break-words')
    expect(detail.querySelector('strong')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(fixture.saveDescription).not.toHaveBeenCalled()
  })

  it('does not repeat a body that matches the displayed description', () => {
    fixture.nodes = [node('action-a', { description: 'Run the pilot', body: '  Run the pilot  ' })]
    render(<GenericNodePanel {...panelProps} />)
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Run the pilot')
    expect(screen.queryByTestId('inspector-generic-body')).toBeNull()
  })

  it.each([
    { description: { text: 'object' }, body: ['array'] },
    { description: 42, body: false },
    { description: null, body: '  ' },
  ])('treats malformed or empty text as unavailable: %j', data => {
    fixture.nodes = [node('action-a', data)]
    render(<GenericNodePanel {...panelProps} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByTestId('inspector-generic-body')).toBeNull()
    expect(screen.getByTestId('inspector-generic-panel')).not.toHaveTextContent('[object Object]')
  })

  it('retains the router-keyed draft lifetime and supports another fallback node kind', () => {
    fixture.nodes = [
      node('action-a', { description: 'Pilot A', body: 'Interview group A.' }),
      node('constraint-b', { description: 'Keep costs within the budget', body: 'Include support costs.' }, 'constraint'),
    ]
    const { rerender } = render(<GenericNodePanel key="action-a" {...panelProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Local draft for A' } })
    rerender(<GenericNodePanel key="constraint-b" {...panelProps} nodeId="constraint-b" />)

    expect(screen.getByRole('textbox')).toHaveValue('Keep costs within the budget')
    expect(screen.getByTestId('inspector-generic-body')).toHaveTextContent('Include support costs.')
    expect(screen.queryByText('Interview group A.')).toBeNull()
    fireEvent.blur(screen.getByRole('textbox'))
    expect(fixture.saveDescription).toHaveBeenCalledTimes(1)
    expect(fixture.saveDescription).toHaveBeenCalledWith('constraint-b', 'Keep costs within the budget')
  })

  it('preserves an active description draft when the same node receives new body context', () => {
    fixture.nodes = [node('action-a', { description: 'Saved description', body: 'Old context' })]
    const { rerender } = render(<GenericNodePanel {...panelProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Current local draft' } })
    fixture.nodes = [node('action-a', { description: 'Saved description', body: 'New context' })]
    rerender(<GenericNodePanel {...panelProps} techMode />)
    expect(screen.getByRole('textbox')).toHaveValue('Current local draft')
    expect(screen.getByTestId('inspector-generic-body')).toHaveTextContent('New context')
    expect(fixture.saveDescription).not.toHaveBeenCalled()
  })

  it('retains full connection labels and navigation, without rendering dangling endpoints', () => {
    const label = 'The assumption that customers will renew after assisted onboarding'
    fixture.nodes = [node('action-a', { body: 'Interview renewing customers.' }), node('factor-b', { label }, 'factor')]
    fixture.edges = [
      { id: 'edge-ab', source: 'action-a', target: 'factor-b' },
      { id: 'edge-missing', source: 'action-a', target: 'missing' },
    ]
    render(<GenericNodePanel {...panelProps} />)
    fireEvent.click(screen.getByText(label))
    expect(panelProps.onNavigate).toHaveBeenCalledTimes(1)
    expect(panelProps.onNavigate).toHaveBeenCalledWith('factor-b')
    expect(screen.getByTestId('inspector-generic-panel')).not.toHaveTextContent('missing')
  })
})
