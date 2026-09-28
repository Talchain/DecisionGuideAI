/**
 * ⭐ A SAVED GOAL FIGURE CARRIES ITS BASE CAVEAT (ISL #207; CODEX DELIVERY LEAD #72 5879597435).
 *
 * The live result row caveats a goal figure measured from a level Olumi worked out (#2280). Compare
 * replays that figure from saved runs, so the snapshot must carry the caveat and every Compare
 * surface that prints a saved goal figure must say it beside the figure — or withhold the figure.
 *
 * The enrichment rows use the carrier as the UI receives it (`inference_warnings` entry, `field`
 * `nodes[<goal>].nonlinear_identity`), through the live V5 snapshot path. The sentences are asserted
 * as literals, never through the exported copy constants.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { buildSnapshotFromV5Analysis } from '../../stores/v5RunSnapshotFactory'
import { RunPairCompare } from '../RunPairCompare'
import { DotProgression } from '../DotProgression'
import { TrajectorySection } from '../TrajectorySection'
import { TransitionCard } from '../TransitionCard'
import { deriveRunPairComparison } from '../deriveRunPairComparison'
import { deriveTransitions } from '../deriveTransitions'
import { makeLedSnapshot } from './__fixtures__/analysisSnapshot'
import { snapshotGoalBaseCaveat } from '../savedGoalCaveat'
import type { AnalysisSnapshot } from '../types'

const OLUMI =
  "Measured from Olumi's estimate of where your goal stands today, not a figure you gave."
const FROM_INPUTS =
  'Measured from where your goal stands today as worked out from its inputs, not a figure you gave.'

const ANCHORED = {
  code: 'GOAL_LEVEL_FROM_IDENTITY_INPUTS',
  field: 'nodes[mrr].nonlinear_identity',
  message: 'm',
  severity: 'warning',
}
const entry = (node_id: string, level_author: string) => ({
  node_id,
  level_source: 'identity_inputs',
  level_author,
})

function v5Snapshot(extra: Record<string, unknown>): AnalysisSnapshot {
  const snapshot = buildSnapshotFromV5Analysis({
    enrichment: {
      option_comparison: [{ option_id: 'opt-a', option_label: 'Option A', win_probability: 0.6, probability_of_goal: 0.62 }],
      factor_sensitivity: [{ factor_id: 'f1', factor_label: 'Price', elasticity: 0.4 }],
      ...extra,
    },
    responseHash: 'resp-1',
    nodes: null,
    edges: null,
    runNumber: 1,
    events: [],
    previousSnapshotTimestamp: null,
  })
  if (snapshot === null) throw new Error('fixture enrichment did not parse')
  return snapshot
}

describe('the snapshot keeps the chooser\'s goal-base caveat (live V5 path)', () => {
  it.each([
    ['code, no identity_evaluations (carrier dropped)', { inference_warnings: [ANCHORED] }, 'from_inputs'],
    ['code, the goal entry says "olumi"', { inference_warnings: [ANCHORED], identity_evaluations: [entry('mrr', 'olumi')] }, 'olumi_estimate'],
    ['code, the goal entry says "user"', { inference_warnings: [ANCHORED], identity_evaluations: [entry('mrr', 'user')] }, null],
    ['code, only ANOTHER node says "user"', { inference_warnings: [ANCHORED], identity_evaluations: [entry('price', 'user')] }, 'from_inputs'],
    ['malformed field', { inference_warnings: [{ ...ANCHORED, field: 'nodes[mrr].observed_state' }], identity_evaluations: [entry('mrr', 'user')] }, 'from_inputs'],
    ['no anchoring code', { inference_warnings: [{ code: 'OTHER', message: 'm' }] }, null],
  ])('%s → goalBaseCaveat %s', (_case, extra, expected) => {
    const s = v5Snapshot(extra)
    expect(s.goalProbability).toBe(62)
    expect(s.goalBaseCaveat).toBe(expected)
  })
})

const withGoal = (runNumber: number, goal: number | null, caveat?: AnalysisSnapshot['goalBaseCaveat']) =>
  makeLedSnapshot(runNumber, 'opt-a', 60, {
    goalProbability: goal,
    ...(caveat !== undefined ? { goalBaseCaveat: caveat } : {}),
  })

describe('snapshotGoalBaseCaveat — THE reader', () => {
  it.each([
    ['figure + caveat', 40, 'olumi_estimate', 'olumi_estimate'],
    ['no figure, stray caveat', null, 'olumi_estimate', null],
    ['figure, saved before the field existed', 40, undefined, null],
  ] as const)('%s → %s', (_case, goal, caveat, expected) => {
    expect(snapshotGoalBaseCaveat(withGoal(1, goal, caveat))).toBe(expected)
  })
})

describe('RunPairCompare: the goal row never shows an estimate-based figure bare', () => {
  it('both runs on Olumi\'s estimate → the sentence once, straight after the goal row', () => {
    render(<RunPairCompare comparison={deriveRunPairComparison(withGoal(2, 40, 'olumi_estimate'), withGoal(3, 45, 'olumi_estimate'))} />)
    const caveat = screen.getByTestId('goal-row-caveat')
    expect(caveat.textContent).toBe(OLUMI)
    expect(screen.getByTestId('goal-row').nextElementSibling).toBe(caveat)
  })

  it('only the later run on inputs → the sentence names that run', () => {
    render(<RunPairCompare comparison={deriveRunPairComparison(withGoal(2, 40, null), withGoal(3, 45, 'from_inputs'))} />)
    expect(screen.getByTestId('goal-row-caveat').textContent).toBe(`Run 3: ${FROM_INPUTS}`)
  })

  it('no caveat on either run, or a snapshot saved before the field existed → nothing added', () => {
    render(<RunPairCompare comparison={deriveRunPairComparison(withGoal(2, 40, null), withGoal(3, 45))} />)
    expect(screen.queryByTestId('goal-row-caveat')).toBeNull()
  })

  it('a caveat on a run whose goal figure is absent is not said (no figure to caveat)', () => {
    render(<RunPairCompare comparison={deriveRunPairComparison(withGoal(2, null, 'olumi_estimate'), withGoal(3, 45, null))} />)
    expect(screen.queryByTestId('goal-row-caveat')).toBeNull()
  })
})

describe('the progression Target row and the trajectory chart carry the caveat', () => {
  it('DotProgression (under 4 runs): one sentence under the Target row', () => {
    render(<DotProgression snapshots={[withGoal(1, 30, 'olumi_estimate'), withGoal(2, 35, 'olumi_estimate')]} />)
    expect(screen.getByTestId('compare-progression-goal-caveat').textContent).toBe(OLUMI)
  })

  it('TrajectorySection chart arm (4+ runs): the sentence beside the chart, said once', () => {
    const runs = [1, 2, 3, 4].map((n) => withGoal(n, 30 + n, 'from_inputs'))
    render(<TrajectorySection snapshots={runs} showExpert={false} />)
    expect(screen.getByTestId('trajectory-goal-caveat').textContent).toBe(FROM_INPUTS)
    expect(screen.queryByTestId('compare-progression-goal-caveat')).toBeNull()
  })

  it('TrajectorySection dot arm: the progression carries it, the chart line does not repeat it', () => {
    render(<TrajectorySection snapshots={[withGoal(1, 30, 'olumi_estimate'), withGoal(2, 35, 'olumi_estimate')]} showExpert={false} />)
    expect(screen.getAllByText(OLUMI)).toHaveLength(1)
    expect(screen.queryByTestId('trajectory-goal-caveat')).toBeNull()
  })
})

describe('the transition\'s goal delta carries the caveat of the figures it subtracts', () => {
  it('a delta between two estimate-based figures says so under the delta', () => {
    const [tr] = deriveTransitions([withGoal(1, 30, 'olumi_estimate'), withGoal(2, 38, 'olumi_estimate')])
    render(<TransitionCard transition={tr} startOpen showExpert={false} allDeltas={[]} />)
    const line = screen.getByText(/Goal probability: \+8pp/)
    expect(within(line).getByTestId('transition-goal-caveat').textContent).toBe(OLUMI)
  })

  it('no caveat on either figure → the delta line stands alone', () => {
    const [tr] = deriveTransitions([withGoal(1, 30, null), withGoal(2, 38, null)])
    render(<TransitionCard transition={tr} startOpen showExpert={false} allDeltas={[]} />)
    expect(screen.getByText(/Goal probability: \+8pp/)).toBeTruthy()
    expect(screen.queryByTestId('transition-goal-caveat')).toBeNull()
  })
})
