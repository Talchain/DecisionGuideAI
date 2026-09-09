import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ReactFlowProvider, type Node } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { GoalNode } from '../GoalNode'
import { FactorControllablePanel } from '../../ui/inspector-v2/panels/FactorControllablePanel'
import { GoalPanel } from '../../ui/inspector-v2/panels/GoalPanel'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async (original) => ({
  ...await original<typeof import('@xyflow/react')>(), Handle: () => null,
}))
vi.mock('../../../contexts/AuthContext', async (original) => ({
  ...await original<typeof import('../../../contexts/AuthContext')>(),
  useAuth: () => ({ authenticated: false, user: null }),
}))
// Keep the real hover timing and the caller's visibility gate. Only portal
// positioning is outside this receiving test; root owns browser geometry QA.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div data-testid="content-preview">{children}</div> : null,
}))

const FACTOR = 'factor-price'
const GOAL = 'goal-retention'
const factor: Node = {
  id: FACTOR, type: 'factor', position: { x: 0, y: 0 },
  data: { label: 'Monthly price', category: 'controllable', observedState: {
    value: 0.59, raw_value: 59, cap: 100, unit: '£', source: 'user', factor_type: 'currency',
  } },
}
const goal: Node = { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Retain customers' } }
const props = { selected: false, isConnectable: true, dragging: false, zIndex: 0, positionAbsoluteX: 0, positionAbsoluteY: 0 }
const noop = () => {}
function option(id: string, label: string, setting: unknown, extra = {}): Node {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: {
    label, interventions: { [FACTOR]: setting }, ...extra,
  } }
}
function seed(nodes: Node[], extra: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    nodes, edges: [], results: { status: 'idle', report: null },
    ceeAnalysisReady: null, goalConstraints: [], goalThreshold: null,
    hoveredOptionId: null, selectedNodeId: null, viewMode: 'standard',
    highlightedNodes: new Set(), dimmedNodeIds: new Set(), ...extra,
  } as Partial<ReturnType<typeof useCanvasStore.getState>>)
}
async function hover(title: string) {
  fireEvent.mouseEnter(screen.getByText(title))
  await waitFor(() => expect(screen.getByTestId('content-preview')).toBeDefined())
  return within(screen.getByTestId('content-preview'))
}

