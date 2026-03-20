import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../../components/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { KeyRelationships } = await import('../KeyRelationships')

function makeEdge(id: string, source: string, target: string, weight = 0.5, direction = 'positive') {
  return {
    id,
    source,
    target,
    data: { weight, direction },
  } as any
}

function makeNode(id: string, label: string) {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } } as any
}

describe('KeyRelationships', () => {
  it('renders top edges by connectivity', () => {
    const nodes = [makeNode('f1', 'Cost'), makeNode('f2', 'Revenue'), makeNode('f3', 'Profit')]
    const edges = [
      makeEdge('e1', 'f1', 'f3', 0.5, 'negative'),
      makeEdge('e2', 'f2', 'f3', 0.3, 'positive'),
    ]

    render(<KeyRelationships edges={edges} nodes={nodes} />)

    expect(screen.getByText(/Key relationships/)).toBeInTheDocument()
    expect(screen.getByText('Cost → Profit')).toBeInTheDocument()
    expect(screen.getByText('Revenue → Profit')).toBeInTheDocument()
  })

  it('returns null when no causal edges exist', () => {
    const nodes = [makeNode('f1', 'A')]
    const edges = [{ id: 'e1', source: 'f1', target: 'f2', data: {} } as any]

    const { container } = render(<KeyRelationships edges={edges} nodes={nodes} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for empty or undefined edges', () => {
    const { container } = render(<KeyRelationships edges={[]} nodes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onUpdateEdgeStrength when quick-select is clicked', () => {
    const onUpdate = vi.fn()
    const nodes = [makeNode('f1', 'A'), makeNode('f2', 'B')]
    const edges = [makeEdge('e1', 'f1', 'f2', 0.5, 'positive')]

    render(<KeyRelationships edges={edges} nodes={nodes} onUpdateEdgeStrength={onUpdate} />)

    fireEvent.click(screen.getByText('Weakly'))
    expect(onUpdate).toHaveBeenCalledWith('e1', 0.15)
  })

  it('calls onFocusEdge when edge label is clicked', () => {
    const onFocus = vi.fn()
    const nodes = [makeNode('f1', 'A'), makeNode('f2', 'B')]
    const edges = [makeEdge('e1', 'f1', 'f2', 0.5, 'positive')]

    render(<KeyRelationships edges={edges} nodes={nodes} onFocusEdge={onFocus} />)

    fireEvent.click(screen.getByText('A → B'))
    expect(onFocus).toHaveBeenCalledWith('e1')
  })

  it('highlights current strength band', () => {
    const nodes = [makeNode('f1', 'A'), makeNode('f2', 'B')]
    const edges = [makeEdge('e1', 'f1', 'f2', 0.70, 'positive')]

    render(<KeyRelationships edges={edges} nodes={nodes} />)

    const strongBtn = screen.getByText('Strongly')
    expect(strongBtn.className).toContain('bg-info/10')
  })
})
