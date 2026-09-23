/**
 * SINGLE VERDICT — cross-surface agreement on "is there a leading option?"
 *
 * The end-to-end journey lane (parallel-briefs/END-TO-END-JOURNEY-2026-07-25.md)
 * caught the product contradicting itself in ONE screenshot on staging build
 * `27d002c9`:
 *
 *   - canvas option node:  "Most supported"  (+ "72% win probability")
 *   - results panel:       "no clear leading option, the result is sensitive
 *                           to your estimates" / "{winner} leads slightly
 *                           more often"
 *
 * Both surfaces read the SAME PLoT report. This spec proves it: it sets ONE
 * canvas-store state (one V2 run response, mapped by the product's own
 * `mapV2ResponseToReportV1`), then drives BOTH surfaces from it —
 *   · `OptionNode`               reads the store directly
 *   · `useResultsSectionData()`  reads the store directly, and its output is
 *                                the `data` prop `ResultsBody` consumes
 * — so nothing here mirrors a production derivation. The only fixture is the
 * run response; every verdict on screen is computed by product code.
 *
 * The invariant under test is not "these two strings match". It is:
 *
 *   **No two surfaces may disagree about whether a leading option exists.**
 *
 * i.e. it is never simultaneously true that one surface asserts a leading
 * option and another denies one, for a single analysis run.
 *
 * ⚠ RE-POINTED AND NARROWED (PX-C analysis-cockpit consolidation) — declared
 * here because silently narrowing a guard is how a guard stops biting
 * (CLAUDE.md 13b).
 *
 * WHAT CHANGED: the results side used to be read from
 * `DecisionConfidencePanel`, which lived on an analysis-hero flag arm the
 * deployed posture never mounted. Both the panel and the flag are deleted. The probe now renders `ResultsBody` itself, so the
 * canvas-vs-results invariant is measured on the surface users actually load
 * rather than on a dark one. That half is STRICTLY STRONGER.
 *
 * WHAT WAS LOST: the deleted panel carried TWO independent verdict claims —
 * a headline that could deny a leading option (`certaintyCopy` rule 1, "no
 * clear leading option, …") and the T1 checks footer's tick. The final
 * assertion of the matrix compared them to each other INSIDE one panel. The
 * headline is gone with its host, so that comparison has one subject left and
 * is not reconstructed as a tautology against itself. It is replaced by the
 * honest weaker property the surviving footer can still carry: the footer
 * states EXACTLY ONE verdict — never both labels, never neither.
 *
 * ⚠ AND A SECOND BLOCK LEFT WITH THE V7 RETIREMENT — declared for the same
 * reason. This file also carried "R1 — the V7 goal lens designates the GOAL
 * leader, not the comparative one" (ROADMAP 2.233), a pair-agreement pin over
 * `buildV7Lenses` and `buildV7Headline` rendered together by `V7TopMatter`.
 * BOTH builders and their host are deleted, so both subjects of that agreement
 * are gone and there is no pair left to disagree. The rule the pair was
 * enforcing — the goal designation is the goal ARGMAX, honestly gated, never
 * the comparative leader — lives on in its shared authority
 * `utils/selectGoalLeader.ts`, pinned by
 * `analysis-hero/__tests__/buildHeroModel.goalFitIdentity.spec.tsx` on the
 * surviving host. The canvas-vs-results block below is untouched.
 *
 * ⚠ RE-POINTED ON THE CANVAS SIDE ONLY — ED #63 5799353114 DECISION 1 (23 Sep
 * 2026): "Drop 'Most supported'. It reads as a recommendation." The canvas card
 * no longer names a leader on ANY run, so the old two-directional agreement
 * ("the canvas badges exactly when the panel does not deny") cannot hold and
 * is not meant to: the panel owns the comparative claim. What survives on the
 * canvas side is the half that was always the harm — the canvas never asserts
 * a leader — now asserted on EVERY row of the matrix, each time with a
 * same-render contrast control (both cards and their "N% of runs" rows are on
 * screen). The panel-side assertions (its denial probe and the checks footer
 * stating exactly one verdict) are unchanged.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { ResultsBody } from '../ResultsBody'
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

/** The canvas probe's claim detector: the text a user reads, or the pill by identity. */
const LEADER_CLAIM_TEXT = /Most supported/i
const LEADER_CLAIM_SELECTOR = '[data-testid^="leading-option-pill-"], [data-testid^="leading-option-robustness-"]'

/**
 * What the CANVAS says: does any option node claim to be the leading option?
 * Returns the claim AND the contrast control from the same render — both option
 * labels and both "N% of runs" result rows — so "no claim" can never be read
 * off a canvas that failed to render.
 */
