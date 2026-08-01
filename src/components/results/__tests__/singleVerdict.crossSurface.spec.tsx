/**
 * SINGLE VERDICT — cross-surface agreement on "is there a leading option?"
 *
 * The end-to-end journey lane (parallel-briefs/END-TO-END-JOURNEY-2026-07-25.md)
 * caught the product contradicting itself in ONE screenshot on staging build
 * `27d002c9`:
 *
 *   - canvas option node:  "Leading option"  (+ "72% win probability")
 *   - results panel:       "no clear leading option, the result is sensitive
 *                           to your estimates" / "{winner} leads slightly
 *                           more often"
 *
 * Both surfaces read the SAME PLoT report. This spec proves it: it sets ONE
 * canvas-store state (one V2 run response, mapped by the product's own
 * `mapV2ResponseToReportV1`), then drives BOTH surfaces from it —
 *   · `OptionNode`               reads the store directly
 *   · `useResultsSectionData()`  reads the store directly, and its output is
 *                                the `data` prop `DecisionConfidencePanel`
 *                                consumes
 * — so nothing here mirrors a production derivation. The only fixture is the
 * run response; every verdict on screen is computed by product code.
 *
 * The invariant under test is not "these two strings match". It is:
 *
 *   **No two surfaces may disagree about whether a leading option exists.**
 *
 * i.e. it is never simultaneously true that one surface asserts a leading
 * option and another denies one, for a single analysis run.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import { OptionNode } from '../../../canvas/nodes/OptionNode'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import { buildV7Lenses } from '../v7/buildV7Lenses'
import { buildV7Headline } from '../v7/buildV7Headline'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// ── The journey's run, to the numbers it reported ──────────────────────────
// "Double Down on Wholesale ... 72% win probability", runner-up 20%, and a
// recommendation stability low enough that certaintyCopy's Rule 1 fires
// (`recommendationStability < 0.70`).
const WINNER_ID = 'opt_wholesale'
const RUNNER_UP_ID = 'opt_retail'

interface Scenario {
  winnerWin: number
  runnerUpWin: number
  stability: number
  /**
   * PLoT's OWN tie call (`robustness.near_tie.is_tie`, from `computeNearTie`).
   *
   * ROADMAP 1.223: the UI no longer derives "is there a leading option?" from
   * the win-probability gap — the producer states it and every surface quotes
   * it. So each scenario now carries the producer verdict the gap used to
   * imply, and the values below are exactly what PLoT's 0.10 threshold
   * produces for these numbers. The INVARIANT under test is untouched: no two
   * surfaces may disagree about whether a leading option exists.
   */
  isTie: boolean
}

/**
 * The journey run: a 52-point lead that is FRAGILE. `isTie: false` is the
 * point of this scenario — low stability means the ranking could flip, NOT
 * that the options are tied, and the product must not trade one for the other.
 */
const JOURNEY_RUN: Scenario = { winnerWin: 0.72, runnerUpWin: 0.20, stability: 0.55, isTie: false }

/** A genuinely indeterminate run — the case where "no clear leader" is TRUE. */
const TIED_RUN: Scenario = { winnerWin: 0.52, runnerUpWin: 0.48, stability: 0.55, isTie: true }

/** A clear, robust run — the case where "leading option" is TRUE. */
const CLEAR_RUN: Scenario = { winnerWin: 0.72, runnerUpWin: 0.20, stability: 0.92, isTie: false }

function makeV2Response(s: Scenario): V2RunResponse {
  const outcome = (mean: number) => ({
    mean,
    std: 12,
    p10: mean - 20,
    p50: mean,
    p90: mean + 20,
    n_samples: 1000,
    n_valid_samples: 1000,
    validity_ratio: 1,
  })
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: WINNER_ID,
        option_label: 'Double Down on Wholesale',
        confidence_interval: [40, 80],
        win_probability: s.winnerWin,
        outcome: outcome(60),
      },
      {
        option_id: RUNNER_UP_ID,
        option_label: 'Open Retail Shop',
        confidence_interval: [20, 60],
        win_probability: s.runnerUpWin,
        outcome: outcome(40),
      },
    ],
    critiques: [],
    drivers: [],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: {
      fragile_edges: [],
      robust_edges: ['e1'],
      recommended_option_id: WINNER_ID,
      recommendation_stability: s.stability,
      // The producer's own leader verdict — the only authority entitled to
      // answer "is there a leading option?" (ROADMAP 1.223). Carried through
      // to the UI by the V2 responseMapper's near_tie passthrough.
      near_tie: {
        is_tie: s.isTie,
        top_option_id: WINNER_ID,
        second_option_id: RUNNER_UP_ID,
        gap: s.winnerWin - s.runnerUpWin,
        threshold: 0.1,
      },
    } as never,
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as V2RunResponse
}

