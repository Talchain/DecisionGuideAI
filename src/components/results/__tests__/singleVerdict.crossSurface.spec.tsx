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
}

const JOURNEY_RUN: Scenario = { winnerWin: 0.72, runnerUpWin: 0.20, stability: 0.55 }

/** A genuinely indeterminate run — the case where "no clear leader" is TRUE. */
const TIED_RUN: Scenario = { winnerWin: 0.52, runnerUpWin: 0.48, stability: 0.55 }

/** A clear, robust run — the case where "leading option" is TRUE. */
const CLEAR_RUN: Scenario = { winnerWin: 0.72, runnerUpWin: 0.20, stability: 0.92 }

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
 *  - the T1 checks footer, which ticks "Winner" / "No winner"
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
    // reads "Winner"; the failing state reads "No winner".
    footerTicksWinner: /(^|[^o])Winner/.test(text) && !/No winner/i.test(text),
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
    { label: 'tied, robust', s: { winnerWin: 0.52, runnerUpWin: 0.48, stability: 0.92 } },
    { label: 'narrow lead just under the gap threshold', s: { winnerWin: 0.54, runnerUpWin: 0.46, stability: 0.75 } },
    { label: 'narrow lead just over the gap threshold', s: { winnerWin: 0.56, runnerUpWin: 0.44, stability: 0.75 } },
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
