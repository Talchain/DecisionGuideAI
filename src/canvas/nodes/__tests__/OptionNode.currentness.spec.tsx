import { installCanonicalFixtureState } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { withLicensedOptionChances } from './__helpers__/optionChanceFixture'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const candidate = {
  id: 'candidate', type: 'option', position: { x: 0, y: 0 },
  data: { label: 'Try a smaller pilot', type: 'option', kind: 'option' },
}
const CHANCE_REPORT = withLicensedOptionChances({
  option_probabilities: {
    candidate: { status: 'computed', win_probability: 0.72 },
    alternative: { status: 'computed', win_probability: 0.28 },
  },
  robustness: { near_tie: { is_tie: false, top_option_id: 'candidate' } },
}, { candidate: 41, alternative: 29 })
const fresh = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-09T00:00:00.000Z',
}

/**
 * ED #63 5799353114 decision 1 ("Drop 'Most supported'. It reads as a
 * recommendation."): in EVERY currency state the leader card carries no pill —
 * neither the bare one nor the `Last run ·` one. Its same-render contrast
 * control is the card's own title: the card is on screen, the leader claim is not.
 */
function expectNoLeaderPill(container: HTMLElement) {
  // #2747 re-scope 2 (U0): WAS the chance readout as the contrast control; the canvas card shows no chance in C.
  expect(screen.getByTestId('node-title')).toHaveTextContent('Try a smaller pilot')
  expect(screen.queryByTestId('leading-option-pill-candidate')).toBeNull()
  expect(screen.queryByTestId('leading-option-robustness-candidate')).toBeNull()
  expect(container.textContent ?? '').not.toMatch(/most supported/i)
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null },
  } as never)
})

describe('option results follow the composed freshness authority', () => {
  // #2747 re-scope 2 (U0): the row's chance assertions (the readout, the `Current model` / `Last run` / `Model result`
  // caption and the currency row's accessible name in each state) are deleted — the canvas card shows no chance in C. The
  // no-leader-pill negatives in every currency state, and the unanalysed-draft negatives, stay.
  it('carries no leader pill through edited, unknown and current states', () => {
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
      results: { status: 'complete', hash: 'last-run', report: CHANCE_REPORT },
      goalThreshold: 100,
    } as never)
    useCanvasStore.setState(installCanonicalFixtureState(useCanvasStore.getState()) as never)
    const { container } = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode
      id={candidate.id} type="option" data={candidate.data} selected={false}
      isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable
    /></OptionChanceCellProvider></ReactFlowProvider>)

    // The producer's claim names THIS card and nothing withholds it — the
    // strongest case for the retired pill (ED #63 5799353114 decision 1).
    expectNoLeaderPill(container)

    // A local edit supersedes the prior fresh verdict. This is the same real
    // store transition consumed by the panels, with no node-local hash.
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    // WAS `Last run · Most supported`: the pill it used to prefix does not survive.
    expectNoLeaderPill(container)

    act(() => useCanvasStore.setState({
      analysisFreshnessDirty: false,
      analysisFreshness: { ...fresh, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    } as never))
    // (The leading pill that used to lose its "Last run ·" prefix here is retired altogether.)
    expectNoLeaderPill(container)

    act(() => useCanvasStore.setState({ analysisFreshness: fresh } as never))
    expectNoLeaderPill(container)

    // An unanalysed draft must not acquire a warning about earlier results.
    act(() => useCanvasStore.setState({
      results: { status: 'idle', report: null }, analysisFreshnessDirty: true,
    } as never))
    expect(screen.queryByTestId('option-analysis-currency-candidate')).toBeNull()
    expect(screen.queryByTestId('option-win-readout-candidate')).toBeNull()
  })
})