function readCanvas(): { claims: boolean; rendered: boolean; text: string } {
  const { container } = render(
    <ReactFlowProvider>
      {OPTION_NODES.map(n => <OptionNode key={n.id} {...nodeProps(n.id)} />)}
    </ReactFlowProvider>,
  )
  const text = container.textContent ?? ''
  const rendered = OPTION_NODES.every(n =>
    text.includes(n.data.label) &&
    /% of runs$/.test(container.querySelector(`[data-testid="option-win-readout-${n.id}"]`)?.textContent ?? ''),
  )
  return {
    claims: LEADER_CLAIM_TEXT.test(text) || container.querySelector(LEADER_CLAIM_SELECTOR) !== null,
    rendered,
    text,
  }
}


/**
 * What the RESULTS SURFACE says — the whole cockpit, as a user loads it.
 *
 * The verdict claim read here is the T1 checks footer's tick, rendered by
 * `TriageActionCardsBody` inside the cockpit's act-on-it section: "Has leading
 * option" / "No clear leader". It is the results side's statement of whether a
 * leading option exists, and it must agree with the canvas badge.
 */
function readPanel(): { denies: boolean; footerTicksWinner: boolean; text: string } {
  const { result } = renderHook(() => useResultsSectionData())
  const { container } = render(
    <ResultsBody
      resultsSectionData={result.current}
      tornadoData={{ rows: [], expectedOutcome: null }}
    />,
  )
  const text = container.textContent ?? ''
  return {
    denies: /No clear leader/i.test(text),
    // Legacy copy: the tick read "Has leading option"; the failing state read
    // "No clear leader".
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
  it('the journey run (72% vs 20%, stability 0.55) does not produce both "Most supported" and "no clear leading option"', () => {
    setStore(JOURNEY_RUN)
    const canvas = readCanvas()
    const canvasClaims = canvas.claims
    document.body.innerHTML = ''
    const panel = readPanel()

    // Contrast control: the canvas DID render both cards, so a silent canvas
    // here is the card's (ED #63 5799353114 decision 1), not a dead render.
    expect(canvas.rendered, `the canvas did not render both cards.\nText: ${canvas.text.slice(0, 400)}`).toBe(true)
    expect(
      canvasClaims && panel.denies,
      `Contradiction: canvas badge says "Most supported" while the results panel says "no clear leading option".\nPanel text: ${panel.text.slice(0, 400)}`,
    ).toBe(false)
  })

  // ── Positive controls: the probe can SEE both claims ────────────────────
  it('CANVAS PROBE CONTROLS: it sees the cards, and its claim detector can fire', () => {
    // WAS "the canvas probe can see a leading-option claim on a clear, robust
    // run". That claim is retired (ED #63 5799353114 decision 1), so the probe
    // is controlled two other ways: (a) on the clear, robust run — the retired
    // badge's strongest case — it SEES both cards and their result rows while
    // finding no claim; (b) its detector fires on the exact strings and ids the
    // retired pill carried, so "no claim" is not a detector that cannot match.
    setStore(CLEAR_RUN)
    const canvas = readCanvas()
    expect(canvas.rendered, `the canvas did not render both cards.\nText: ${canvas.text.slice(0, 400)}`).toBe(true)
    expect(canvas.claims, 'the canvas card named a leader (ED #63 5799353114 decision 1)').toBe(false)
    expect(LEADER_CLAIM_TEXT.test('Last run · Most supported')).toBe(true)
    const probe = document.createElement('div')
    probe.innerHTML = `<span data-testid="leading-option-pill-${WINNER_ID}"></span>`
    expect(probe.querySelector(LEADER_CLAIM_SELECTOR)).not.toBeNull()
  })

  it('POSITIVE CONTROL: the results probe can see a "No clear leader" denial on a genuinely tied run', () => {
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

  it.each(MATRIX)('$label — the canvas makes no leader claim; the panel states exactly one verdict', ({ s }) => {
    setStore(s)
    const canvas = readCanvas()
    document.body.innerHTML = ''
    const panel = readPanel()
    // ⭐ CANVAS SIDE, RE-POINTED (ED #63 5799353114 decision 1). This was
    // `canvasClaims === !panel.denies` — the canvas badged exactly when the
    // panel did not deny. The canvas card now names no leader on ANY run; the
    // panel owns the claim. So the canvas can never contradict a denial, and
    // is asserted silent on every row — after the contrast control that both
    // cards and their result rows rendered in the same render.
    expect(canvas.rendered, `the canvas did not render both cards.\nText: ${canvas.text.slice(0, 400)}`).toBe(true)
    expect(
      canvas.claims,
      `The canvas card named a leader (ED #63 5799353114 decision 1). Panel denied: ${panel.denies}.\nCanvas text: ${canvas.text.slice(0, 400)}`,
    ).toBe(false)
    // The checks footer states EXACTLY ONE verdict — it must never print
    // both labels, and never neither. (This replaces the deleted panel's
    // headline-vs-footer comparison; see the file header for why it is not
    // reconstructed.)
    expect(
      panel.footerTicksWinner,
      `The checks footer printed both verdict labels, or neither.\nSurface text: ${panel.text.slice(0, 400)}`,
    ).toBe(!panel.denies)
  })
})
