/**
 * THE REASONING TAB STATES A COMPARISON AS A FINDING ABOUT THE MODEL, NEVER AS
 * AN ANSWER OR A RECOMMENDATION.
 *
 * Ruling, olumi-programme-docs#63 (comment 5792267559):
 *   "Reasoning does not recommend an option. A leader/rank/sensitivity is a
 *    model-relative finding. Prefer language such as 'In this model…' / 'Under
 *    these assumptions…' over winner/should/best-option framing."
 *   "Any leader/comparison visual must explicitly remain model-relative and
 *    conditional."
 *
 * The at-risk strings come from the doctrine copy bank (evidence file 12). Each
 * one is asserted BY IDENTITY: the exact sentence the real copy function, view
 * model, hook or component emits. A value predicate ("contains 'model'") could
 * be satisfied by some other sentence, so it is not used for the presence half.
 *
 * The absence half is only meaningful beside the presence half: every output
 * below is first shown to be the new, non-empty sentence, and only then shown
 * to carry none of the retired answer-framing phrases.
 *
 * ⚠ SCOPE: UI-authored copy only. Producer (CEE/PLoT) prose, the verdict words
 * Stable / Mixed / Sensitive, and the Should fix / Could fix labels are out of
 * scope and are not asserted here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { WhatsChanged, WHATS_CHANGED_TESTID } from '../sections/WhatsChanged'
import { buildRunDeltaView } from '../runDeltaView'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import type { ConditionalWinner, UncertaintyItem } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  genuineDecision,
  makeData,
  makeDriver,
  uncertaintyDerivedFindings,
} from './analysisNewFixtures'

afterEach(() => cleanup())

/** The answer-framing phrases the ruling retires from these outputs. */
const RETIRED = [
  /comes out ahead/i,
  /\bthe answer\b/i,
  /better choice/i,
  /ahead of the others/i,
  /scored highest/i,
  /scoring highest/i,
  /answers which option/i,
] as const

function expectModelRelative(actual: string, expected: string): void {
  // Presence, by identity.
  expect(actual).toBe(expected)
  // The sentence names the model it is relative to.
  expect(actual).toMatch(/in this model/i)
  // Absence, only now meaningful.
  for (const phrase of RETIRED) {
    expect(actual, `"${actual}" still carries ${phrase}`).not.toMatch(phrase)
  }
}

const build = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

