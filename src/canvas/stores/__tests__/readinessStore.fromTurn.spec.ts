/**
 * ⭐ S10/S11 NO GRAPH OUT OF THE BROWSER (DL Q2a-A, 15 Oct 2026): readiness is the TURN's served verdict.
 *
 * Two served `analysis_ready` verdicts, both captured on staging on 14 Oct (UI joined-flow witness, guest):
 * - blocked: the capacity brief's first turn, `needs_user_input`, `may_run: false`, one MISSING_FACTOR_LEVEL issue;
 * - ready: the same brief's first turn on a later CEE, `ready`, `may_run: true`, no issues.
 * The store publishes exactly what CEE said, and nothing is fetched: no request of any kind leaves on an edit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../store'
import { readinessFromTurn, selectOptionExclusionMessage, useReadinessStore, __test__ } from '../readinessStore'
import served from './fixtures/served-turn-analysis-ready-20261014.json'

const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }))

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockClear()
  __test__.resetModuleState()
  useCanvasStore.setState({ ceeAnalysisReady: null } as never)
})
afterEach(() => {
  __test__.resetModuleState()
  vi.unstubAllGlobals()
})

describe('readiness is the turn’s served verdict (served capacity, two turns)', () => {
  it('blocked turn: may_run false, cannot run, and CEE’s own issue sentence verbatim', () => {
    const r = readinessFromTurn(served.blocked.analysis_ready)!
    expect(r.can_run_analysis).toBe(false)
    expect(r.may_run).toBe(false)
    expect(r.readiness_issues?.map((i) => i.message)).toEqual(served.blocked.analysis_ready.readiness_issues.map((i) => i.message))
    expect(r.readiness_issues?.[0]).toMatchObject({ code: 'MISSING_FACTOR_LEVEL', factor_id: 'specialist_availability_risk', obligation: 'required' })
  })

  it('ready turn: may_run true, can run; it served no issue list, so none is invented', () => {
    expect('readiness_issues' in served.ready.analysis_ready).toBe(false)
    const r = readinessFromTurn(served.ready.analysis_ready)!
    expect(r.can_run_analysis).toBe(true)
    expect(r.may_run).toBe(true)
    expect(r.readiness_issues).toBeUndefined()
  })

  it('an EMPTY issue list CEE sends is kept as [] (“there is nothing”), never collapsed to “said nothing”', () => {
    expect(readinessFromTurn({ may_run: true, readiness_issues: [] })!.readiness_issues).toEqual([])
  })

  it('nothing the endpoint alone carried is invented: no score, level, explanation, improvements or scaffold plan', () => {
    for (const ar of [served.blocked.analysis_ready, served.ready.analysis_ready]) {
      const r = readinessFromTurn(ar)!
      for (const key of ['readiness_score', 'readiness_level', 'confidence_explanation', 'improvements', 'scaffold_plan', 'blocker_reason']) {
        expect(key in r, key).toBe(false)
      }
    }
  })

  it('before any turn there is no verdict (null), never “ready”; may_run “unknown” is kept, and an unknown obligation is never defaulted', () => {
    expect(readinessFromTurn(null)).toBeNull()
    // A verdict that does not state may_run (an older producer) is not a refusal: no verdict at all.
    expect(readinessFromTurn({ status: 'ready', readiness_issues: [] })).toBeNull()
    const r = readinessFromTurn({ may_run: 'unknown', readiness_issues: [{ message: 'Say X.' }] })!
    expect(r.may_run).toBe('unknown')
    expect(r.can_run_analysis).toBe(false)
    expect(r.readiness_issues).toEqual([{ message: 'Say X.' }])
  })

  it('the store follows the turn: listening publishes the current verdict and each new turn verdict, with NO request on any change', () => {
    const release = useReadinessStore.getState().startListening()
    expect(useReadinessStore.getState().readiness).toBeNull()
    useCanvasStore.setState({ ceeAnalysisReady: served.blocked.analysis_ready } as never)
    expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false)
    // An edit on the canvas (nodes move) asks nobody anything.
    useCanvasStore.setState({ nodes: [{ id: 'n1', position: { x: 1, y: 2 }, data: {} }] } as never)
    useCanvasStore.setState({ ceeAnalysisReady: served.ready.analysis_ready } as never)
    expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
    expect(useReadinessStore.getState().stale).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    release()
  })

  it('an option CEE will leave out is marked with CEE’s words; others are not', () => {
    useReadinessStore.setState({ readiness: readinessFromTurn({ may_run: true, readiness_issues: [
      { message: 'Analysis will leave out “B” until it has values.', option_id: 'opt_b', waived_by_exclusion: true },
    ] }), stale: false } as never)
    const s = useReadinessStore.getState()
    expect(selectOptionExclusionMessage('opt_b')(s)).toBe('Analysis will leave out “B” until it has values.')
    expect(selectOptionExclusionMessage('opt_a')(s)).toBeNull()
  })
})
