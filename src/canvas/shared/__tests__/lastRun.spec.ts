import { describe, it, expect } from 'vitest'
import type { StoredRun } from '../../store/runHistory'
import { selectScenarioLastRun } from '../lastRun'

function buildRun(params: { id: string; ts: number; hash?: string | null }): StoredRun {
  const { id, ts, hash } = params
  return {
    id,
    ts,
    seed: 1,
    hash: hash ?? undefined,
    adapter: 'mock',
    summary: `Run ${id}`,
    graphHash: `graph-${id}`,
    report: {} as any,
  }
}

describe('selectScenarioLastRun', () => {
  it('prefers scenarioLastResultHash when it matches a run', () => {
    const runs: StoredRun[] = [
      buildRun({ id: 'run-1', ts: 2, hash: 'aaaa1111' }),
      buildRun({ id: 'run-2', ts: 1, hash: 'bbbb2222' }),
    ]

    const selected = selectScenarioLastRun({
      runs,
      scenarioLastResultHash: 'bbbb2222',
      currentResultsHash: 'aaaa1111',
    })

    expect(selected).not.toBeNull()
    expect(selected?.id).toBe('run-2')
  })

  it('falls back to currentResultsHash when scenarioLastResultHash is missing', () => {
    const runs: StoredRun[] = [
      buildRun({ id: 'run-1', ts: 2, hash: 'aaaa1111' }),
      buildRun({ id: 'run-2', ts: 1, hash: 'bbbb2222' }),
    ]

    const selected = selectScenarioLastRun({
      runs,
      scenarioLastResultHash: null,
      currentResultsHash: 'aaaa1111',
    })

    expect(selected).not.toBeNull()
    expect(selected?.id).toBe('run-1')
  })

  it('falls back to the first run when neither hash matches but runs exist', () => {
    const runs: StoredRun[] = [
      buildRun({ id: 'run-1', ts: 5, hash: 'aaaa1111' }),
      buildRun({ id: 'run-2', ts: 4, hash: 'bbbb2222' }),
      buildRun({ id: 'run-3', ts: 3, hash: 'cccc3333' }),
    ]

    const selected = selectScenarioLastRun({
      runs,
      scenarioLastResultHash: 'zzzz9999',
      currentResultsHash: 'yyyy8888',
    })

    expect(selected).not.toBeNull()
    expect(selected?.id).toBe('run-1')
  })

  it('returns null when there are no runs', () => {
    const selected = selectScenarioLastRun({
      runs: [],
      scenarioLastResultHash: null,
      currentResultsHash: null,
    })

    expect(selected).toBeNull()
  })

  it('handles runs with missing hashes gracefully', () => {
    const runs: StoredRun[] = [
      buildRun({ id: 'run-1', ts: 2, hash: null }),
      buildRun({ id: 'run-2', ts: 1, hash: 'bbbb2222' }),
    ]

    const selected = selectScenarioLastRun({
      runs,
      scenarioLastResultHash: 'bbbb2222',
      currentResultsHash: null,
    })

    expect(selected).not.toBeNull()
    expect(selected?.id).toBe('run-2')
  })
})
