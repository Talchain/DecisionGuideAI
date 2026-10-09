import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore, selectPreviousReport } from '../../store'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import { useAnalysisSnapshotStore, selectSnapshots } from '../analysisSnapshotStore'
import { makeAnalysisSnapshot } from '../../compare-tab/__tests__/__fixtures__/analysisSnapshot'
import { CompareRunPairBody } from '../../compare-tab/CompareRunPairBody'
import { selectGoalProbability, type GoalProbabilityInput } from '../../../components/results/utils/selectGoalProbability'
import { goalLevelFromIdentityCaveat } from '../../../components/results/utils/goalLevelFromIdentity'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

const licence = {
  code: 'GOAL_CHANCE_LICENSED', form: 'each', severity: 'info',
  target: { unit: '£/month', value: 20000, comparator: 'at_least' },
  option_ids: ['a', 'b'], pct_by_option: { a: 41 }, withheld_option_ids: ['b'],
  horizon_line: null,
}
const raw = (warnings: unknown[] = []) => ({
  option_comparison: [
    { option_id: 'a', option_label: 'A', win_probability: 0.7, probability_of_goal: 0.879, probability_of_joint_goal: 0.23 },
    { option_id: 'b', option_label: 'B', win_probability: 0.3, probability_of_goal: 0.912 },
  ],
  inference_warnings: warnings, response_hash: 'persist-licensed-test',
})
const report = (warnings: unknown[] = []) => ({
  option_probabilities: {
    a: { win_probability: 0.7, goal_probability: 0.879 },
    b: { win_probability: 0.3, goal_probability: 0.912 },
    other: { win_probability: 0.1, goal_probability: 0.731 },
  },
  inference_warnings: warnings,
})
function snapshot(response: ReturnType<typeof raw>) {
  return buildAnalysisSnapshot({ rawV2Response: response as unknown as V2RunResponse,
    nodes: [], edges: [], runNumber: 1, events: [], previousSnapshotTimestamp: null })
}
function previous(warnings: unknown[] = []) {
  useCanvasStore.setState(s => ({ results: { ...s.results, status: 'complete', report: report(warnings) as never } }))
  useCanvasStore.getState().resultsComplete({ report: { option_probabilities: {} } as never, hash: 'next' })
  return selectPreviousReport(useCanvasStore.getState())!
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [], previousReport: null })
  useCanvasStore.getState().resultsReset()
  useAnalysisSnapshotStore.getState().clearSnapshots()
})
afterEach(cleanup)

