/**
 * Echo-guard invariant across the run-completion overwrite (F10 review fold).
 *
 * Real-store sequence: a pre-run CEE 'stale' verdict → the run completes with
 * NO verdict (noteRunCompletedWithoutVerdict writes unknown/
 * run_completed_without_verdict) → the byte-identical pre-run 'stale'
 * analysis_ready is re-delivered on the next conversational turn (the
 * documented echo case the reducer's guard exists for).
 *
 * Defect this catches when reverted: the guard compared echoes against the
 * STORED verdict only; the run write changed the stored verdict without a CEE
 * payload, so the echo read as a NEW verdict, re-applied 'stale', and
 * silently resurrected "Model changed since this analysis" over the results
 * the run itself had just produced — one turn after the F10 fix.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { RUN_COMPLETED_WITHOUT_VERDICT } from '../analysisFreshness'

const PRE_RUN_STALE_PAYLOAD = {
  status: 'ready',
  freshness: 'stale',
  freshness_reason: 'analysed_options_diverged',
  graph_hash_at_run: '595d1a7b7ec9272b',
  current_graph_hash: '595d1a7b7ec9272b',
}

beforeEach(() => {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
})

describe('freshness echo guard vs run-completion overwrite (real store)', () => {
  it('a byte-identical pre-run stale echo after the run write does NOT resurrect stale', () => {
    const store = useCanvasStore.getState()

    // Turn 1: CEE stamps stale.
    store.setAnalysisFreshness(PRE_RUN_STALE_PAYLOAD)
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('stale')

    // Run completes with no analysis_ready → honest unknown, provenance kept.
    store.noteRunCompletedWithoutVerdict()
    const afterRun = useCanvasStore.getState().analysisFreshness
    expect(afterRun?.freshness).toBe('unknown')
    expect(afterRun?.freshnessReason).toBe(RUN_COMPLETED_WITHOUT_VERDICT)
    expect(afterRun?.supersededVerdict?.freshness).toBe('stale')

    // Turn 3: CEE echoes the identical pre-run payload — must be a no-op.
    store.setAnalysisFreshness({ ...PRE_RUN_STALE_PAYLOAD })
    const afterEcho = useCanvasStore.getState().analysisFreshness
    expect(afterEcho?.freshness).toBe('unknown')
    expect(afterEcho?.freshnessReason).toBe(RUN_COMPLETED_WITHOUT_VERDICT)
  })

  it('POSITIVE CONTROL: a genuinely new verdict after the run write is applied', () => {
    const store = useCanvasStore.getState()
    store.setAnalysisFreshness(PRE_RUN_STALE_PAYLOAD)
    store.noteRunCompletedWithoutVerdict()

    store.setAnalysisFreshness({
      status: 'ready',
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
      graph_hash_at_run: 'new-hash',
      current_graph_hash: 'new-hash',
    })
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('fresh')
  })

  it('POSITIVE CONTROL: before any run write, the identical echo is already a no-op (pre-existing guard)', () => {
    const store = useCanvasStore.getState()
    store.setAnalysisFreshness(PRE_RUN_STALE_PAYLOAD)
    const first = useCanvasStore.getState().analysisFreshness
    store.setAnalysisFreshness({ ...PRE_RUN_STALE_PAYLOAD })
    expect(useCanvasStore.getState().analysisFreshness).toBe(first)
  })

  it('chained run writes flatten provenance to the deepest CEE verdict', () => {
    const store = useCanvasStore.getState()
    store.setAnalysisFreshness(PRE_RUN_STALE_PAYLOAD)
    store.noteRunCompletedWithoutVerdict()
    store.noteRunCompletedWithoutVerdict()
    const state = useCanvasStore.getState().analysisFreshness
    expect(state?.supersededVerdict?.freshness).toBe('stale')
    expect(state?.supersededVerdict?.supersededVerdict).toBeUndefined()

    // The echo of the original CEE payload is still recognised.
    store.setAnalysisFreshness({ ...PRE_RUN_STALE_PAYLOAD })
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('unknown')
  })
})
