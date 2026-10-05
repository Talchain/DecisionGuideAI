/**
 * ⛔ GATE 2 CONSUMER, the MOUNTED announcer (Codex #2494 P2): the pure rule is pinned in
 * `canvas/state/__tests__/analysisState.figuresWithheldIsNotAFailure.spec.tsx`; this pins the STORE READ that feeds it.
 * The real component renders against a mocked store, so a mutant that drops `figuresWithheld` from the announcer's
 * call REDs here. Pattern: `analysisRunAnnouncer.emptyResult.spec.tsx`.
 *
 * SCOPE: jsdom text on the live region. It proves the announced STRING, not audibility or timing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisRunAnnouncer } from '../AnalysisRunAnnouncer'
import {
  RUN_FINISHED_FIGURES_WITHHELD_COPY,
  RUN_FINISHED_WITHOUT_RESULT_COPY,
  RUN_ENDED_WITHOUT_NEW_RESULTS_COPY,
} from '../analysisRunStatus'

/** Nothing renderable, and the producer says why with a typed code. */
const WITHHELD = {
  option_comparison: [{ id: 'a', win_probability: null }],
  inference_warnings: [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', node_ids: ['goal'], message: 'Not shown. Your target can’t be tested yet.' }],
}
/** The same report without the code: the engine's "I failed" shape. */
const EMPTY = { option_comparison: [{ id: 'a', win_probability: null }] }

let isRunningMock = false
vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ isRunning: isRunningMock }),
}))

let storeState: Record<string, unknown> = {}
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))

/** A real running → settled transition; returns the announced text and unmounts. */
const announceOnSettle = (report: unknown, settledWithoutNewReport = false): string => {
  isRunningMock = true
  storeState = { results: { status: 'streaming', report: settledWithoutNewReport ? report : null, settledWithoutNewReport: false } }
  const view = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
  isRunningMock = false
  storeState = { results: { status: 'complete', report, settledWithoutNewReport } }
  view.rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
  const text = screen.getByTestId('analysis-run-announcer').textContent ?? ''
  view.unmount()
  return text
}

describe('AnalysisRunAnnouncer — the typed withhold reaches the announcement', () => {
  beforeEach(() => { vi.clearAllMocks(); isRunningMock = false })

  it('RED: a completed Run that withheld its figures announces "Analysis finished: figures not shown yet."', () => {
    expect(announceOnSettle(WITHHELD)).toBe(RUN_FINISHED_FIGURES_WITHHELD_COPY)
  })

  it('CONTROL: the same Run without the code announces the failure copy, as before', () => {
    expect(announceOnSettle(EMPTY)).toBe(RUN_FINISHED_WITHOUT_RESULT_COPY)
  })

  it('CONTROL: a settle that restored the earlier withheld report keeps its own copy', () => {
    expect(announceOnSettle(WITHHELD, true)).toBe(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY)
  })
})
