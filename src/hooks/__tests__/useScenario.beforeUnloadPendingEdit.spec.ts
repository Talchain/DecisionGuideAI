/**
 * The navigate-away guard must also fire for an UNSENT inspector edit
 * (ROADMAP 1.346, delta-review F3).
 *
 * THE GAP THIS PINS. The guard used to test `saveStatus === 'saving' || isDirty`
 * only. Autosave clears `isDirty` as soon as the CANVAS is persisted, which
 * happens well before the turn carrying that edit reaches CEE — and an edit
 * queued behind the conversation's in-flight lock lives in an in-memory buffer
 * that dies with the tab. So the old predicate waved the user off with a model
 * change that was saved locally, never sent, and about to be lost outright.
 *
 * The assertion drives the REAL listener rather than matching source text: a
 * string match would pass just as happily against a comment that mentions
 * `pendingEmittedEdits` without using it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, authenticated: false }),
}))
vi.mock('../../services/scenarioService', () => ({
  createScenario: vi.fn(), loadScenario: vi.fn(), deleteScenario: vi.fn(),
  saveGraphViaGatedPath: vi.fn(), saveFraming: vi.fn(), storeAnalysis: vi.fn(),
  storeAnalysisFailure: vi.fn(), storeBrief: vi.fn(), setStage: vi.fn(),
  createSharedBrief: vi.fn(), resetAnalysisStatus: vi.fn(),
  setAnalysisRunning: vi.fn(), saveTitle: vi.fn(),
}))

let storeState: Record<string, unknown> = {}
vi.mock('../../canvas/store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector(storeState),
    {
      getState: () => storeState,
      setState: (partial: Record<string, unknown>) => { storeState = { ...storeState, ...partial } },
      subscribe: () => () => {},
    },
  ),
}))

import { useScenario } from '../useScenario'

/** Drive the real listener; report whether it asked the browser to confirm. */
function wouldWarnOnUnload(): boolean {
  const evt = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(evt)
  return evt.defaultPrevented
}

describe('beforeunload guard — unsent inspector edits (F3)', () => {
  beforeEach(() => {
    storeState = { isDirty: false, pendingEmittedEdits: 0, currentScenarioId: null }
  })

  it('does NOT warn when nothing is pending', () => {
    renderHook(() => useScenario())
    expect(wouldWarnOnUnload()).toBe(false)
  })

  it('WARNS on an undispatched edit even though isDirty is already cleared', () => {
    // The real shape of the gap: autosave has finished (isDirty false) while
    // the wire send is still sitting in the queue.
    storeState = { isDirty: false, pendingEmittedEdits: 1, currentScenarioId: null }
    renderHook(() => useScenario())
    expect(
      wouldWarnOnUnload(),
      'leaving now would discard an edit the server has never seen',
    ).toBe(true)
  })

  it('still warns for the pre-existing reason (unsaved canvas)', () => {
    storeState = { isDirty: true, pendingEmittedEdits: 0, currentScenarioId: null }
    renderHook(() => useScenario())
    expect(wouldWarnOnUnload()).toBe(true)
  })
})
