/**
 * RT-10 B′ (CEE #2596 / #2600): a saved Run that is out of date although the MODEL DID NOT CHANGE must not be called
 * "Model changed". Witnessed on staging CEE 43e51050 (Acceptance #87 5997253182, red team 5997216307): scenario
 * e8c3f36f read `complete_stale` with `computed_against_hash === current_analysis_hash` and
 * `analysis_ready.freshness_reason` "which way counts as better for your goal changed", while the UI said
 * "Model changed. Ask or rerun…" and Compare "The model has changed since the last Run".
 *
 * Rows bind the words by identity (the exact sentence) and pair every positive with the negative it must not cross.
 */
import { describe, expect, it } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { hashEqualStaleReasonWords } from '../hashEqualStaleReasonWords'
import { readHashEqualStaleReasonWords } from '../../adapters/cee/scenarioGraph'
import { useCanvasStore, selectAnalysisStaleReasonWords } from '../../canvas/store'
import { outOfDatePlaceholder } from '../../canvas/hooks/useStageAwarePlaceholder'
import { compareOutOfDateCopy, COMPARE_RUN_ON_RECORD_COPY } from '../../canvas/compare-tab/CompareRunPairBody'

const WORDS = 'which way counts as better for your goal changed'
const HASH = 'dfd7fd52a1b2c3d4'

/** The served e8c3f36f `current_read` shape (CEE `projectCurrentRead`), hashes equal. */
const servedCurrentRead = (over: Record<string, unknown> = {}) => ({
  run_state: { kind: 'complete_stale', computed_at: '2026-10-05T10:41:07.000Z', cause: 'graph_changed' },
  computed_against_hash: HASH,
  current_analysis_hash: HASH,
  result: null,
  figures: [],
  analysis_ready: { options: [], goal_node_id: 'monthly_churn', status: 'ready', freshness: 'stale', freshness_reason: WORDS },
  ...over,
})

const verdict = (kind: 'complete_stale' | 'complete_current'): AnalysisStateV1 =>
  ({ run_state: kind === 'complete_stale'
    ? { kind, computed_at: '2026-10-05T10:41:07.000Z', cause: 'graph_changed' }
    : { kind, computed_at: '2026-10-05T10:41:07.000Z' } } as unknown as AnalysisStateV1)

describe('hashEqualStaleReasonWords — the one rule both legs apply', () => {
  it('CEE prose with equal hashes → the exact words', () => {
    expect(hashEqualStaleReasonWords(WORDS, HASH, HASH)).toBe(WORDS)
  })
  it.each([
    ['the hashes differ (the model DID change)', WORDS, HASH, 'aaaaaaaaaaaaaaaa'],
    ['a reason CODE, not prose', 'graph_hash_diverged', HASH, HASH],
    ['no hash at run', WORDS, '', ''],
    ['a non-string reason', 42, HASH, HASH],
    ['an over-long reason', 'x '.repeat(101), HASH, HASH],
  ])('null when %s', (_name, reason, at, now) => {
    expect(hashEqualStaleReasonWords(reason, at, now)).toBeNull()
  })
})

describe('the cold read carries the words only for a hash-equal complete_stale', () => {
  it('served e8c3f36f shape → the words', () => {
    expect(readHashEqualStaleReasonWords(servedCurrentRead())).toBe(WORDS)
  })
  it.each([
    ['complete_current', { run_state: { kind: 'complete_current', computed_at: '2026-10-05T10:41:07.000Z' } }],
    ['an ordinary graph-changed stale (hashes differ)', { current_analysis_hash: '0123456789abcdef' }],
    ['no analysis_ready', { analysis_ready: undefined }],
  ])('null for %s', (_name, over) => {
    expect(readHashEqualStaleReasonWords(servedCurrentRead(over))).toBeNull()
  })
})

describe('the store keeps the words only WITH their complete_stale verdict', () => {
  it('a stale verdict with words → the selector says them; a later verdict without words clears them', () => {
    useCanvasStore.getState().setAnalysisStateV1(verdict('complete_stale'), WORDS)
    expect(selectAnalysisStaleReasonWords(useCanvasStore.getState())).toBe(WORDS)
    useCanvasStore.getState().setAnalysisStateV1(verdict('complete_stale'))
    expect(selectAnalysisStaleReasonWords(useCanvasStore.getState())).toBeNull()
  })
  it('CONTRAST: words offered with a CURRENT verdict are never kept', () => {
    useCanvasStore.getState().setAnalysisStateV1(verdict('complete_current'), WORDS)
    expect(selectAnalysisStaleReasonWords(useCanvasStore.getState())).toBeNull()
  })
  it('CONTRAST: a verdict cleared to null leaves nothing to say', () => {
    useCanvasStore.getState().setAnalysisStateV1(verdict('complete_stale'), WORDS)
    useCanvasStore.getState().setAnalysisStateV1(null)
    expect(selectAnalysisStaleReasonWords(useCanvasStore.getState())).toBeNull()
  })
})

describe('the surfaces say the reason, never "Model changed", for a hash-equal stale', () => {
  it('composer placeholder (both endings)', () => {
    expect(outOfDatePlaceholder(WORDS, false)).toBe(`Out of date: ${WORDS}. Ask or rerun…`)
    expect(outOfDatePlaceholder(WORDS, true)).toBe(`Out of date: ${WORDS}. Ask what it needs before a rerun…`)
    expect(outOfDatePlaceholder(WORDS, false)).not.toMatch(/model changed/i)
  })
  it('Compare notice; CONTRAST: the ordinary stale notice is unchanged', () => {
    expect(compareOutOfDateCopy(WORDS)).toEqual({
      title: 'The last Run is out of date',
      body: 'Which way counts as better for your goal changed. Re-run to compare the model as it stands with the last Run.',
    })
    expect(COMPARE_RUN_ON_RECORD_COPY.stale.title).toBe('The model has changed since the last Run')
  })
})
