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

/**
 * ED #63 5799353114 decision 1 ("Drop 'Most supported'. It reads as a
 * recommendation."): in EVERY currency state the leader card carries no pill —
 * neither the bare one nor the `Last run ·` one. Called only AFTER the same
 * render's `option-win-anchor` / `option-win-readout` assertions, which are its
 * contrast control: the result row is on screen, the leader claim is not.
 */
function expectNoLeaderPill(container: HTMLElement) {
  expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe('72% of runs')
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
      results: { status: 'complete', hash: 'last-run', report: {
        option_probabilities: {
          candidate: { status: 'computed', win_probability: 0.72 },
          alternative: { status: 'computed', win_probability: 0.28 },
        },
        robustness: { near_tie: { is_tie: false, top_option_id: 'candidate' } },
      } },
    } as never)
    const { container } = render(<ReactFlowProvider><OptionNode
      id={candidate.id} type="option" data={candidate.data} selected={false}
      isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable
    /></ReactFlowProvider>)

    // Locked Canvas design (23 Sep 2026; ED 11:52Z point 4): the result is
    // model-relative and never "Support" — the row's caption follows the run's
    // currency (`option-win-anchor`: 'Current model' | 'Last run' | 'Model
    // result') and the readout reads "N% of runs". The accessible name leads
    // with the same caption, then OPTION_RESULT_COPY's sentence and note.
    const anchor = () => screen.getByTestId('option-win-anchor-candidate').textContent
    const label = () => screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label') ?? ''
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe('72% of runs')
    expect(anchor()).toBe('Current model')
    expect(label()).toMatch(/^Current model · 72% of runs\. /)
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
    expect(label()).toMatch(/^Last run · 72% of runs\. /)
    expect(label()).toContain('The model has changed since this run.')
    // WAS `Last run · Most supported`: the `Last run` caption survives on the
    // result row (asserted above); the pill it used to prefix does not.
    expectNoLeaderPill(container)
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe('72% of runs')

    act(() => useCanvasStore.setState({
      analysisFreshnessDirty: false,
      analysisFreshness: { ...fresh, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    } as never))
    // Locked Canvas design (23 Sep 2026): currency that CANNOT be confirmed
    // reads 'Model result' — it claims neither current nor a later model, and
    // must not manufacture a last-run claim (ED 02:31Z). (The leading pill that
    // used to lose its "Last run ·" prefix here is retired altogether.)
    expect(anchor()).toBe('Model result')
    expect(label()).toMatch(/^Model result · 72% of runs\. /)
    expect(label()).toContain('Olumi can’t confirm this run reflects the current model.')
    expect(label()).not.toContain('The model has changed')
    expect(label()).not.toContain('Last run')
    expectNoLeaderPill(container)
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe('72% of runs')

    act(() => useCanvasStore.setState({ analysisFreshness: fresh } as never))
    expect(anchor()).toBe('Current model')
    expect(label()).toMatch(/^Current model · 72% of runs\. /)
    expect(label()).not.toContain('Last run')
    expectNoLeaderPill(container)
    expect(screen.getByTestId('option-win-readout-candidate').textContent).toBe('72% of runs')

    // An unanalysed draft must not acquire a warning about earlier results.
    act(() => useCanvasStore.setState({
      results: { status: 'idle', report: null }, analysisFreshnessDirty: true,
    } as never))
    expect(screen.queryByTestId('option-analysis-currency-candidate')).toBeNull()
    expect(screen.queryByTestId('option-win-readout-candidate')).toBeNull()
  })
})
