import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'

vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const sendChip = vi.fn()
const panelProps = { edgeId: 'link-1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

function seed(magnitude: string | undefined, onPath = true, naturalEffect = true, source = 'cee_hypothesis') {
  const mapped = mapDraftEdgeToCanvas({
    id: 'link-1', from: 'factor-a', to: 'factor-b',
    strength: { mean: 0.4, std: 0.1 }, effect_direction: 'positive',
    provenance: { source, ...(magnitude ? { magnitude } : {}), ...(naturalEffect ? { natural_effect: {
      amount: 3, amount_unit: '£/month', per_source_change: 1, per_source_change_unit: 'customers',
      strength_mean: 0.4, strength_mean_frame: 'edge_strength',
    } } : {}) },
  }, 0)
  useCanvasStore.setState({
    nodes: [
      { id: 'factor-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Demand' } },
      { id: 'factor-b', type: 'factor', position: { x: 0, y: 100 }, data: { label: 'Sales' } },
      { id: 'goal', type: 'goal', position: { x: 0, y: 200 }, data: { label: 'Margin' } },
    ],
    edges: [mapped, ...(onPath ? [{ id: 'link-2', source: 'factor-b', target: 'goal', data: {} }] : [])],
    ceeAnalysisReady: { goal_node_id: 'goal', options: [] },
    results: { status: 'none', report: null },
    analysisStateV1: null, analysisFreshness: null,
  } as never)
  return mapped
}

beforeEach(() => {
  localStorage.setItem('feature.questionAssumption', '1')
  useGuidanceStore.setState({ guidanceItems: [], _sendChip: sendChip })
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
})

describe('Question this assumption in the existing link inspector', () => {
  it.each(['olumi_estimate', 'olumi_placeholder'])('offers the typed press on a goal-path %s', magnitude => {
    const mapped = seed(magnitude)
    // Exercise real ingestion, rather than an invented raw provenance slot on a Canvas edge.
    if (magnitude === 'olumi_estimate') expect(mapped.data.naturalEffect.author).toBe('olumi_estimate')
    else expect(mapped.data.strengthPlaceholder).toBe(0.4)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Question this assumption' }))
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(
      'Question this assumption', 'Question this assumption',
      { id: 'agent-question-assumption:factor-a>factor-b' },
    )
  })

  it.each(['user_stated', 'unknown', undefined])('hides a link whose magnitude provenance is %s', magnitude => {
    seed(magnitude)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('hides an Olumi estimate outside the goal path', () => {
    seed('olumi_estimate', false)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })

  it('uses the canonical goal rather than another goal node', () => {
    seed('olumi_estimate')
    useCanvasStore.setState({ ceeAnalysisReady: { goal_node_id: 'other-goal', options: [] } } as never)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })

  it('keeps a known placeholder eligible without a natural effect', () => {
    seed('olumi_placeholder', true, false)
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByRole('button', { name: 'Question this assumption' })).toBeInTheDocument()
  })

  it('hides unknown magnitude authorship when ingestion retained no author', () => {
    seed('olumi_estimate', true, false)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })

  it('withdraws the action after the person states the strength', () => {
    seed('olumi_estimate')
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByRole('button', { name: 'Question this assumption' })).toBeInTheDocument()
    act(() => useCanvasStore.setState(s => ({
      edges: s.edges.map(e => e.id === 'link-1' ? { ...e, data: { ...e.data, weightSource: 'user' } } : e),
    } as never)))
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })

  it('hides user-specified strength even with an old estimate magnitude label', () => {
    seed('olumi_estimate', true, true, 'user_specified')
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })

  it('hides the action when no conversation sender is registered', () => {
    seed('olumi_estimate')
    useGuidanceStore.setState({ _sendChip: null })
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })
})


describe('Question this assumption stays dark until its service turn is served', () => {
  it('hides the press on an eligible link while the switch is off', () => {
    localStorage.removeItem('feature.questionAssumption')
    seed('olumi_estimate')
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByRole('button', { name: 'Question this assumption' })).not.toBeInTheDocument()
  })
})
