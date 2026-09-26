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
 *   · post-run the ranked factor's `Driver N of M analysed` + bar fill it;
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

const PRE_LINE = 'Working assumption · no analysis yet'
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
const VALUED = new Set(['fac_adoption_friction', 'fac_enterprise_revenue_risk', 'fac_usage_exposure'])
const nodes = SERVED_FACTORS.map(f => ({ id: f.id, type: 'factor', position: { x: 0, y: 0 }, data: f.data }))

// Served post-run: only the top factor is ranked ("Driver 1 of 5 analysed").
const SERVED_ORDER = [RANK_1, 'fac_enterprise_revenue_risk', 'fac_usage_exposure', 'fac_adoption_friction', 'fac_market_competition']
const meta = (id: string, ran: boolean) => {
  const rank = SERVED_ORDER.indexOf(id) + 1
  return {
    sensitivityRank: ran ? rank : null, influence: ran ? [1, 0.7, 0.5, 0.3, 0.1][rank - 1] : null,
    influenceProvenance: 'influence_score', influenceImportanceBasis: null,
    influenceSetSize: ran ? 5 : null, influenceRankedCount: ran ? 1 : null,
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

const seed = (phase: 'pre' | 'post') => {
  const ran = phase === 'post'
  metaById = Object.fromEntries(SERVED_FACTORS.map(f => [f.id, meta(f.id, ran)]))
  useCanvasStore.setState({
    nodes, edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full', goalConstraints: [],
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'pricing-scenario',
    analysisFreshness: ran ? { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-26T20:27:28.000Z' } : null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: ran ? { scenarioId: 'pricing-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: ran,
    results: ran ? { status: 'complete', hash: 'run-1', report: SERVED_REPORT } : { status: 'idle', report: null },
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
      if (VALUED.has(id)) {
        // (a) the contract's pre-run line, visible, IN the slot.
        expect(pre!.textContent).toBe(PRE_LINE)
        expect(pre!.getAttribute('aria-hidden')).toBeNull()
      } else {
        // A range-only factor shows no value, so the contract says nothing: the slot is empty.
        expect(pre!.textContent).toBe('')
        expect(pre!.getAttribute('aria-hidden')).toBe('true')
      }
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

  it('fac_top_account_concentration post-run: "Driver 1 of 5 analysed" + its bar fill the reserved slot, on one line', () => {
    seed('post')
    renderCard(RANK_1)
    const s = slot(RANK_1)!
    expect(s.getAttribute('aria-hidden')).toBeNull()
    const line = screen.getByTestId('factor-driver-line')
    expect(line.parentElement).toBe(s)
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 5 analysed')
    expect(within(s).getByTestId('factor-driver-line-bar')).toBeInTheDocument()
    // One line: the row never wraps; the caption ellipsises, whole in the button's name.
    expect(tokens(line)).toContain('flex-nowrap')
    expect(tokens(line)).toContain('whitespace-nowrap')
    expect(tokens(line)).not.toContain('mt-1')
    expect(line.getAttribute('aria-label')!.startsWith('Driver 1 of 5 analysed.')).toBe(true)
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
    expect(within(c).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 5 analysed')
    expect(within(c).queryByTestId('factor-turning-point-none')).toBeNull()
    expect(c.textContent).not.toContain('No turning point')
  })
})
