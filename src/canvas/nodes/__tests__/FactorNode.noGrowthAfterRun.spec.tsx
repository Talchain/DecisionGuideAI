/**
 * ⭐⭐ A RUN NEVER GROWS A FACTOR CARD — the driver line has ONE reserved slot.
 *
 * SERVED DEFECT (witness on UI 03f60be0, pricing starter, 1280x800, one real
 * Run): the rank-1 factor `fac_top_account_concentration` grew 124.3 → 185.6px
 * on screen when the Run completed. Card text, verbatim from the capture:
 *   pre-run   "Top Account Revenue Concentration | Range: 0.2 to 0.6 | no source"
 *   post-run  "Top Account Revenue Concentration | Driver 1 of 5 analysed |
 *              No turning point in this run | Range: 0.2 to 0.6 | no source"
 * The layout reserves the height it measured before the Run, so two new rows
 * after it re-lay the board.
 *
 * RULING (Delivery Lead, #70 5849644637, 26 Sep 20:32Z), "because the
 * prototype does both":
 *   (a) reserve the driver line on every factor before a Run, reading
 *       "Working assumption · no analysis yet" (prototype `nodeHTML` factor
 *       branch: `row-meta` pre-run, `driver()` post-run, same place);
 *   (b) move "No turning point in this run" off the card, into the inspector
 *       (pinned in `inspector-v2/__tests__/FactorPanels.turningPointInInspector.spec.tsx`).
 *
 * TARGET, mirroring the option share slot (#2123, `OptionNode.noGrowthAfterRun.spec.tsx`):
 *   · ONE slot element per factor (`factor-driver-slot-<id>`), rendered in
 *     EVERY phase with identical classes — one `edgeLabel` line (`h-[1lh]`),
 *     `overflow-hidden`;
 *   · pre-run it reads the contract line on a factor that shows a value; it is
 *     empty and aria-hidden where the contract says nothing (a range-only or
 *     needs-input factor);
 *   · post-run the ranked factor's `Driver N of M ranked in this run` + bar fill it;
 *   · MG's #2123 B1 trap: a factor the Run does NOT rank keeps the SAME slot,
 *     empty and aria-hidden — never removed, so it cannot shrink either.
 *
 * FIXTURE: the served pricing starter's factor ids, labels, categories and
 * values (`starters/data/pricing-model.draft.json`, the board the witness
 * loaded), and the served post-run rank (`Driver 1 of 5 analysed` on
 * `fac_top_account_concentration` only) and its attested no-flip row (the
 * served "No turning point in this run" is the attested arm of
 * `TURNING_POINT_TRACK_COPY.none`).
 *
 * CLAIM SCOPE: jsdom proves element identity, class tokens and text — never
 * layout. On-screen heights are measured separately in real Chromium (PR body).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let metaById: Record<string, Record<string, unknown>> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn((id: string) => metaById[id]),
}))

const RANK_1 = 'fac_top_account_concentration'

// Served pricing starter factors (`pricing-model.draft.json`), in the store's shape.
const SERVED_FACTORS = [
  {
    id: 'fac_adoption_friction',
    data: {
      kind: 'factor', type: 'factor', label: 'Bottom-Up Adoption Friction', category: 'controllable',
      observedState: { value: 0.8, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
      display_value: 'Very high (0.8)', provenance: 'ai_inferred',
    },
  },
  {
    id: 'fac_enterprise_revenue_risk',
    data: {
      kind: 'factor', type: 'factor', label: 'Enterprise Revenue Cannibalization Risk', category: 'controllable',
      observedState: { value: 0, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
      display_value: 'Low (0)', provenance: 'ai_inferred',
    },
  },
  {
    id: 'fac_market_competition',
    data: {
      kind: 'factor', type: 'factor', label: 'Competitive Pressure for Usage Pricing', category: 'external',
      prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
      display_value: '0.3 to 0.8', provenance: 'ai_inferred',
    },
  },
  {
    id: RANK_1,
    data: {
      kind: 'factor', type: 'factor', label: 'Top Account Revenue Concentration', category: 'external',
      prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.6000000000000001 },
      extractionType: 'explicit', display_value: '0.2 to 0.6', provenance: 'from_brief',
    },
  },
  {
    id: 'fac_usage_exposure',
    data: {
      kind: 'factor', type: 'factor', label: 'Usage-Based Pricing Exposure', category: 'controllable',
      observedState: { value: 0, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
      encoding_map: { 0: 'No usage pricing', 1: 'Full usage pricing' },
      display_value: 'Low (0)', provenance: 'ai_inferred',
    },
  },
] as const
// The served pre-run value line shows a value on exactly these three.
const nodes = SERVED_FACTORS.map(f => ({ id: f.id, type: 'factor', position: { x: 0, y: 0 }, data: f.data }))

// Served post-run: only the top factor is ranked — "Driver 1 of 1 ranked in this
// run" since the ranked-count M (NODE-ANATOMY v3.2; served then as "Driver 1 of
// 5 analysed", which counted four factors no card ranked — DIFF item 3).
const SERVED_ORDER = [RANK_1, 'fac_enterprise_revenue_risk', 'fac_usage_exposure', 'fac_adoption_friction', 'fac_market_competition']
const meta = (id: string, ran: boolean, rankedCount = 1) => {
  const rank = SERVED_ORDER.indexOf(id) + 1
  return {
    sensitivityRank: ran ? rank : null, influence: ran ? [1, 0.7, 0.5, 0.3, 0.1][rank - 1] : null,
    influenceProvenance: 'influence_score', influenceImportanceBasis: null,
    influenceSetSize: ran ? 5 : null, influenceRankedCount: ran ? rankedCount : null,
    // The bar's figure (`rankFactor.relativeSensitivity`): rank 1 → 1.
    driverRelativeSensitivity: ran ? [1, 0.7, 0.5, 0.3, 0.1][rank - 1] : null,
    confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
    inSensitivityAnalysis: ran, achievementProbability: null,
    achievementProbabilityIsModelledBasis: false, stabilityPercentage: null, winRate: null,
    isResultsMode: ran, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  }
}

const SERVED_REPORT = {
  option_probabilities: {
    opt_full_switch: { status: 'computed', win_probability: 0.34 },
    opt_hybrid: { status: 'computed', win_probability: 0.004 },
    opt_new_logos: { status: 'computed', win_probability: 0.53 },
    opt_status_quo: { status: 'computed', win_probability: 0.13 },
  },
  robustness: { near_tie: { is_tie: false, top_option_id: 'opt_new_logos' } },
  // Attested: the producer searched and found no flip for the top factor.
  flip_thresholds: [{ node_id: RANK_1, label: 'Top Account Revenue Concentration', flip_reason: 'no_effect_within_bounds' }],
}

const seed = (phase: 'pre' | 'post', report: Record<string, unknown> = SERVED_REPORT, rankedCount = 1) => {
  const ran = phase === 'post'
  metaById = Object.fromEntries(SERVED_FACTORS.map(f => [f.id, meta(f.id, ran, rankedCount)]))
  useCanvasStore.setState({
    nodes, edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full', goalConstraints: [],
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'pricing-scenario',
    analysisFreshness: ran ? { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-26T20:27:28.000Z' } : null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: ran ? { scenarioId: 'pricing-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: ran,
    results: ran ? { status: 'complete', hash: 'run-1', report } : { status: 'idle', report: null },
  } as never)
}

const renderCard = (id: string) => {
  const n = nodes.find(x => x.id === id)!
  return render(
    <ReactFlowProvider>
      <FactorNode
        id={n.id} type="factor" data={n.data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

/** BaseNode's root for THIS card — the present control every absence needs. */
const card = (label: string) => {
  const title = screen.getByTestId('node-title')
  expect(title.textContent).toContain(label)
  return title.closest('[role="group"]') as HTMLElement
}
const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const slot = (id: string) => screen.queryByTestId(`factor-driver-slot-${id}`)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
})

