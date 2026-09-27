/**
 * V2 prototype `synthesisHTML()` (re-run): "What we have" states the
 * consequence first. Live said only "4 options compared." with the movement at
 * the foot of the tab. The sentence reads the producer's noise verdicts only.
 * Served shape: D1, UI c976c029 + CEE 44ec820 (panel/d1-capture-20260926).
 */
import { describe, it, expect } from 'vitest'
import type { RunDelta } from '@talchain/schemas/boundary'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { buildRunDeltaView } from '../runDeltaView'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

const LABELS: Record<string, string> = { a: '£59 price', b: 'Keep £49', c: 'Carry on as now' }
const row = (option_id: string, prior: number, current: number, noise_verdict: string) =>
  ({ option_id, prior, current, noise_verdict })
const delta = (rows: ReturnType<typeof row>[]): RunDelta => ({
  attribution_case: 'C2_unpaired',
  pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: rows,
  flip_thresholds: [],
}) as unknown as RunDelta

const founded = (rows: ReturnType<typeof row>[] | null, over: Record<string, unknown> = {}, data = decisionWithLeaderWithheld()) =>
  buildCommitmentSynthesis(buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    whatsChanged: rows ? buildRunDeltaView(delta(rows), (id) => LABELS[id] ?? null) : null,
    ...over,
  } as never)).founded?.text ?? ''

const SERVED = [row('a', 0.8135, 0.8161, 'within_noise'), row('b', 0.1488, 0.143, 'within_noise'), row('c', 0.021, 0.0239, 'within_noise')]

describe('after a re-run, "What we have" says what moved', () => {
  it('served D1: every row within noise → no option moved beyond run-to-run variation', () => {
    expect(founded(SERVED)).toMatch(/Since the last run, no option moved beyond ordinary run-to-run variation\.$/)
  })

  it('one producer-certified movement is named with both figures', () => {
    expect(founded([row('a', 0.81, 0.62, 'signal'), row('b', 0.15, 0.3, 'within_noise')]))
      .toMatch(/Since the last run, £59 price moved from 81% to 62%\.$/)
  })

  it('several are counted', () => {
    expect(founded([row('a', 0.81, 0.62, 'signal'), row('b', 0.15, 0.34, 'signal')]))
      .toMatch(/Since the last run, 2 options moved beyond ordinary run-to-run variation\.$/)
  })

  it('it also follows a permitted reading', () => {
    expect(founded(SERVED, {}, genuineDecision())).toMatch(/Since the last run, no option moved/)
  })

  it('one certified movement on an option this run does not name reads "one option", never "1 options" (Canvas review of #2145, B1)', () => {
    const text = founded([row('gone', 0.5, 0.2, 'signal'), row('a', 0.3, 0.31, 'within_noise')])
    expect(text).toMatch(/Since the last run, one option moved beyond ordinary run-to-run variation\.$/)
    expect(text).not.toMatch(/\b1 options\b/)
  })

  it('CONTRAST: an unqualified row licenses no sentence', () => {
    expect(founded([row('a', 0.81, 0.62, 'not_noise_qualified'), row('b', 0.15, 0.14, 'within_noise')])).not.toMatch(/Since the last run/)
  })

  it('CONTRAST: no delta, or a stale run, says nothing about movement', () => {
    expect(founded(null)).not.toMatch(/Since the last run/)
    expect(founded(SERVED, { isStale: true })).not.toMatch(/Since the last run/)
  })
})
