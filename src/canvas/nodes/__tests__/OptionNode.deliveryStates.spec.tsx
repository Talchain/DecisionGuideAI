import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}
const option = (id: string, data: Record<string, unknown> = {}) => ({
  id, type: 'option', position: { x: 0, y: 0 }, data: { label: id, type: 'option', ...data },
})
const factor = (id: string) => ({
  id, type: 'factor', position: { x: 0, y: 0 },
  data: { label: `Recorded ${id}`, type: 'factor', observedState: { value: 0.2 } },
})

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [], edges: [], ceeAnalysisReady: null,
    results: { status: 'idle', report: null }, viewMode: 'expert',
  } as never)
})
afterEach(cleanup)

function mountOptions(options: ReturnType<typeof option>[]) {
  return render(<ReactFlowProvider>{options.map(node =>
    <OptionNode key={node.id} {...baseProps} id={node.id} data={node.data} />,
  )}</ReactFlowProvider>)
}

describe('option delivery states through the real store and display selector', () => {
  it('distinguishes an absent result, a failed result and measured zero in the same graph', () => {
    const options = ['missing', 'failed', 'zero'].map(id => option(id))
    useCanvasStore.setState({
      nodes: options,
      results: { status: 'complete', report: { option_probabilities: {
        failed: { status: 'failed', win_probability: 0 },
        zero: { status: 'computed', win_probability: 0 },
      } } },
    } as never)
    mountOptions(options)
    expect(screen.getByTestId('option-result-unavailable-missing')).toHaveTextContent('Ranking percentage unavailable')
    expect(screen.queryByTestId('option-win-readout-missing')).toBeNull()
    expect(screen.queryByTestId('option-not-computed-missing')).toBeNull()
    expect(screen.getByTestId('option-not-computed-failed')).toBeInTheDocument()
    expect(screen.queryByTestId('option-result-unavailable-failed')).toBeNull()
    expect(screen.getByTestId('option-win-readout-zero')).toHaveTextContent('0%')
    expect(screen.queryByTestId('option-result-unavailable-zero')).toBeNull()
  })

  it.each([0, 0.5])('does not call a computed outcome with median %s an unavailable result', median => {
    const computed = option('outcome-only')
    useCanvasStore.setState({
      nodes: [computed],
      results: { status: 'complete', report: { option_probabilities: {
        [computed.id]: {
          status: 'computed',
          outcome: { p10: median - 0.2, p50: median, p90: median + 0.2 },
          // The producer can supply a real outcome distribution without a
          // win share. A zero median is valid data, not a failed run.
        },
      } } },
    } as never)
    mountOptions([computed])
    expect(screen.getByTestId('option-result-unavailable-outcome-only'))
      .toHaveTextContent('Ranking percentage unavailable')
    expect(screen.queryByText('Result unavailable', { exact: true })).toBeNull()
    expect(screen.queryByTestId('option-win-readout-outcome-only')).toBeNull()
    expect(screen.queryByTestId('option-not-computed-outcome-only')).toBeNull()
    expect(screen.queryByTestId('leading-option-pill-outcome-only')).toBeNull()
  })

  it('does not call an unanalysed draft a missing result', () => {
    const draft = option('draft')
    useCanvasStore.setState({ nodes: [draft] })
    mountOptions([draft])
    expect(screen.queryByTestId('option-result-unavailable-draft')).toBeNull()
  })

  it('reveals recorded baseline values even when they differ from observed factor values', () => {
    const baseline = option('baseline', { is_baseline: true, interventions: { f1: 0.8 } })
    useCanvasStore.setState({
      nodes: [baseline, factor('f1')],
      ceeAnalysisReady: { options: [{ id: baseline.id, interventions: { f1: 0.8 } }] },
      results: { status: 'complete', report: {} },
    } as never)
    mountOptions([baseline])
    expect(screen.getByText('Baseline factor values:')).toBeInTheDocument()
    expect(screen.getByText(/Recorded f1/i)).toBeInTheDocument()
    expect(screen.queryByText(/No changes to factors/)).toBeNull()
    expect(screen.queryByText(/No changes from current state/)).toBeNull()
  })

  it('offers the inspector when a draft has more values than the preview can show', async () => {
    const interventions = { f1: 0.1, f2: 0.2, f3: 0.3, f4: 0.4, f5: 0.5 }
    const draft = option('draft', { interventions })
    useCanvasStore.setState({
      nodes: [draft, ...Object.keys(interventions).map(factor)],
      ceeAnalysisReady: { options: [{ id: draft.id, interventions }] },
      viewMode: 'standard',
    } as never)
    const { container } = mountOptions([draft])
    fireEvent.mouseEnter(container.firstElementChild!)
    const more = await screen.findByRole('button', { name: '+1 more in inspector' })
    fireEvent.click(more)
    expect(useCanvasStore.getState().selection.nodeIds).toEqual(new Set([draft.id]))
  })
})