const OPTION_NODES = [
  {
    id: WINNER_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', type: 'option', label: 'Double Down on Wholesale' },
  },
  {
    id: RUNNER_UP_ID,
    type: 'option',
    position: { x: 400, y: 0 },
    data: { kind: 'option', type: 'option', label: 'Open Retail Shop' },
  },
]

function setStore(s: Scenario): void {
  const v2 = makeV2Response(s)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapV2ResponseToReportV1(v2, { seed: 42 }) },
    runMeta: {},
    nodes: OPTION_NODES,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: v2,
    goalThreshold: null,
    viewMode: 'expert',
  } as never)
}

type OptionNodeProps = Parameters<typeof OptionNode>[0]

const nodeProps = (id: string): OptionNodeProps => ({
  id,
  type: 'option',
  data: OPTION_NODES.find(n => n.id === id)!.data,
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
} as unknown as OptionNodeProps)

/** What the CANVAS says: does any option node claim to be the leading option? */
function canvasAssertsLeadingOption(): boolean {
  const { container } = render(
    <ReactFlowProvider>
      {OPTION_NODES.map(n => <OptionNode key={n.id} {...nodeProps(n.id)} />)}
    </ReactFlowProvider>,
  )
  return /Leading option/i.test(container.textContent ?? '')
}

/**
 * What the PANEL says. Two independent claims live in this one component:
 *  - the headline, which may DENY a leading option ("no clear leading option")
 *  - the T1 checks footer, which ticks "Has leading option" / "No clear
 *    leader" (the legacy "Winner" / "No winner" arm was deleted, §6.2g)
 * They must agree with each other and with the canvas.
 */
function readPanel(): { denies: boolean; footerTicksWinner: boolean; text: string } {
  const { result } = renderHook(() => useResultsSectionData())
  const { container } = render(
    <DecisionConfidencePanel data={result.current} />,
  )
  const text = container.textContent ?? ''
  return {
    denies: /no clear leading option/i.test(text),
    // Legacy copy (analysisHeroV17 off, which is staging's posture): the tick
    // reads "Has leading option"; the failing state reads "No clear leader".
    // SUPERSEDED 2026-07-31 (§6.2g): the footer's legacy "Winner" / "No
    // winner" arm is DELETED — `useV17Copy` already selected the compliant
    // labels on every live path, and the legacy strings survived only as the
    // false arm of a ternary. The probe reads the labels the footer actually
    // renders now. The GUARD is unchanged: footer and headline must still
    // agree inside one panel.
    footerTicksWinner:
      /Has leading option/.test(text) && !/No clear leader/i.test(text),
    text,
  }
}

