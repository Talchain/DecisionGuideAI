/**
 * ⭐ CORE STATES ITS FRESHNESS IN `analysis_state.run_state` (DL lease, 21 Oct 2026). Core omits `analysis_ready` (CEE
 * #3495), so the Run turn after an edit carried no freshness verdict, and the live tab read "Cannot confirm whether this
 * analysis is current" over the Run it had just received until a reopen (Lenses guest witness, scenario 5e28e10f).
 * The fixtures are that witness's two served responses (edit, then its Run), trimmed to the keys the applicator reads.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import editTurn from './fixtures/core-freshness-5e28e10f-edit.json'
import runTurn from './fixtures/core-freshness-5e28e10f-run.json'
import { applyV5State, runStateFreshnessVerdict, type V5ApplicatorStore } from '../applyV5State'
import { useCanvasStore } from '../../canvas/store'
import { classifyFreshnessForDisplay } from '../../canvas/store/analysisFreshness'

type Json = Record<string, unknown>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function applicator(setCeeAnalysisReady = vi.fn(), currentResultsHash: string | null = null, resultsComplete = vi.fn()): V5ApplicatorStore {
  const s = () => useCanvasStore.getState()
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady,
    resultsComplete,
    setAnalysisFreshness: (raw) => s().setAnalysisFreshness?.(raw),
    clearAnalysisFreshnessDirty: () => s().clearAnalysisFreshnessDirty?.(),
    noteRunCompletedWithoutVerdict: () => s().noteRunCompletedWithoutVerdict?.(),
    nodes: [],
    edges: [],
    currentResultsHash,
  }
}

/** What the live tab says after the edit turn, then the given Run turn. */
function liveTabAfter(run: Json): string {
  applyV5State(clone(editTurn) as never, applicator())
  // The edit dirtied the overlay locally before its turn returned; the Run must resolve it.
  useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
  applyV5State(run as never, applicator())
  const s = useCanvasStore.getState()
  return classifyFreshnessForDisplay(s.analysisFreshness, s.analysisFreshnessDirty, false)
}

beforeEach(() => {
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false, pendingEmittedEdits: 0, importPendingServerRegistration: false } as never)
})

describe('core Run turn: the producer\'s run_state is the freshness verdict when analysis_ready is absent', () => {
  it('PRECONDITION: the served pair is what the DL described (edit carries analysis_ready stale; Run carries none, complete_current, hashes equal)', () => {
    expect((editTurn as Json).analysis_ready).toMatchObject({ freshness: 'stale' })
    expect((runTurn as Json).analysis_ready).toBeUndefined()
    expect(((runTurn as Json).analysis_state as Json).run_state).toMatchObject({ kind: 'complete_current' })
    expect(((runTurn as { blocks: Json[] }).blocks[0]).computed_against_hash).toBe((runTurn as Json).graph_hash)
  })

  it('⭐ the served edit → Run: the live tab reads current, without a reopen', () => {
    expect(liveTabAfter(clone(runTurn) as Json)).toBe('current')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })

  it('the edit turn alone reads changed (its own analysis_ready verdict, unchanged path)', () => {
    applyV5State(clone(editTurn) as never, applicator())
    const s = useCanvasStore.getState()
    expect(classifyFreshnessForDisplay(s.analysisFreshness, s.analysisFreshnessDirty, false)).toBe('changed')
  })

  it('NEGATIVE: a Run result computed against ANOTHER hash is never fresh (stays cannot-confirm)', () => {
    const run = clone(runTurn) as { blocks: Json[] } & Json
    run.blocks[0].computed_against_hash = '0c8ea116b6a5a1c9'
    expect(liveTabAfter(run)).toBe('cannot_confirm')
  })

  it('NEGATIVE: no run_state at all is never fresh (today\'s behaviour: cannot-confirm)', () => {
    const run = clone(runTurn) as Json
    delete run.analysis_state
    expect(liveTabAfter(run)).toBe('cannot_confirm')
  })

  it('complete_stale with no analysis_ready reads changed', () => {
    const run = clone(runTurn) as Json
    run.analysis_state = { ...(run.analysis_state as Json), run_state: { kind: 'complete_stale', computed_at: '2026-10-21T00:47:54.072Z', cause: 'graph_changed' } }
    expect(liveTabAfter(run)).toBe('changed')
  })

  it('LEGACY: when analysis_ready is present, its own verdict governs (a stale one stays stale over complete_current)', () => {
    const run = clone(runTurn) as Json
    run.analysis_ready = { freshness: 'stale', freshness_reason: 'graph_hash_diverged', status: 'ready' }
    expect(runStateFreshnessVerdict(run)).toBeUndefined()
    expect(liveTabAfter(run)).toBe('changed')
  })

  it('⭐ Codex R1 (1): a re-delivered ECHO of the same Run after a local edit never re-affirms it (stays cannot-confirm)', () => {
    const resultsComplete = vi.fn()
    // The Run first arrives with CEE's own raw verdict (a different reason from the derived one).
    const withRaw = clone(runTurn) as Json
    withRaw.analysis_ready = { freshness: 'fresh', freshness_reason: 'graph_hash_match', graph_hash_at_run: withRaw.graph_hash, current_graph_hash: withRaw.graph_hash, status: 'ready' }
    applyV5State(clone(editTurn) as never, applicator())
    applyV5State(withRaw as never, applicator(vi.fn(), null, resultsComplete))
    const hash = (resultsComplete.mock.calls[0]?.[0] as { hash?: string } | undefined)?.hash
    expect(hash, 'PRECONDITION: the Run hydrated and its result hash is known').toBeTruthy()
    expect(classifyFreshnessForDisplay(useCanvasStore.getState().analysisFreshness, useCanvasStore.getState().analysisFreshnessDirty, false)).toBe('current')
    // The person edits the canvas; then the same Run's result arrives again (same hash), with no analysis_ready.
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    applyV5State(clone(runTurn) as never, applicator(vi.fn(), hash!))
    const s = useCanvasStore.getState()
    expect(s.analysisFreshnessDirty).toBe(true)
    expect(classifyFreshnessForDisplay(s.analysisFreshness, s.analysisFreshnessDirty, false)).not.toBe('current')
  })

  it('the derived verdict never reaches the readiness arm: the core Run sets no readiness from it (control: a raw analysis_ready does)', () => {
    const core = vi.fn()
    applyV5State(clone(runTurn) as never, applicator(core))
    for (const call of core.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('run_state_complete')
      expect(call[0] ?? null).toBeNull()
    }
    const legacy = vi.fn()
    const withReady = clone(runTurn) as Json
    withReady.analysis_ready = clone((editTurn as Json).analysis_ready)
    applyV5State(withReady as never, applicator(legacy))
    expect(legacy.mock.calls.some((c) => c[0] !== null && c[0] !== undefined), 'CONTROL: a raw analysis_ready reaches the readiness setter').toBe(true)
  })
})
