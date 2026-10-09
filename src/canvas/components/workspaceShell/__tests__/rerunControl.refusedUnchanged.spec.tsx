/**
 * A refused Run whose model has not changed offers no Re-analyse (DL 8 Oct, OC1 probe).
 *
 * Served 845f66a4 (EDIT-UX witness W2685): after "Yes, that's how", two Re-analyse presses were both refused with
 * "One of the totals in your model can't be worked out exactly…", and the bar kept offering the press. CEE marks that
 * refusal (`cause_kind: 'analysis_blocked'`) `retryable: false`: a bare re-run of the same model reproduces it. So:
 *   refused + unchanged → no Re-analyse (and no composer icon either), the refusal's next step in its place;
 *   refused + an edit (the server graph moved) → Re-analyse is back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act } from '@testing-library/react'
import { refusalHoldsRerun, reanalyseBarShows, shellRerunControl } from '../rerunControl'
import { useCanvasStore } from '../../../store'

vi.mock('../../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: () => ({ semantic: 'changed' }) }))

const BLOCKED = { blockedReason: 'analysis_blocked', computedAt: null }

describe('refusalHoldsRerun', () => {
  it('analysis_blocked, same server graph → holds', () => {
    expect(refusalHoldsRerun({ ...BLOCKED, graphHashAtRefusal: 'h1' }, 'h1')).toBe(true)
  })
  it('CONTRAST: the server graph moved since (an edit) → does not hold', () => {
    expect(refusalHoldsRerun({ ...BLOCKED, graphHashAtRefusal: 'h1' }, 'h2')).toBe(false)
  })
  it('CONTRAST: a refusal a re-run can clear (engine busy) → does not hold, same graph', () => {
    expect(refusalHoldsRerun({ blockedReason: 'analysis_engine_busy', computedAt: null, graphHashAtRefusal: 'h1' }, 'h1')).toBe(false)
  })
  it('fail-open: no notice, or no hash on either side → does not hold', () => {
    expect(refusalHoldsRerun(null, 'h1')).toBe(false)
    expect(refusalHoldsRerun({ ...BLOCKED, graphHashAtRefusal: null }, null)).toBe(false)
    expect(refusalHoldsRerun({ ...BLOCKED }, 'h1')).toBe(false)
  })
})

describe('the shell offers no rerun while the refusal holds', () => {
  const changedAfterRun = { semantic: 'changed' as const, importHold: false, hasRunOnRecord: true }
  it('the bar does not show; contrast: without the hold it does', () => {
    expect(reanalyseBarShows({ ...changedAfterRun, refusedUnchanged: true })).toBe(false)
    expect(reanalyseBarShows({ ...changedAfterRun, refusedUnchanged: false })).toBe(true)
  })
  it('no control at all (not the composer icon); contrast: the bar', () => {
    expect(shellRerunControl({ ...changedAfterRun, refusedUnchanged: true })).toBe('none')
    expect(shellRerunControl({ ...changedAfterRun, refusedUnchanged: false })).toBe('bar')
    expect(shellRerunControl({ ...changedAfterRun, semantic: 'current', refusedUnchanged: true })).toBe('none')
  })
})

describe('the store stamps the refused graph', () => {
  beforeEach(() => { useCanvasStore.setState({ analysisRefusalNotice: null, lastServerGraphHash: 'h1' } as never) })
  it('setAnalysisRefusalNotice records lastServerGraphHash as graphHashAtRefusal', () => {
    useCanvasStore.getState().setAnalysisRefusalNotice(BLOCKED)
    expect(useCanvasStore.getState().analysisRefusalNotice?.graphHashAtRefusal).toBe('h1')
  })
  it('clearing stays a clear', () => {
    useCanvasStore.getState().setAnalysisRefusalNotice(BLOCKED)
    useCanvasStore.getState().setAnalysisRefusalNotice(null)
    expect(useCanvasStore.getState().analysisRefusalNotice).toBeNull()
  })
})

describe('ReanalyseBar, mounted: refused + unchanged → no press; refused + an edit → press back', () => {
  beforeEach(() => {
    useCanvasStore.setState({ hasCompletedFirstRun: true, analysisStateV1: null, importPendingServerRegistration: false,
      lastServerGraphHash: 'h1', analysisRefusalNotice: null } as never)
  })
  it('walks the two rows on one mounted bar', async () => {
    const { ReanalyseBar } = await import('../../model-tab/ReanalyseBar')
    render(<ReanalyseBar onReanalyse={() => {}} canRun blockedReason={undefined} isAnalysing={false} />)
    // Positive control: before the refusal, the changed model offers Re-analyse.
    expect(screen.getByTestId('reanalyse-button')).toBeInTheDocument()

    act(() => { useCanvasStore.getState().setAnalysisRefusalNotice(BLOCKED) })
    expect(screen.queryByTestId('reanalyse-button')).toBeNull()
    expect(screen.getByTestId('reanalyse-bar-refused')).toHaveTextContent("The assistant's reply explains the next step.")

    // The user edits the model: CEE acknowledges a new graph.
    act(() => { useCanvasStore.setState({ lastServerGraphHash: 'h2' } as never) })
    expect(screen.getByTestId('reanalyse-button')).toBeInTheDocument()
    expect(screen.queryByTestId('reanalyse-bar-refused')).toBeNull()
  })
})