describe('SINGLE VERDICT — canvas and results panel must not contradict each other', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as never)
    document.body.innerHTML = ''
  })

  // ── The reported defect ────────────────────────────────────────────────
  it('the journey run (72% vs 20%, stability 0.55) does not produce both "Leading option" and "no clear leading option"', () => {
    setStore(JOURNEY_RUN)
    const canvasClaims = canvasAssertsLeadingOption()
    document.body.innerHTML = ''
    const panel = readPanel()

    expect(
      canvasClaims && panel.denies,
      `Contradiction: canvas badge says "Leading option" while the results panel says "no clear leading option".\nPanel text: ${panel.text.slice(0, 400)}`,
    ).toBe(false)
  })

  // ── Positive controls: the probe can SEE both claims ────────────────────
  it('POSITIVE CONTROL: the canvas probe can see a leading-option claim on a clear, robust run', () => {
    setStore(CLEAR_RUN)
    expect(canvasAssertsLeadingOption()).toBe(true)
  })

  it('POSITIVE CONTROL: the panel probe can see a "no clear leading option" denial on a genuinely tied run', () => {
    setStore(TIED_RUN)
    expect(readPanel().denies).toBe(true)
  })

  it('POSITIVE CONTROL: the checks-footer probe can see both states', () => {
    setStore(CLEAR_RUN)
    expect(readPanel().footerTicksWinner).toBe(true)
    document.body.innerHTML = ''
    setStore(TIED_RUN)
    expect(readPanel().footerTicksWinner).toBe(false)
  })

  // ── The invariant, over the whole matrix ────────────────────────────────
  const MATRIX: Array<{ label: string; s: Scenario }> = [
    { label: 'clear lead, robust', s: CLEAR_RUN },
    { label: 'clear lead, fragile (the journey run)', s: JOURNEY_RUN },
    { label: 'tied, fragile', s: TIED_RUN },
    { label: 'tied, robust', s: { winnerWin: 0.52, runnerUpWin: 0.48, stability: 0.92, isTie: true } },
    // The two boundary rows keep straddling PLoT's 0.10 threshold (gap 0.08
    // vs 0.12), so the matrix still exercises both sides of the producer's
    // own tie call — it is simply the producer making it now, not the UI.
    { label: 'narrow lead just under the gap threshold', s: { winnerWin: 0.54, runnerUpWin: 0.46, stability: 0.75, isTie: true } },
    { label: 'narrow lead just over the gap threshold', s: { winnerWin: 0.56, runnerUpWin: 0.44, stability: 0.75, isTie: false } },
  ]

  it.each(MATRIX)('$label — canvas and panel agree on whether a leading option exists', ({ s }) => {
    setStore(s)
    const canvasClaims = canvasAssertsLeadingOption()
    document.body.innerHTML = ''
    const panel = readPanel()
    // Agreement in BOTH directions: the canvas badges exactly when the panel
    // does not deny. A one-directional check would pass a build where the
    // canvas went silent while the panel asserted a leader.
    expect(
      canvasClaims,
      `Surfaces disagree. Canvas badged: ${canvasClaims}; panel denied: ${panel.denies}.\nPanel text: ${panel.text.slice(0, 400)}`,
    ).toBe(!panel.denies)
    // Third surface, same screen: the panel's own checks footer.
    expect(
      panel.footerTicksWinner,
      `The checks footer and the headline disagree inside ONE panel.\nPanel text: ${panel.text.slice(0, 400)}`,
    ).toBe(!panel.denies)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R1 (ROADMAP 2.233 review) — THE HERO HEADLINE AND THE GOAL LENS BENEATH IT
// MUST DESIGNATE THE SAME OPTION. This file exists for exactly this class:
// two surfaces rendered together (`V7TopMatter.tsx:68,76`) disagreeing.
//
// THE REGRESSION THIS PINS WAS CREATED BY 2.233's OWN FIX. At base both said the
// COMPARATIVE leader — consistently wrong. Fixing only the headline made the
// pair CONTRADICTORY.
//
// ⚠ IT WENT UNPINNED FOR THE SAME REASON THE HEADLINE DEFECT DID:
// `buildV7Lenses.spec.ts:123-124` hands the highest goal probability to the very
// option it marks `isWinner`, so the two can never disagree there — the
// identical incomplete-fixture weakness found and fixed in the headline spec,
// repeated one file over. The fixture below DELIBERATELY disagrees.
// ─────────────────────────────────────────────────────────────────────────────
describe('R1 — the V7 goal lens designates the GOAL leader, not the comparative one', () => {
  const A = {
    id: 'opt_a', label: 'Option A', winProbability: 0.7, goalProbability: 0.4,
    isRecommended: true, goalFitIsSubstitutedJoint: false,
  }
  const B = {
    id: 'opt_b', label: 'Option B', winProbability: 0.3, goalProbability: 0.8,
    goalFitIsSubstitutedJoint: false,
  }

  function goalLensFor(options: unknown[], recommendedId: string) {
    return buildV7Lenses({
      recommendation: {
        allOptions: options,
        recommendedOption: options.find((o) => (o as { id: string }).id === recommendedId),
        goalThreshold: 100,
      },
      drivers: { drivers: [] },
      confidence: {},
      voiRanking: null,
    } as never).goal
  }

  it('THE DISAGREEING CASE: the row marked isWinner is the goal argmax (B), not the recommended option (A)', () => {
    const goal = goalLensFor([A, B], 'opt_a')
    const marked = goal.options.filter((o) => o.isWinner)
    expect(marked).toHaveLength(1)
    expect(marked[0].id).toBe('opt_b')
    expect(goal.options.find((o) => o.id === 'opt_a')?.isWinner).toBe(false)
  })

  it('the lens agrees with the HEADLINE on the same data — one subject, one designation', () => {
    const goal = goalLensFor([A, B], 'opt_a')
    const headline = buildV7Headline(
      { recommendedOption: A, allOptions: [A, B], goalThreshold: 100 } as never,
      'robust',
    )
    expect(goal.options.find((o) => o.isWinner)?.label).toBe('Option B')
    expect(headline.headline).toContain('Option B')
    // The pair that must never recur: headline names one option, lens bolds another.
    expect(headline.headline).not.toContain('Option A has the highest')
  })

  it('OVER-SUPPRESSION CONTROL: when the two leaders AGREE, the row is still marked', () => {
    const goal = goalLensFor([{ ...A, goalProbability: 0.9 }, B], 'opt_a')
    expect(goal.options.find((o) => o.isWinner)?.id).toBe('opt_a')
  })

  it('no honest goal leader (a TIE at the top) ⇒ NO row is marked — never a fallback', () => {
    const goal = goalLensFor([A, { ...B, goalProbability: 0.4 }], 'opt_a')
    expect(goal.options.some((o) => o.isWinner)).toBe(false)
  })
})