describe('served pricing factors — the driver line has ONE slot, reserved before the run', () => {
  it.each(SERVED_FACTORS.map(f => [f.id, f.data.label] as const))(
    '%s: the pre-run slot and the post-run slot are the SAME element class, one edgeLabel line',
    (id, label) => {
      seed('pre')
      renderCard(id)
      const pre = slot(id)
      expect(pre, 'pre-run: the slot is reserved before any run').not.toBeNull()
      expect(within(card(label)).getByTestId(`factor-driver-slot-${id}`)).toBe(pre)
      const preClass = pre!.getAttribute('class')
      expect(tokens(pre!)).toContain('h-[1lh]')
      expect(tokens(pre!)).toContain('overflow-hidden')
      // The board says the pre-run state once; every card still reserves its slot.
      expect(pre!.textContent).toBe('')
      expect(pre!.getAttribute('aria-hidden')).toBe('true')
      cleanup()

      seed('post')
      renderCard(id)
      const post = slot(id)
      expect(post, 'post-run: the SAME slot').not.toBeNull()
      expect(within(card(label)).getByTestId(`factor-driver-slot-${id}`)).toBe(post)
      expect(post!.getAttribute('class')).toBe(preClass)
      expect(post!.textContent).not.toContain('no analysis yet')
    },
  )

  it('fac_top_account_concentration post-run: "Driver 1 of 1 ranked in this run" + its bar fill the reserved slot, on one line', () => {
    seed('post')
    renderCard(RANK_1)
    const s = slot(RANK_1)!
    expect(s.getAttribute('aria-hidden')).toBeNull()
    const line = screen.getByTestId('factor-driver-line')
    expect(line.closest('[data-card-bottom-band]')).not.toBeNull()
    expect(s.textContent).toBe('')
    // RE-PINNED 27 Sep 2026 (landing text cap 1.36 → 1.64, Canvas owner): the card's
    // one-line slot prints the LONGEST form that fits at the landing bound
    // (`restingDriverCaption`); the accessible name and the hover keep the full sentence.
    expect(screen.getByTestId('factor-driver-line-caption').getAttribute('aria-label')).toBe('Driver 1 of 1 ranked')
    expect(within(line).getByTestId('factor-driver-line-bar')).toBeInTheDocument()
    // One line: the SLOT is one line and clips. Inside it the caption never wraps
    // (it fits whole at the landing bound — `FactorDriverLine.landingFit.spec`),
    // and a bar that does not fit beside it wraps into the clipped second line,
    // drawn whole or not at all (DIFF item 11 review) — never squashed.
    expect(tokens(s)).toContain('h-[1lh]')
    expect(tokens(s)).toContain('overflow-hidden')
    expect(tokens(line)).toContain('inline-flex')
    expect(tokens(line)).toContain('whitespace-nowrap')
    expect(tokens(line)).not.toContain('mt-1')
    expect(line.getAttribute('aria-label')!.startsWith('Driver 1 of 1 ranked in this run.')).toBe(true)
  })

  it('MG B1 (#2123 review): a factor the Run does NOT rank keeps its reserved slot after the Run — empty, aria-hidden, no substitute', () => {
    seed('post')
    renderCard('fac_market_competition')
    const s = slot('fac_market_competition')!
    expect(s.getAttribute('aria-hidden')).toBe('true')
    expect(s.textContent).toBe('')
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    // Still said to AT, once, outside the slot (contract v3.1 pt 5).
    const notRanked = screen.getByTestId('factor-driver-not-ranked')
    expect(notRanked.textContent).toBe('Not ranked in this run')
    expect(s.contains(notRanked)).toBe(false)
  })

  it('a VALUED factor the Run does not rank: the pre-run line leaves, the slot stays', () => {
    seed('post')
    renderCard('fac_adoption_friction')
    const s = slot('fac_adoption_friction')!
    expect(s.textContent).toBe('')
    expect(s.getAttribute('aria-hidden')).toBe('true')
    expect(document.body.textContent).not.toContain('no analysis yet')
  })
})

