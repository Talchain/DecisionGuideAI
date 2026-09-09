import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const candidate = {
  id: 'candidate', type: 'option', position: { x: 0, y: 0 },
  data: { label: 'Try a smaller pilot', type: 'option' },
}
const fresh = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-09T00:00:00.000Z',
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null },
  } as never)
})

describe('option results follow the composed freshness authority', () => {
  it('keeps the result while distinguishing edited, unknown and current states', () => {
    useCanvasStore.setState({
      nodes: [candidate, { ...candidate, id: 'alternative' }], edges: [], ceeAnalysisReady: null, viewMode: 'standard',
      analysisStateV1: null, analysisFreshness: fresh, analysisFreshnessDirty: false,
      importPendingServerRegistration: false, currentScenarioId: 'currency-scenario',
      v5AnalysisFact: {
        scenarioId: 'currency-scenario', analysisHash: 'last-run', hasRunAnalysisFact: true,
      },
      // A completed run sets BOTH in production (`stores/resultsStore.ts:168`,
      // `store.ts:4791/5250/5321`). Writing the slice directly reproduced only
      // half of it, so this fixture named a completed run without being one.
      hasCompletedFirstRun: true,
      results: { status: 'complete', hash: 'last-run', report: {
        option_probabilities: {
          candidate: { status: 'computed', win_probability: 0.72 },
          alternative: { status: 'computed', win_probability: 0.28 },
        },
        robustness: { near_tie: { is_tie: false, top_option_id: 'candidate' } },
      } },
    } as never)
    render(<ReactFlowProvider><OptionNode
      id={candidate.id} type="option" data={candidate.data} selected={false}
      isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable
    /></ReactFlowProvider>)

    expect(screen.getByTestId('option-win-readout-candidate')).toHaveTextContent('72%')
    expect(screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label'))
      .not.toContain('Last analysis:')
    expect(screen.getByTestId('leading-option-pill-candidate')).toHaveTextContent(/^Most supported$/)

    // A local edit supersedes the prior fresh verdict. This is the same real
    // store transition consumed by the panels, with no node-local hash.
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label'))
      .toContain('Model changed since this analysis. Last analysis:')
    expect(screen.getByTestId('leading-option-pill-candidate')).toHaveTextContent('Last run · Most supported')
    expect(screen.getByTestId('option-win-readout-candidate')).toHaveTextContent('72%')

    act(() => useCanvasStore.setState({
      analysisFreshnessDirty: false,
      analysisFreshness: { ...fresh, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    } as never))
    expect(screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label'))
      .toContain('Analysis may be out of date. Last analysis:')
    expect(screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label'))
      .not.toContain('Model changed')
    expect(screen.getByTestId('leading-option-pill-candidate')).toHaveTextContent('Last run · Most supported')
    expect(screen.getByTestId('option-win-readout-candidate')).toHaveTextContent('72%')

    act(() => useCanvasStore.setState({ analysisFreshness: fresh } as never))
    expect(screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label'))
      .not.toContain('Last analysis:')
    expect(screen.getByTestId('leading-option-pill-candidate')).toHaveTextContent(/^Most supported$/)
    expect(screen.getByTestId('option-win-readout-candidate')).toHaveTextContent('72%')

    // An unanalysed draft must not acquire a warning about earlier results.
    act(() => useCanvasStore.setState({
      results: { status: 'idle', report: null }, analysisFreshnessDirty: true,
    } as never))
    expect(screen.queryByTestId('option-analysis-currency-candidate')).toBeNull()
    expect(screen.queryByTestId('option-win-readout-candidate')).toBeNull()
  })
})
