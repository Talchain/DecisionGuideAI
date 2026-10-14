import { describe, it, expect, beforeEach } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import {
  adoptChangedSinceRun,
  changedSinceRunForVerdict,
  isLinkChangedSinceRun,
  isNodeChangedSinceRun,
  readChangedSinceRun,
  useChangedSinceRunStore,
} from '../changedSinceRun'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const OTHER = '9e8d7c6b-5a49-4382-b716-0c5d4e3f2a1b'
const RUN_AT = '2026-10-08T09:30:00.000Z'
const stale = (): AnalysisStateV1 => ({
  run_state: { kind: 'complete_stale', computed_at: RUN_AT, cause: 'graph_changed' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
  robustness: {}, usable_for_prose: false, usable_for_chips: false, usable_for_followup: false,
  requires_rerun: true, blocked_unusable: false, contradictions: [],
})
const wire = (over: Record<string, unknown> = {}) => ({
  version: 1, since_run_id: 'run_b', node_ids: ['fac_price'], links: [{ from: 'fac_price', to: 'out_rev' }],
  unattributed_changes: 0, complete: true, ...over,
})

beforeEach(() => useChangedSinceRunStore.setState({ scenarioId: null, value: null }))

describe('readChangedSinceRun: strict, never "nothing changed" on a bad block', () => {
  it('reads the server block by identity', () => {
    const v = readChangedSinceRun(wire())
    expect(v?.sinceRunId).toBe('run_b')
    expect([...(v?.nodeIds ?? [])]).toEqual(['fac_price'])
    expect(v?.unattributedChanges).toBe(0)
  })
  it.each([
    ['UTC', RUN_AT],
    ['an ISO timezone offset', '2026-10-08T10:30:00.000+01:00'],
    ['the 64-character limit', `2026-10-08T09:30:00.${'0'.repeat(43)}Z`],
  ])('reads since_run_computed_at exactly with %s', (_name, stamp) => {
    expect(readChangedSinceRun(wire({ since_run_computed_at: stamp }))?.sinceRunComputedAt).toBe(stamp)
  })
  it('keeps an absent since_run_computed_at undefined', () => {
    const v = readChangedSinceRun(wire())
    expect(v).not.toBeNull()
    expect(v?.sinceRunComputedAt).toBeUndefined()
  })
  it.each([
    ['a non-string', 123],
    ['null', null],
    ['explicit undefined', undefined],
    ['an empty string', ''],
    ['non-ISO text', '8 October 2026 09:30 UTC'],
    ['a date without time', '2026-10-08'],
    ['a timezone-less datetime', '2026-10-08T09:30:00.000'],
    ['an impossible calendar date', '2026-02-30T09:30:00.000Z'],
    ['an invalid timezone offset', '2026-10-08T09:30:00.000+99:00'],
    ['more than 64 characters', `2026-10-08T09:30:00.${'0'.repeat(44)}Z`],
  ])('present-invalid since_run_computed_at (%s) makes the whole block null', (_name, stamp) => {
    expect(readChangedSinceRun(wire({ since_run_computed_at: stamp }))).toBeNull()
  })
  it('rejects since_run_computed_at without a since_run_id', () => {
    expect(readChangedSinceRun(wire({ since_run_id: null, since_run_computed_at: RUN_AT }))).toBeNull()
  })
  it.each([
    ['absent', undefined],
    ['wrong version', wire({ version: 2 })],
    ['a non-id node', wire({ node_ids: [''] })],
    ['a link with one end', wire({ links: [{ from: 'a' }] })],
    ['a negative count', wire({ unattributed_changes: -1 })],
    ['no completeness', wire({ complete: undefined })],
  ])('%s → null', (_name, raw) => {
    expect(readChangedSinceRun(raw)).toBeNull()
  })
})

describe('marks: only the named elements, only on their own scenario', () => {
  it('marks the named node and link; a neighbour and the reversed link stay unmarked', () => {
    adoptChangedSinceRun(S, wire())
    const st = useChangedSinceRunStore.getState()
    expect(isNodeChangedSinceRun(st, S, 'fac_price')).toBe(true)
    expect(isNodeChangedSinceRun(st, S, 'fac_cost')).toBe(false)
    expect(isLinkChangedSinceRun(st, S, 'fac_price', 'out_rev')).toBe(true)
    expect(isLinkChangedSinceRun(st, S, 'out_rev', 'fac_price')).toBe(false)
  })
  it('another scenario on screen never shows these marks', () => {
    adoptChangedSinceRun(S, wire())
    expect(isNodeChangedSinceRun(useChangedSinceRunStore.getState(), OTHER, 'fac_price')).toBe(false)
  })
  it('a later read without the block clears the marks (the server no longer stands behind them)', () => {
    adoptChangedSinceRun(S, wire())
    adoptChangedSinceRun(S, undefined)
    expect(isNodeChangedSinceRun(useChangedSinceRunStore.getState(), S, 'fac_price')).toBe(false)
  })
  it('a newer Run (empty set from the server) clears them', () => {
    adoptChangedSinceRun(S, wire())
    adoptChangedSinceRun(S, wire({ since_run_id: 'run_c', node_ids: [], links: [] }))
    expect(isNodeChangedSinceRun(useChangedSinceRunStore.getState(), S, 'fac_price')).toBe(false)
  })
})

describe('held words: bound to the adopted Run, not the parsed verdict object', () => {
  it('a later accepted read of the same stale Run keeps the held value', () => {
    const adopted = stale()
    adoptChangedSinceRun(S, wire(), adopted)
    const held = useChangedSinceRunStore.getState()
    const laterRead = stale()
    expect(laterRead).not.toBe(adopted)
    expect(changedSinceRunForVerdict(held, laterRead)).toBe(held.value)
  })

  it('a newer Run hides the held words even if the verdict object is reused', () => {
    const adopted = stale()
    adoptChangedSinceRun(S, wire(), adopted)
    adopted.run_state = { kind: 'complete_stale', computed_at: '2026-10-08T10:30:00.000Z', cause: 'graph_changed' }
    expect(changedSinceRunForVerdict(useChangedSinceRunStore.getState(), adopted)).toBeNull()
  })

  it('a different run_state kind hides the held words even at the same computed_at', () => {
    const adopted = stale()
    adoptChangedSinceRun(S, wire(), adopted)
    adopted.run_state = { kind: 'complete_current', computed_at: RUN_AT }
    expect(changedSinceRunForVerdict(useChangedSinceRunStore.getState(), adopted)).toBeNull()
  })

  it('a refused read with a different Run cannot attach its held set to the accepted Run', () => {
    const accepted = stale()
    const refusedRead = stale()
    refusedRead.run_state = { kind: 'complete_stale', computed_at: '2026-10-08T10:30:00.000Z', cause: 'graph_changed' }
    adoptChangedSinceRun(S, wire({ node_ids: ['fac_cost'], links: [] }), refusedRead)
    expect(changedSinceRunForVerdict(useChangedSinceRunStore.getState(), accepted)).toBeNull()
  })

  it('a matching Run cannot expose a value that was replaced outside adoption', () => {
    const adopted = stale()
    adoptChangedSinceRun(S, wire(), adopted)
    useChangedSinceRunStore.setState({ value: readChangedSinceRun(wire()) })
    expect(changedSinceRunForVerdict(useChangedSinceRunStore.getState(), stale())).toBeNull()
  })
})
