/**
 * ⛔ THE COMPARE TAB'S CONDITIONAL LINE PRINTED `split_unit` RAW:
 * "When Enterprise tier availability exceeds 0.5 binary, support moves to …".
 *
 * `extractConditionalWinners` assembles `conditionalWinners[].condition` from
 * the producer row, appending ` ${split_unit}` with no filter. `split_unit` is
 * ISL's `node.observed_state.unit` (`robustness_analyzer_v2.py:6086-6090`, ISL
 * `staging` `c00f5077`), which can carry the factor-TYPE descriptor "binary".
 *
 * ⚠ WHAT `condition` IS, READ BEFORE CHANGING IT. It is display prose, not an
 * identity or comparison key:
 *   · its one reader is `deriveTransitions.findConditionalWinner`, which
 *     matches the row by `factorId`, tests `condition === ''` (never true: the
 *     string always begins "When …"), and interpolates it into
 *     `transition.conditionalWinner` — rendered verbatim by `TransitionCard`;
 *   · run identity is `responseHash` / `runId` (`analysisSnapshotStore`), never
 *     this string;
 *   · the snapshot store is in-memory, and a persisted run is REBUILT through
 *     this same factory from the stored PLoT envelope, so no stored copy of the
 *     sentence exists to fall out of step.
 * So the owner's rule (`isSuppressedUnit`) is applied where the sentence is
 * made, and the stored producer data is untouched.
 *
 * ⭐ THE CONTRAST: a fix that dropped every `split_unit` would pass the binary
 * half, so a real unit ('£') must still reach both the factory's sentence and
 * the transition line the Compare tab renders.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import { deriveTransitions } from '../../compare-tab/deriveTransitions'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

const BINARY = /binary/i

const nodes: Node[] = [
  { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Enterprise tier availability' } },
]
const edges: Edge[] = []

function build(rawOverrides: Record<string, unknown>, runNumber = 1) {
  return buildAnalysisSnapshot({
    rawV2Response: {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'unavailable',
      drivers_status: 'unavailable',
      option_comparison: [
        {
          option_id: 'opt-a',
          option_label: 'Hold price',
          win_probability: 0.6,
          confidence_interval: [0.3, 0.7],
          expected_outcome: 0.5,
        },
      ],
      critiques: [],
      response_hash: `resp-${runNumber}`,
      ...rawOverrides,
    } as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges,
    runNumber,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

/** A live-shaped (root-slot) producer row, differing only in `split_unit`. */
const cwRow = (splitUnit: string | undefined) => [
  {
    factor_id: 'n1',
    factor_label: 'Enterprise tier availability',
    split_value: 0.5,
    ...(splitUnit !== undefined ? { split_unit: splitUnit } : {}),
    winner_flips: true,
    low_bucket: { winner_id: 'opt-a', winner_label: 'Hold price' },
    high_bucket: { winner_id: 'opt-b', winner_label: 'Raise price' },
  },
]

/** By FACTOR ID, so an absence of "binary" can never be the absence of the row. */
function conditionOf(splitUnit: string | undefined): string {
  const snap = build({ conditional_winners: cwRow(splitUnit) })
  const found = snap.conditionalWinners.find((cw) => cw.factorId === 'n1')
  expect(found, 'precondition: the conditional-winner row reaches the snapshot').toBeDefined()
  return found!.condition
}

/** The line the Compare tab's TransitionCard renders verbatim. */
function transitionLineOf(splitUnit: string | undefined): string {
  // n1's elasticity moves >20% so it is an AFFECTED factor and
  // findConditionalWinner can match the row (same setup as rootSiblings.spec).
  const factors = (elasticity: number) => [
    { node_id: 'n1', factor_label: 'Enterprise tier availability', elasticity, rank_flip_rate: 0.1 },
  ]
  const from = build({ factor_sensitivity: factors(0.4) }, 1)
  const to = build({ factor_sensitivity: factors(0.6), conditional_winners: cwRow(splitUnit) }, 2)
  const [t] = deriveTransitions([from, to])
  expect(t.conditionalWinner, 'precondition: the transition carries the conditional line').not.toBeNull()
  return t.conditionalWinner!
}

describe('analysisSnapshotFactory — a factor-type descriptor is never a unit in `condition`', () => {
  it('⛔ a binary-typed split states the value, never "binary" (by identity: the unit-less sentence)', () => {
    const condition = conditionOf('binary')
    expect(condition).not.toMatch(BINARY)
    expect(condition).toBe(conditionOf(undefined))
    expect(condition).toBe('When Enterprise tier availability exceeds 0.5')
  })

  it('⛔ the descriptor is suppressed whatever its case', () => {
    expect(conditionOf('Binary')).not.toMatch(BINARY)
  })

  it('⛔ the Compare transition line carries no "binary"', () => {
    const line = transitionLineOf('binary')
    expect(line).not.toMatch(BINARY)
    expect(line).toBe('When Enterprise tier availability exceeds 0.5, support moves to Raise price')
  })

  it('⭐ CONTRAST: a real unit still prints, in the snapshot and on the transition line', () => {
    expect(conditionOf('£')).toBe('When Enterprise tier availability exceeds 0.5 £')
    expect(transitionLineOf('£')).toBe(
      'When Enterprise tier availability exceeds 0.5 £, support moves to Raise price',
    )
  })
})
