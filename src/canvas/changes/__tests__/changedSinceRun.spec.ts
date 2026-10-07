import { describe, it, expect, beforeEach } from 'vitest'
import {
  adoptChangedSinceRun,
  isLinkChangedSinceRun,
  isNodeChangedSinceRun,
  readChangedSinceRun,
  useChangedSinceRunStore,
} from '../changedSinceRun'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const OTHER = '9e8d7c6b-5a49-4382-b716-0c5d4e3f2a1b'
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
