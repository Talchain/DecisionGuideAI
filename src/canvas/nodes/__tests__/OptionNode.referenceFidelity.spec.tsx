import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const option = (id: string, data: Record<string, unknown> = {}) => ({
  id, type: 'option', position: { x: 0, y: 0 },
  data: { label: id, type: 'option', ...data },
})
const price = {
  id: 'price', type: 'factor', position: { x: 0, y: 0 },
  data: { label: 'Price', observedState: { unit: 'fraction', value: 0.8 } },
}
const candidate = option('candidate', { interventions: { price: 0.8 } })
const baseline = (data: Record<string, unknown> = {}) => option('reference', {
  label: 'Keep the original plan', is_baseline: true,
  interventions: { price: 0.4 }, ...data,
})

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [], edges: [], ceeAnalysisReady: null, viewMode: 'expert',
    results: { status: 'complete', report: {} },
  } as never)
})
afterEach(cleanup)

function mount(references: ReturnType<typeof option>[] = [], overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({ nodes: [candidate, price, ...references], ...overrides } as never)
  return render(<ReactFlowProvider><OptionNode
    id={candidate.id} type="option" data={candidate.data} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable
  /></ReactFlowProvider>)
}

describe('option targets and their declared reference through the real store', () => {
  it('keeps a target that equals the observed value without claiming it changes nothing', () => {
    mount()
    expect(screen.getByText('What this option sets:')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.queryByText(/No changes from current state/)).toBeNull()
    expect(screen.queryByText(/Reference:/)).toBeNull()
  })

  it('compares against the declared option, names it and does not invent relative change', () => {
    mount([baseline()])
    // Observed=0.8, reference=0.4, target=0.8: using the observed value
    // would hide the row or claim no change instead of this identified pair.
    expect(screen.getByText('Reference: Keep the original plan')).toBeInTheDocument()
    expect(screen.getByText('40% → 80%')).toBeInTheDocument()
    expect(screen.queryByText(/\(\+100/)).toBeNull()
    expect(screen.queryByText(/current state/i)).toBeNull()
  })

  it('identifies an equal target against the named reference without claiming the present state', () => {
    mount([baseline({ interventions: { price: 0.8 } })])
    expect(screen.getByText('Reference: Keep the original plan')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('(same as reference)')).toBeInTheDocument()
    expect(screen.queryByText(/current state/i)).toBeNull()
  })

  it('keeps a supplied target without suggesting a comparison to an unlabelled reference', () => {
    mount([baseline()], {
      ceeAnalysisReady: { options: [{ id: 'candidate', interventions: { price: { value: 0.8, display_value: 'Proposed level' } } }] },
    })
    expect(screen.getByText('Proposed level')).toBeInTheDocument()
    expect(screen.queryByText(/Reference:/)).toBeNull()
    expect(screen.queryByText(/same as reference/)).toBeNull()
  })

  it.each([
    ['label only', { label: 'Status quo', is_baseline: undefined }],
    ['explicitly not baseline', { label: 'Status quo', is_baseline: false }],
    ['missing target', { interventions: {} }],
    ['malformed target', { interventions: { price: { value: null } } }],
  ])('does not fabricate a before-value from a %s reference', (_name, data) => {
    mount([baseline(data)])
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.queryByText(/Reference:/)).toBeNull()
    expect(screen.queryByText('40% → 80%')).toBeNull()
  })

  it('does not select an arbitrary reference when two options declare themselves baseline', () => {
    mount([baseline(), { ...baseline(), id: 'second-reference' }])
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.queryByText(/Reference:/)).toBeNull()
  })

  it('counts all targets, including those equal to unbound observations, in overflow', () => {
    const interventions = { a: 0.8, b: 0.8, c: 0.8, d: 0.8, e: 0.8 }
    const factors = Object.keys(interventions).map(id => ({
      ...price, id, data: { ...price.data, label: `Factor ${id}` },
    }))
    mount([], {
      nodes: [option('candidate', { interventions }), ...factors],
    })
    expect(screen.getAllByText('80%')).toHaveLength(3)
    expect(screen.getByText('+2 more in inspector')).toBeInTheDocument()
    expect(screen.queryByText(/No changes from current state/)).toBeNull()
  })

  it('uses the reference intervention label, not the factor observed label', () => {
    const reference = baseline({ interventions: { price: { value: 0.4, display_value: 'Original level' } } })
    mount([reference], {
      nodes: [candidate, reference, { ...price, data: { ...price.data, display_value: 'Observed level' } }],
      ceeAnalysisReady: { options: [{ id: 'candidate', interventions: { price: { value: 0.8, display_value: 'Proposed level' } } }] },
    })
    expect(screen.getByText('Original level → Proposed level')).toBeInTheDocument()
    expect(screen.queryByText(/Observed level/)).toBeNull()
  })
})