// ─────────────────────────────────────────────────────────────────────────────
// Answer zone: At a glance
// ─────────────────────────────────────────────────────────────────────────────
describe('At a glance', () => {
  it('the share sentence is model-relative and still names no option', () => {
    const share = build(genuineDecision()).atAGlance.winShare
    expect(share, 'the entitled fixture no longer yields a share').not.toBeNull()
    expectModelRelative(
      share!,
      'In this model, one option had the highest score in 69% of simulated futures.',
    )
    expect(share).not.toMatch(/Raise price|Hold price/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// "What your model implies"
// ─────────────────────────────────────────────────────────────────────────────
describe('What your model implies', () => {
  it('the aligned lead', () => {
    expectModelRelative(
      COPY.implications.alignedLead('Raise price'),
      'In this model, Raise price is most likely on both readings of this run.',
    )
  })

  it('reading one: the highest expected outcome', () => {
    expectModelRelative(
      COPY.implications.outcomeClaim('Raise price', '120'),
      'In this model, Raise price has the highest expected outcome: 120.',
    )
  })

  it('reading two: the goal claim', () => {
    expectModelRelative(
      COPY.implications.goalClaim('Raise price', '40%'),
      'In this model, Raise price has the highest chance of meeting every target this run scored: 40%.',
    )
  })

  it('the unlock says what a target would SHOW, not that the run answers', () => {
    expectModelRelative(
      COPY.implications.needsTargetUnlock,
      'Set a success target and the same run also shows which option is most likely to hit it in this model. That second reading can disagree with this one.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// "How the options compare"
// ─────────────────────────────────────────────────────────────────────────────
describe('How the options compare', () => {
  it('the partition caption', () => {
    expectModelRelative(
      COPY.optionFigures.partitionCaption,
      'In this model, every simulated scenario is accounted for above.',
    )
  })

  it('the comparative-share label', () => {
    expectModelRelative(COPY.optionFigures.winLabel, 'Highest in this model')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// "What would change your mind"
// ─────────────────────────────────────────────────────────────────────────────
describe('What would change your mind', () => {
  it('the tipping point', () => {
    expectModelRelative(
      COPY.disclosure.tippingPoint('Tech Lead Presence', 60, 96, 'Two Developers', '£'),
      'Tech Lead Presence would have to rise from £60 to £96 before Two Developers leads in this model.',
    )
  })

  it('the convergence line stays a conditional', () => {
    const line = COPY.disclosure.convergence('Hold Price')
    expectModelRelative(
      line,
      'If any of these is wrong, they all point the same way in this model: towards Hold Price.',
    )
    expect(line.startsWith('If any of these is wrong')).toBe(true)
  })

  it('a threshold row names what the variable could change', () => {
    const rows = uncertaintyDerivedFindings(
      build(
        makeData({
          confidence: {
            evidenceGapsAssessed: true,
            uncertainties: [
              {
                code: 'SENSITIVE_ASSUMPTION',
                message: 'Capacity is the assumption this comparison is most sensitive to.',
                displayText: 'Capacity is the assumption this comparison is most sensitive to.',
                affectedNodes: ['fac_capacity'],
                threshold: { variable: 'Peak Fulfilment Capacity', direction: 'negative', value: 0.42 },
              } as UncertaintyItem,
            ],
          },
        }),
      ),
    )
    expect(rows).toHaveLength(1)
    expectModelRelative(
      rows[0]!.headline,
      'Peak Fulfilment Capacity could change which option leads in this model',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The fragile-edge fallback sentence, composed by the real hook
// ─────────────────────────────────────────────────────────────────────────────
describe('the fragile-edge fallback sentence', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: { status: 'idle', report: null } } as never)
  })

  it('both forms, from one template', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          flip_thresholds: [],
          robustness: {
            fragile_edges: [
              {
                edge_id: 'e-1',
                from_id: 'fac_price',
                from_label: 'Pro Plan Monthly Price',
                to_id: 'fac_mrr',
                to_label: 'Monthly Recurring Revenue',
                switch_probability: 0.73,
                severity: 'warning',
                alternative_winner_id: 'opt_a',
                alternative_winner_label: 'Hold Price',
              },
            ],
            robust_edges: [],
          },
        },
      },
      runMeta: {},
      nodes: [
        { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Hold Price' } },
        { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Raise Price' } },
      ],
      edges: [],
      hasCompletedFirstRun: true,
      rawV2Response: null,
    } as never)

    const { result } = renderHook(() => useResultsSectionData())
    const rows = (result.current.confidence?.uncertainties ?? []).filter(
      (u) => u.code === 'SENSITIVE_ASSUMPTION',
    )
    expect(rows).toHaveLength(1)
    expectModelRelative(
      rows[0]!.displayText ?? '',
      'If "Pro Plan Monthly Price → Monthly Recurring Revenue" changes significantly, "Hold Price" could lead in this model',
    )
    expectModelRelative(
      rows[0]!.messageWithSubjectNamedAbove ?? '',
      'If this changes significantly, "Hold Price" could lead in this model',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Inspect rows: "Chance the answer changes"
// ─────────────────────────────────────────────────────────────────────────────
describe('inspect rows', () => {
  const CHANCE = 'Chance another option leads in this model'

  it('the hinge insight', () => {
    const vm = build(
      makeData({
        confidence: {
          topFragileEdge: {
            fromId: 'fac_price',
            fromLabel: 'Price',
            toId: 'fac_mrr',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Hold Price',
            switchProbability: 0.31,
          },
        },
      }),
    )
    const hinge = vm.keyInsights.insights.find((i) => i.id === 'insight:hinge')
    expect(hinge, 'the hinge insight did not build — nothing below is tested').toBeDefined()
    const labels = hinge!.inspect.map((r) => r.label)
    expect(labels).toContain(CHANCE)
    for (const label of labels) {
      for (const phrase of RETIRED) expect(label).not.toMatch(phrase)
    }
    expectModelRelative(labels.find((l) => l === CHANCE)!, CHANCE)
  })

  it('a driver row carrying fragile-edge data', () => {
    const vm = build(
      makeData({
        drivers: {
          drivers: [
            makeDriver({
              factorKey: 'fac_price',
              factorLabel: 'Price',
              fragileEdgeInfo: { switchProbability: 0.31, alternativeWinnerLabel: 'Hold Price' },
            }),
          ],
        },
      }),
    )
    const finding = vm.drivers.findings[0]
    expect(finding, 'the driver row did not build — nothing below is tested').toBeDefined()
    const labels = finding!.inspect.map((r) => r.label)
    expect(labels).toContain(CHANCE)
    for (const label of labels) {
      for (const phrase of RETIRED) expect(label).not.toMatch(phrase)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Key insights: a conditional split
// ─────────────────────────────────────────────────────────────────────────────
describe('key insights', () => {
  it('a conditional split is a finding about the model', () => {
    const cw: ConditionalWinner = {
      factor_id: 'fac_demand',
      factor_label: 'Demand growth',
      split_value: 10,
      high_bucket: { winner_label: 'Raise price' },
      low_bucket: { winner_label: 'Hold price' },
    } as ConditionalWinner
    const vm = build(makeData({ confidence: { conditionalWinners: [cw] } }))
    const insight = vm.keyInsights.insights.find((i) => i.id === 'insight:conditional-winner:fac_demand')
    expect(insight, 'the conditional-split insight did not build').toBeDefined()
    expectModelRelative(insight!.headline, 'In this model, which option leads depends on Demand growth')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// "What's changed" — rendered, because the sentence is authored in the JSX
// ─────────────────────────────────────────────────────────────────────────────
describe("What's changed", () => {
  const LABELS: Record<string, string> = { opt_a: 'Raise the price', opt_b: 'Hold the price' }
  const delta = (leader: RunDelta['leader']): RunDelta =>
    ({
      attribution_case: 'C1_attributable',
      pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
      leader,
      win_probabilities: [{ option_id: 'opt_a', prior: 0.6, current: 0.7, noise_verdict: 'signal' }],
      flip_thresholds: [],
    }) as RunDelta
  const line = (leader: RunDelta['leader']): string => {
    render(createElement(WhatsChanged, { view: buildRunDeltaView(delta(leader), (id) => LABELS[id] ?? null) }))
    return screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`).textContent ?? ''
  }

  it('names both sides when both ids arrived', () => {
    expectModelRelative(
      line({ changed: true, noise_verdict: 'signal', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' }),
      'In this model, the option with the highest score moved from Raise the price to Hold the price.',
    )
  })

  it('names nobody when an id is missing', () => {
    expectModelRelative(
      line({ changed: true, noise_verdict: 'signal', current_leading_option_id: 'opt_b' }),
      'In this model, the option with the highest score is not the same one as last time.',
    )
  })
})
