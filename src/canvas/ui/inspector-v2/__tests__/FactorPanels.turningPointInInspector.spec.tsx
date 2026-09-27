/**
 * ⭐ "No turning point in this run" MOVED FROM THE CARD TO THE INSPECTOR — not
 * removed (DL ruling #70 5849644637, 26 Sep 2026; acceptance: "the inspector
 * still shows the turning-point line").
 *
 * SERVED (witness on UI 03f60be0, pricing starter, one real Run): the rank-1
 * factor `fac_top_account_concentration` (external, "Top Account Revenue
 * Concentration") read "Driver 1 of 5 analysed | No turning point in this run"
 * on the card. The card no longer carries the second line
 * (`nodes/__tests__/FactorNode.noGrowthAfterRun.spec.tsx`); its inspector does,
 * from the same data and the same rank gate (`useFactorRunCues`).
 *
 * Bound by identity: the node's own container test id and the exact served
 * string; every absence has a present control from the same render.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'

let metaById: Record<string, Record<string, unknown>> = {}
vi.mock('../../../hooks/useNodeDisplayMetadata', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useNodeDisplayMetadata: (id: string) => metaById[id] }
})

import { FactorExternalPanel } from '../panels/FactorExternalPanel'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'

const noop = () => {}
const RANK_1 = 'fac_top_account_concentration'
const UNRANKED_EXTERNAL = 'fac_market_competition'
const CONTROLLABLE = 'fac_enterprise_revenue_risk'

// Served pricing starter (`starters/data/pricing-model.draft.json`), store shape.
const NODES = [
  {
    id: RANK_1, type: 'factor', position: { x: 0, y: 0 },
    data: {
      kind: 'factor', type: 'factor', label: 'Top Account Revenue Concentration', category: 'external',
      prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.6000000000000001 },
      extractionType: 'explicit', display_value: '0.2 to 0.6', provenance: 'from_brief',
    },
  },
  {
    id: UNRANKED_EXTERNAL, type: 'factor', position: { x: 0, y: 0 },
    data: {
      kind: 'factor', type: 'factor', label: 'Competitive Pressure for Usage Pricing', category: 'external',
      prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
      display_value: '0.3 to 0.8', provenance: 'ai_inferred',
    },
  },
  {
    id: CONTROLLABLE, type: 'factor', position: { x: 0, y: 0 },
    data: {
      kind: 'factor', type: 'factor', label: 'Enterprise Revenue Cannibalization Risk', category: 'controllable',
      observedState: { value: 0, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
      display_value: 'Low (0)', provenance: 'ai_inferred',
    },
  },
] as unknown as Node[]

const meta = (rank: number | null, ran: boolean, rankedCount = 1) => ({
  sensitivityRank: ran ? rank : null, influence: ran && rank ? [1, 0.7, 0.5, 0.3, 0.1][rank - 1] : null,
  influenceProvenance: 'influence_score', influenceImportanceBasis: null,
  influenceSetSize: ran ? 5 : null, influenceRankedCount: ran ? rankedCount : null,
  confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
  inSensitivityAnalysis: ran, achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null, winRate: null, isResultsMode: ran, predictedOutcome: null,
  valueOfInformation: null, voiRank: null,
})

const reportWithNoFlipFor = (...ids: string[]) => ({
  option_probabilities: {
    opt_full_switch: { status: 'computed', win_probability: 0.34 },
    opt_new_logos: { status: 'computed', win_probability: 0.53 },
  },
  robustness: { near_tie: { is_tie: false, top_option_id: 'opt_new_logos' } },
  // Attested: the producer searched and found no flip (the served card's "in this run" arm).
  flip_thresholds: ids.map(id => ({ node_id: id, flip_reason: 'no_effect_within_bounds' })),
})

const staleEnvelope = {
  run_state: { kind: 'complete_stale', computed_at: '2026-09-26T20:27:28.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true, separation: 'separated' },
  robustness: { aggregate_level: 'low' },
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
}

const seed = (ran: boolean, meta_: Record<string, Record<string, unknown>>, report: unknown = null, stale = false) => {
  metaById = meta_
  useCanvasStore.setState({
    nodes: NODES, edges: [], ceeAnalysisReady: null, goalConstraints: [],
    analysisStateV1: stale ? staleEnvelope : null, importPendingServerRegistration: false, currentScenarioId: 'pricing-scenario',
    analysisFreshness: ran ? { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-26T20:27:28.000Z' } : null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: ran ? { scenarioId: 'pricing-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: ran,
    results: ran ? { status: 'complete', hash: 'run-1', report } : { status: 'idle', report: null },
  } as never)
}

const servedPost = () =>
  seed(true, {
    [RANK_1]: meta(1, true), [CONTROLLABLE]: meta(2, true), [UNRANKED_EXTERNAL]: meta(5, true),
  }, reportWithNoFlipFor(RANK_1))

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
})

describe('the factor inspector shows the turning-point line the card no longer carries', () => {
  it('served rank-1 factor, post-run: its inspector reads "No turning point in this run"', () => {
    servedPost()
    render(<FactorExternalPanel nodeId={RANK_1} techMode={false} onClose={noop} onNavigate={noop} />)
    const line = within(screen.getByTestId(`inspector-factor-turning-point-${RANK_1}`)).getByTestId('factor-turning-point-none')
    expect(line.getAttribute('data-node-id')).toBe(RANK_1)
    expect(line.getAttribute('data-attested')).toBe('true')
    expect(line.firstChild?.textContent).toBe('No turning point in this run')
  })

  it('the run established NOTHING for the rank-1 factor: the inspector says "No turning point available", never "in this run"', () => {
    seed(true, { [RANK_1]: meta(1, true) }, reportWithNoFlipFor())
    render(<FactorExternalPanel nodeId={RANK_1} techMode={false} onClose={noop} onNavigate={noop} />)
    const line = within(screen.getByTestId(`inspector-factor-turning-point-${RANK_1}`)).getByTestId('factor-turning-point-none')
    expect(line.getAttribute('data-attested')).toBe('false')
    expect(line.firstChild?.textContent).toBe('No turning point available')
  })

  it('the model changed since the run: the inspector labels it "Last run · No turning point in that run"', () => {
    seed(true, { [RANK_1]: meta(1, true) }, reportWithNoFlipFor(RANK_1), true)
    render(<FactorExternalPanel nodeId={RANK_1} techMode={false} onClose={noop} onNavigate={noop} />)
    const line = within(screen.getByTestId(`inspector-factor-turning-point-${RANK_1}`)).getByTestId('factor-turning-point-none')
    expect(line.firstChild?.textContent).toBe('Last run · No turning point in that run')
  })

  it('CONTRAST — a factor the run did NOT rank: no generic "no turning point" line (ED 5810951997); the panel rendered (present control)', () => {
    servedPost()
    render(<FactorExternalPanel nodeId={UNRANKED_EXTERNAL} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText('Outside your control')).toBeInTheDocument()
    expect(screen.queryByTestId(`inspector-factor-turning-point-${UNRANKED_EXTERNAL}`)).toBeNull()
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
  })

  it('CONTRAST — before any run: no turning-point line (no past run is invented)', () => {
    seed(false, { [RANK_1]: meta(null, false) })
    render(<FactorExternalPanel nodeId={RANK_1} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText('Outside your control')).toBeInTheDocument()
    expect(screen.queryByTestId(`inspector-factor-turning-point-${RANK_1}`)).toBeNull()
  })

  it('the controllable panel carries the same line for a RANKED controllable factor', () => {
    seed(true, { [RANK_1]: meta(2, true, 2), [CONTROLLABLE]: meta(1, true, 2) }, reportWithNoFlipFor(CONTROLLABLE))
    render(<FactorControllablePanel nodeId={CONTROLLABLE} techMode={false} onClose={noop} onNavigate={noop} />)
    const line = within(screen.getByTestId(`inspector-factor-turning-point-${CONTROLLABLE}`)).getByTestId('factor-turning-point-none')
    expect(line.getAttribute('data-node-id')).toBe(CONTROLLABLE)
    expect(line.firstChild?.textContent).toBe('No turning point in this run')
  })
})
