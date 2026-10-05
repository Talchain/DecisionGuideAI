/**
 * ⛔ GATE 2 CONSUMER, the REAL store (Codex #2494 P1): a Run that settles with no new report keeps the EARLIER Run's
 * report. That report's typed withhold is not this Run's: the headline must stay "finished without a result", with
 * its Rerun, and never say the figures were withheld. Driven through the store's own transitions, not a mock shape.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../store'
import { selectRunWithholdsFigures } from '../../ui/inspector-v2/useAnalysisResults'

const WITHHELD = {
  option_comparison: [{ id: 'opt-a', win_probability: null }],
  inference_warnings: [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', node_ids: ['goal'], message: 'Not shown. Your target can’t be tested yet.' }],
}

const seedCompletedWithheldRun = () => {
  useCanvasStore.setState((s) => ({
    results: { ...s.results, status: 'complete', progress: 100, report: WITHHELD as never, hash: 'hash-1' },
    analysisStateReady: true,
  }))
}

describe('selectRunWithholdsFigures over the store’s own transitions', () => {
  beforeEach(() => {
    useCanvasStore.getState().resultsReset()
  })

  it('CONTROL: the completed Run that delivered the withheld report → withheld', () => {
    seedCompletedWithheldRun()
    expect(selectRunWithholdsFigures(useCanvasStore.getState())).toBe(true)
  })

  it('RED: a rerun in flight, then a resultless settle → the earlier report is kept and is NOT this Run’s withhold', () => {
    seedCompletedWithheldRun()
    useCanvasStore.getState().resultsAnalysing()
    expect(useCanvasStore.getState().results.status).toBe('preparing')
    expect(selectRunWithholdsFigures(useCanvasStore.getState())).toBe(false)
    useCanvasStore.getState().resultsSettle()
    const s = useCanvasStore.getState()
    expect(s.results.status).toBe('complete')
    expect(s.results.settledWithoutNewReport).toBe(true)
    expect(s.results.report).toBe(WITHHELD) // the same object, retained
    expect(selectRunWithholdsFigures(s)).toBe(false)
  })

  it('RED: a rerun that fails with the earlier report retained → not withheld', () => {
    seedCompletedWithheldRun()
    useCanvasStore.getState().resultsAnalysing()
    useCanvasStore.getState().resultsError({ code: 'SERVER_ERROR', message: 'boom' } as never)
    const s = useCanvasStore.getState()
    expect(s.results.status).toBe('error')
    expect(s.results.report).toBe(WITHHELD)
    expect(selectRunWithholdsFigures(s)).toBe(false)
  })
})