describe('S1 PERSIST licensed chance', () => {
  it('P1 last-result: licensed option stores pct/100; all keys and other values survive', () => {
    expect(previous([licence]).options.a).toEqual({ winProbability: 0.7, goalProbability: 0.41 })
  })
  it('P1 AnalysisSnapshot: licensed winner stores the licensed whole percent (field unit), never raw or a rounded raw percent', () => {
    const saved = snapshot(raw([licence]))
    expect(saved.goalProbability).toBe(41)
    expect(saved.jointGoalProbability).toBe(23)
    expect(saved.goalBaseCaveat).toBeNull()
  })
  it('P1 licensed zero and 100 are retained by both writers', () => {
    for (const pct of [0, 100]) {
      const lic = { ...licence, pct_by_option: { a: pct } }
      expect(previous([lic]).options.a.goalProbability).toBe(pct / 100)
      expect(snapshot(raw([lic])).goalProbability).toBe(pct)
    }
  })
  it('P2 last-result: absent licence, withheld option and unlisted option store null', () => {
    expect(previous().options.a).toEqual({ winProbability: 0.7, goalProbability: null })
    const saved = previous([licence])
    expect(saved.options.b.goalProbability).toBeNull()
    expect(saved.options.other.goalProbability).toBeNull()
  })
  it('P2 AnalysisSnapshot: absent licence, withheld winner and unlisted winner store null', () => {
    expect(snapshot(raw()).goalProbability).toBeNull()
    expect(snapshot(raw([{ ...licence, pct_by_option: {}, withheld_option_ids: ['a', 'b'] }])).goalProbability).toBeNull()
    expect(snapshot(raw([{ ...licence, option_ids: ['b'], pct_by_option: { b: 41 }, withheld_option_ids: [] }])).goalProbability).toBeNull()
  })
  it('CONTROL: every other AnalysisSnapshot field, including joint and base caveat, keeps its old value', () => {
    const identityWarning = { code: 'GOAL_LEVEL_FROM_IDENTITY_INPUTS', field: 'nodes[g].nonlinear_identity' }
    for (const goal of [0.879, undefined]) {
      for (const author of ['olumi', 'user', undefined]) {
        for (const withheld of [false, true]) {
          const response = {
            ...raw([identityWarning]),
            identity_evaluations: author ? [{ node_id: 'g', level_source: 'identity_inputs', level_author: author }] : [],
          }
          response.option_comparison[0].probability_of_goal = goal as number
          const input = { ...response.option_comparison[0], ...(withheld ? { goalCertaintyUnearned: { say: null } } : {}) } as GoalProbabilityInput
          response.option_comparison[0] = input as typeof response.option_comparison[0]
          const level = goalLevelFromIdentityCaveat(response)
          const old = selectGoalProbability({ ...input, ...(level === null ? {} : { goalLevelAuthor: level }) })
          const saved = snapshot(response)
          expect(saved.jointGoalProbability).toBe(old.jointGoalProbability === null ? null : Math.round(old.jointGoalProbability * 100))
          expect(saved.goalBaseCaveat).toBe(old.goalFitBaseCaveat)
          const licensed = snapshot({ ...response, inference_warnings: [identityWarning, licence] })
          const omit = ({ goalProbability: _goal, runId: _id, timestamp: _time, inferenceWarnings: _warnings, ...rest }: typeof saved) => rest
          expect(omit(licensed)).toEqual(omit(saved))
          expect(saved.inferenceWarnings).toEqual(['GOAL_LEVEL_FROM_IDENTITY_INPUTS'])
          expect(licensed.inferenceWarnings).toEqual(['GOAL_LEVEL_FROM_IDENTITY_INPUTS', 'GOAL_CHANCE_LICENSED'])
        }
      }
    }
  })

  it('P3 old raw snapshots load through every exposed selector/getter, render no chance, and do not throw', () => {
    const oldPrevious = JSON.parse('{"options":{"a":{"winProbability":0.7,"goalProbability":0.879}}}')
    const oldAnalysis = JSON.parse(JSON.stringify(makeAnalysisSnapshot({ runNumber: 1, goalProbability: 88, jointGoalProbability: 23 })))
    // A pre-caveat snapshot is readable too. No new shape discriminator is required.
    delete oldAnalysis.goalBaseCaveat
    expect(() => {
      useCanvasStore.setState({ previousReport: oldPrevious })
      expect(selectPreviousReport(useCanvasStore.getState())).toEqual(oldPrevious)
      const store = useAnalysisSnapshotStore.getState()
      store.hydrateFromPersisted([oldAnalysis])
      store.addSnapshot({ ...oldAnalysis, runId: 'old-second', responseHash: 'old-second' })
      expect(selectSnapshots(useAnalysisSnapshotStore.getState())).toHaveLength(2)
      for (const saved of [store.getFirst(), store.getPrevious(), store.getLatest()]) expect(saved?.goalProbability).toBe(88)
      const { container } = render(<CompareRunPairBody responseHash="old-result" />)
      expect(container.textContent).not.toMatch(/0\.879|87\.9|\b88\b|chance/i)
      expect(container.textContent?.length).toBeGreaterThan(0)
    }).not.toThrow()
  })
  it('P3 reader census: neither stored chance field has a production field reader; previousReport only has its accessor', () => {
    const sources: Array<[string, string]> = []
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) { if (!['__tests__', '__fixtures__', 'test', 'fixtures'].includes(entry.name)) walk(path) }
        else if (/\.[jt]sx?$/.test(path) && !/\.(spec|test)\./.test(path)) sources.push([path, readFileSync(path, 'utf8')])
      }
    }
    walk(join(process.cwd(), 'src'))
    const readers = sources.filter(([, source]) => /\bselectPreviousReport\b/.test(source)).map(([file]) => file.replace(`${process.cwd()}/`, ''))
    expect(readers).toEqual(['src/canvas/store.ts'])
    // Compare's live renderer consumes canonical Run deltas, not AnalysisSnapshot.
    const compare = sources.filter(([file]) => file.includes('/compare-tab/') && !file.endsWith('/types.ts'))
    expect(compare.filter(([, source]) => /\b(?:goalProbability|jointGoalProbability|goalBaseCaveat)\b/.test(source))).toEqual([])
  })
})