describe('(b) "No turning point in this run" is NOT on the card', () => {
  it('fac_top_account_concentration post-run: no turning-point fallback on the card; the driver line is (present control)', () => {
    seed('post')
    renderCard(RANK_1)
    const c = card('Top Account Revenue Concentration')
    expect(within(c).getByTestId('factor-driver-line-caption').getAttribute('aria-label')).toBe('Driver 1 of 1 ranked')
    expect(within(c).queryByTestId('factor-turning-point-none')).toBeNull()
    expect(c.textContent).not.toContain('No turning point')
  })
})

/*
 * ⭐⭐ THE FOUND CASE — DL #70 5850012381, amending 5849644637 after MG's #2138
 * review (B1): "A FOUND turning point stays on the card as the prototype's flip
 * plot. No card grows after a Run, EXCEPT the rank-1 factor, and only by the
 * flip plot when a turning point is found. 'None found' stays off the card."
 *
 * FIXTURE: MG's probe (`ui2138-handoff/MGPROBE2138.found-turning-point.spec.tsx`)
 * — this file's served board with the served no-flip row swapped for a FOUND row
 * on the rank-1 factor. `MG_ADDED` is that probe's result at 9dc3e7af, verbatim.
 * The board half (0 overlaps, 0 new edges under cards at the post-run height) is
 * `canvas/__tests__/factorFoundTurningPoint.geometry.spec.ts`.
 */