describe('factor and goal content reaches the actual node and inspector', () => {
  beforeEach(() => seed([factor, goal]))

  it('a baseline with a different setting retains its value; hover and inspector agree on its scale', async () => {
    seed([factor, option('option-reference', 'Keep existing contracts', { value: 0.49, source: 'brief' }, { is_baseline: true })])
    const card = render(<ReactFlowProvider><FactorNode {...props} id={FACTOR} type="factor" data={factor.data} /></ReactFlowProvider>)
    const preview = await hover('Monthly price')
    expect(preview.getByText('£59')).toBeDefined()
    expect(preview.getByText('£49')).toBeDefined()
    expect(preview.queryByText(/no change/i)).toBeNull()
    card.unmount()
    render(<FactorControllablePanel nodeId={FACTOR} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText('£49')).toBeDefined()
    expect(screen.queryByText('£0.49')).toBeNull()
  })

  it('long labels are retained and the clicked option, not the factor, is selected', async () => {
    const label = 'Retain existing customers on their current monthly price while new contracts use the revised price'
    seed([factor, option('option-long', label, 0.49)])
    render(<ReactFlowProvider><FactorNode {...props} id={FACTOR} type="factor" data={factor.data} /></ReactFlowProvider>)
    const preview = await hover('Monthly price')
    fireEvent.click(preview.getByRole('button', { name: label }))
    expect(useCanvasStore.getState().selectedNodeId).toBe('option-long')
  })

  it('overflow opens the factor inspector and the omitted option is present there even without an edge', async () => {
    seed([factor, ...Array.from({ length: 5 }, (_, i) => option(`option-${i}`, `Approach ${i + 1}`, 0.4 + i / 10))])
    const card = render(<ReactFlowProvider><FactorNode {...props} id={FACTOR} type="factor" data={factor.data} /></ReactFlowProvider>)
    const preview = await hover('Monthly price')
    expect(preview.queryByText('Approach 5')).toBeNull()
    fireEvent.click(preview.getByRole('button', { name: '+1 more in inspector' }))
    expect(useCanvasStore.getState().selectedNodeId).toBe(FACTOR)
    card.unmount()
    render(<FactorControllablePanel nodeId={FACTOR} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText('Approach 5')).toBeDefined()
  })

  it('qualitative text and missing settings survive as distinct rows', async () => {
    seed([factor,
      option('option-text', 'Review pricing', { value: 'Keep legacy contracts unchanged' }),
      option('option-null', 'Still framing', null),
      option('option-absent', 'Explore demand', undefined, { interventions: {} }),
    ])
    render(<ReactFlowProvider><FactorNode {...props} id={FACTOR} type="factor" data={factor.data} /></ReactFlowProvider>)
    const preview = await hover('Monthly price')
    expect(preview.getByText('Keep legacy contracts unchanged')).toBeDefined()
    expect(preview.getByText('Value not specified')).toBeDefined()
    expect(preview.getByText('No setting recorded')).toBeDefined()
    expect(preview.queryByText('£0')).toBeNull()
  })

  it('the canonical option carrier is used in both views, including zero and authored display text', async () => {
    seed([factor, option('option-cee', 'Pilot', 0.9)], {
      ceeAnalysisReady: { options: [{ id: 'option-cee', interventions: {
        [FACTOR]: { value: 0, display_value: 'Free pilot' },
      } }] },
    })
    const card = render(<ReactFlowProvider><FactorNode {...props} id={FACTOR} type="factor" data={factor.data} /></ReactFlowProvider>)
    const preview = await hover('Monthly price')
    expect(preview.getByText('Free pilot')).toBeDefined()
    card.unmount()
    render(<FactorControllablePanel nodeId={FACTOR} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText('Free pilot')).toBeDefined()
    expect(screen.queryByText('£90')).toBeNull()
  })

  it('a goal without a target exposes the recorded constraint before analysis, matching its inspector', async () => {
    seed([factor, goal], { goalConstraints: [{
      constraint_id: 'limit-price', node_id: FACTOR, operator: '<=', value: 49, unit: '£',
      source_quote: 'Keep the monthly price at or below £49',
    }] })
    const card = render(<ReactFlowProvider><GoalNode {...props} id={GOAL} type="goal" data={goal.data} /></ReactFlowProvider>)
    const preview = await hover('Retain customers')
    expect(preview.getByText('Monthly price ≤ £49')).toBeDefined()
    expect(preview.queryByText(/probability/)).toBeNull()
    card.unmount()
    render(<GoalPanel nodeId={GOAL} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText('Monthly price ≤ £49')).toBeDefined()
    expect(screen.getByText(/Keep the monthly price at or below £49/)).toBeDefined()
  })

  it('constraint units and absent bounds are preserved without borrowing another factor name', async () => {
    seed([factor, goal], { goalConstraints: [
      { constraint_id: 'limit-time', label: 'Trial duration', operator: '<=', value: 6, unit: 'weeks' },
      { constraint_id: 'limit-unknown', node_id: 'missing-factor', operator: '<=' },
    ] })
    render(<ReactFlowProvider><GoalNode {...props} id={GOAL} type="goal" data={goal.data} /></ReactFlowProvider>)
    const preview = await hover('Retain customers')
    expect(preview.getByText('Trial duration ≤ 6 weeks')).toBeDefined()
    expect(preview.getByText('Constraint · limit not captured')).toBeDefined()
    expect(preview.queryByText(/undefined|Monthly price/)).toBeNull()
  })
})
