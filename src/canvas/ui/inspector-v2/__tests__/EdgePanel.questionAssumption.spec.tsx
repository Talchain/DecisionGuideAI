import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import { requestAsk } from '../askSemantic'

vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))
vi.mock('../askSemantic', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestAsk: vi.fn(() => 'sent'),
}))

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
  vi.clearAllMocks()
  localStorage.setItem('feature.questionAssumption', '1')
  useGuidanceStore.setState({ guidanceItems: [], _sendChip: sendChip, _dispatchAction: vi.fn() })
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
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(
      'Question this assumption', 'Question this assumption',
      { id: 'agent-question-assumption:factor-a>factor-b' },
    )
  })

  it.each(['user_stated', 'unknown', undefined])('does not send an assumption press for magnitude provenance %s', magnitude => {
    seed(magnitude)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })

  it('does not send an assumption press outside the goal path', () => {
    seed('olumi_estimate', false)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })

  it('uses the canonical goal rather than another goal node', () => {
    seed('olumi_estimate')
    useCanvasStore.setState({ ceeAnalysisReady: { goal_node_id: 'other-goal', options: [] } } as never)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })

  it('keeps a known placeholder eligible without a natural effect', () => {
    seed('olumi_placeholder', true, false)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).toHaveBeenCalledWith(
      'Question this assumption', 'Question this assumption',
      { id: 'agent-question-assumption:factor-a>factor-b' },
    )
  })

  it('does not send an assumption press when ingestion retained no author', () => {
    seed('olumi_estimate', true, false)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })

  it('withdraws the action after the person states the strength', () => {
    seed('olumi_estimate')
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(requestAsk).not.toHaveBeenCalled()
    sendChip.mockClear()
    act(() => useCanvasStore.setState(s => ({
      edges: s.edges.map(e => e.id === 'link-1' ? { ...e, data: { ...e.data, weightSource: 'user' } } : e),
    } as never)))
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })

  it('does not send an assumption press for user-specified strength with an old estimate label', () => {
    seed('olumi_estimate', true, true, 'user_specified')
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })

  it('does not send an assumption press when the science sender is unregistered', () => {
    seed('olumi_estimate')
    useGuidanceStore.setState({ _sendChip: null })
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })
})


describe('Question this assumption can be switched off', () => {
  it('does not send the assumption press on an eligible link while the switch is off', () => {
    localStorage.setItem('feature.questionAssumption', '0')
    seed('olumi_estimate')
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(sendChip).not.toHaveBeenCalled()
    expect(requestAsk).toHaveBeenCalledTimes(1)
  })
})
