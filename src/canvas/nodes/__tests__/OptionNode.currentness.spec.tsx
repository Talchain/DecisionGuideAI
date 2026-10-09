import { installCanonicalFixtureState } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { withLicensedOptionChances, fixtureChanceText } from './__helpers__/optionChanceFixture'

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
const CHANCE = fixtureChanceText(CHANCE_REPORT, 'candidate', { candidate: candidate.data.label, alternative: candidate.data.label })!
const fresh = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-09T00:00:00.000Z',
}

/**
 * ED #63 5799353114 decision 1 ("Drop 'Most supported'. It reads as a
 * recommendation."): in EVERY currency state the leader card carries no pill —
 * neither the bare one nor the `Last run ·` one. Called only AFTER the same
 * render's `option-win-anchor` / `option-win-readout` assertions, which are its
 * contrast control: the result row is on screen, the leader claim is not.
 */
function expectNoLeaderPill(container: HTMLElement) {
  expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe(CHANCE)
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
      results: { status: 'complete', hash: 'last-run', report: CHANCE_REPORT },
      goalThreshold: 100,
    } as never)
    useCanvasStore.setState(installCanonicalFixtureState(useCanvasStore.getState()) as never)
    const { container } = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode
      id={candidate.id} type="option" data={candidate.data} selected={false}
      isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable
    /></OptionChanceCellProvider></ReactFlowProvider>)

    // WS5-1: the Results chance replaces the runs share while the same currency caption tracks model edits.
    const anchor = () => screen.getByTestId('option-win-anchor-candidate').getAttribute('aria-label') ?? screen.getByTestId('option-win-anchor-candidate').textContent
    const label = () => screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label') ?? ''
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe(CHANCE)
    expect(anchor()).toBe('Current model')
    expect(label()).toContain(`Current model · ${CHANCE}`)
    expect(label()).not.toContain('of runs')
    expect(label()).not.toContain('The model has changed since this run.')
    expect(label()).not.toContain('can’t confirm')
    // The producer's claim names THIS card and nothing withholds it — the
    // strongest case for the retired pill (ED #63 5799353114 decision 1).
    expectNoLeaderPill(container)

    // A local edit supersedes the prior fresh verdict. This is the same real
    // store transition consumed by the panels, with no node-local hash.
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    // Locked Canvas design (23 Sep 2026): KNOWN changed → 'Last run' (ED 02:31Z Q2).
    expect(anchor()).toBe('Last run')
    expect(label()).toContain(`Last run · ${CHANCE}`)
    expect(label()).toContain('The model has changed since this run.')
    // WAS `Last run · Most supported`: the `Last run` caption survives on the
    // result row (asserted above); the pill it used to prefix does not.
    expectNoLeaderPill(container)
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe(CHANCE)

    act(() => useCanvasStore.setState({
      analysisFreshnessDirty: false,
      analysisFreshness: { ...fresh, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    } as never))
    // Locked Canvas design (23 Sep 2026): currency that CANNOT be confirmed
    // reads 'Model result' — it claims neither current nor a later model, and
    // must not manufacture a last-run claim (ED 02:31Z). (The leading pill that
    // used to lose its "Last run ·" prefix here is retired altogether.)
    expect(anchor()).toBe('Model result')
    expect(label()).toContain(`Model result · ${CHANCE}`)
    expect(label()).toContain('Olumi can’t confirm this run reflects the current model.')
    expect(label()).not.toContain('The model has changed')
    expect(label()).not.toContain('Last run')
    expectNoLeaderPill(container)
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe(CHANCE)

    act(() => useCanvasStore.setState({ analysisFreshness: fresh } as never))
    expect(anchor()).toBe('Current model')
    expect(label()).toContain(`Current model · ${CHANCE}`)
    expect(label()).not.toContain('Last run')
    expectNoLeaderPill(container)
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe(CHANCE)

    // An unanalysed draft must not acquire a warning about earlier results.
    act(() => useCanvasStore.setState({
      results: { status: 'idle', report: null }, analysisFreshnessDirty: true,
    } as never))
    expect(screen.queryByTestId('option-analysis-currency-candidate')).toBeNull()
    expect(screen.queryByTestId('option-win-readout-candidate')).toBeNull()
  })
})