const FOUND_ROW = {
  node_id: RANK_1, label: 'Top Account Revenue Concentration', flip_reason: 'found',
  current_value: 0.4, flip_value: 0.7, value_scale: 'display', alternative_winner_label: 'Full Switch to Usage-Based at Renewal',
}
const FOUND_REPORT = { ...SERVED_REPORT, flip_thresholds: [FOUND_ROW] }
const MG_ADDED = [
  `attention-marker-${RANK_1}`, 'attention-marker-ring',
  'factor-driver-line', 'factor-driver-line-caption', 'factor-driver-line-bar', 'factor-driver-line-bar-fill',
  `node-card-rail-resting-${RANK_1}`,
  // Post-run DIFF item 10 (28 Sep 2026, contract v3.1 `flipPlot`): the track
  // and its labels are one plot (`-plot`), the run's value BENEATH the line —
  // so it follows the marks in document order. Same elements, one wrapper.
  'factor-turning-point', 'factor-turning-point-caption', 'factor-turning-point-plot',
  'factor-turning-point-track', 'factor-turning-point-current', 'factor-turning-point-flip',
  'factor-turning-point-run-value',
]
const FLIP_PLOT_IDS = MG_ADDED.filter(t => t.startsWith('factor-turning-point'))

/** Every testid on the rendered card, in document order. */
const allIds = (root: HTMLElement) => [...root.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid')!)
/** …outside the reserved slot: the slot's CONTENT is the slot's business (one fixed line). */
const faceIds = (root: HTMLElement, id: string) => {
  const s = root.querySelector(`[data-testid="factor-driver-slot-${id}"]`)!
  // The pre-run "Working assumption · no analysis yet" mark LEAVES after a Run by design (#2649 G1/G2 slice): it sits
  // in the absolutely-placed bottom band, so its leaving cannot change the card's height. Every other face id must match.
  return [...root.querySelectorAll('[data-testid]')].filter(e => (e === s || !s.contains(e)) && !e.closest('[data-card-mark="driver"], [data-card-mark="driver-last-run"], [data-card-mark="working-assumption"]')).map(e => e.getAttribute('data-testid')!)
}

describe('FOUND turning point on the rank-1 factor — the ONE card that may grow, and only by the flip plot', () => {
  it(`${RANK_1}: pre → post adds exactly MG's probe set and removes nothing; the flip plot sits at rest right under the reserved slot`, () => {
    seed('pre', FOUND_REPORT)
    const pre = allIds(renderCard(RANK_1).container)
    cleanup()
    seed('post', FOUND_REPORT)
    const { container } = renderCard(RANK_1)
    const post = allIds(container)
    expect(post.filter(t => !pre.includes(t))).toEqual(MG_ADDED)
    // At 9dc3e7af MG's probe also removed the range line (spec §3: the plot
    // supersedes it). Since #2133 the card omits the producer's bare model-scale
    // range ('0.2 to 0.6') in BOTH phases, so nothing leaves and the plot is the
    // whole growth (Chromium: 109.1 → 202.9px, the plot 91.8px).
    // Design bundle 1: the card again states the producer's range before the Run, in tier
    // words ("Range: Low to Medium"), so — as at 9dc3e7af and spec §3 — the found plot
    // SUPERSEDES that line: exactly the range line and its source mark leave, nothing else.
    expect(pre).toContain(`factor-prior-range-${RANK_1}`)
    expect(pre.filter(t => !post.includes(t))).toEqual([`factor-range-source-${RANK_1}`, `factor-prior-range-${RANK_1}`])
    const c = card('Top Account Revenue Concentration')
    const s = within(c).getByTestId(`factor-driver-slot-${RANK_1}`)
    const plot = within(c).getByTestId('factor-turning-point')
    // On the card FACE, the sibling right after the slot — not in a popover.
    expect(s.nextElementSibling).toBe(plot)
    // At rest the caption is the contract's sentence; the producer's option
    // scope is in the name (post-run DIFF item 10: at most two lines).
    expect(within(plot).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Above 0.7, the current model comparison changes.',
    )
    expect(plot.getAttribute('aria-label')).toContain('It shifts towards Full Switch to Usage-Based at Renewal.')
    expect(within(c).getByTestId('factor-driver-line-caption').getAttribute('aria-label')).toBe('Driver 1 of 1 ranked')
    // "None found" is not the arm here, and never on the card.
    expect(within(c).queryByTestId('factor-turning-point-none')).toBeNull()
  })

  it.each(SERVED_FACTORS.filter(f => f.id !== RANK_1).map(f => [f.id, f.data.label] as const))(
    '%s: the rank-1 finding leaves this card\'s shape unchanged pre → post — same testids outside the slot, in order, plus only the sr-only "Not ranked" line',
    (id, label) => {
      seed('pre', FOUND_REPORT)
      const pre = faceIds(renderCard(id).container, id)
      const preClass = slot(id)!.getAttribute('class')
      cleanup()
      seed('post', FOUND_REPORT)
      const { container } = renderCard(id)
      expect(within(card(label)).getByTestId(`factor-driver-slot-${id}`)).toBe(slot(id))
      const post = faceIds(container, id)
      expect(tokens(screen.getByTestId('factor-driver-not-ranked'))).toContain('sr-only')
      expect(post.filter(t => t !== 'factor-driver-not-ranked')).toEqual(pre)
      expect(slot(id)!.getAttribute('class')).toBe(preClass)
      expect(allIds(container).filter(t => FLIP_PLOT_IDS.includes(t))).toEqual([])
    },
  )

  it('the rank-1 GATE: a FOUND row on the rank-2 factor stays off its card face (popover/inspector); rank 1 keeps its plot (present control)', () => {
    // MG's row shape, on two factors, with the Run ranking two ("Driver 2 of 2 ranked in this run").
    const RANK_2 = 'fac_enterprise_revenue_risk'
    const twoFound = {
      ...SERVED_REPORT,
      flip_thresholds: [
        FOUND_ROW,
        { node_id: RANK_2, label: 'Enterprise Revenue Cannibalization Risk', flip_reason: 'found', current_value: 0, flip_value: 0.5, value_scale: 'display', alternative_winner_label: 'Hybrid Platform Fee Plus Usage' },
      ],
    }
    seed('post', twoFound, 2)
    renderCard(RANK_1)
    expect(within(card('Top Account Revenue Concentration')).getByTestId('factor-turning-point')).toBeInTheDocument()
    cleanup()

    seed('pre', twoFound, 2)
    const pre = faceIds(renderCard(RANK_2).container, RANK_2)
    cleanup()
    seed('post', twoFound, 2)
    const { container } = renderCard(RANK_2)
    const c = card('Enterprise Revenue Cannibalization Risk')
    expect(within(c).getByTestId('factor-driver-line-caption').getAttribute('aria-label')).toBe('Driver 2 of 2 ranked')
    expect(allIds(container).filter(t => FLIP_PLOT_IDS.includes(t))).toEqual([])
    // What DOES arrive is the run's attention mark (`nodeAttention`: a found row
    // qualifies) — a corner mark, not the plot. Chromium, this title, found row on
    // this factor: 147.9 → 147.9px ("Enterprise" shares line 1 with the mark).
    const post = faceIds(container, RANK_2)
    const attentionMark = [`attention-marker-${RANK_2}`, 'attention-marker-ring', `node-card-rail-resting-${RANK_2}`]
    expect(post.filter(t => !pre.includes(t))).toEqual(attentionMark)
    expect(post.filter(t => !attentionMark.includes(t))).toEqual(pre)
  })
})
