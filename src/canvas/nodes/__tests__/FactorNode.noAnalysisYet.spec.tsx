/**
 * ⭐ DESIGN-GAP ROW 10 — A FACTOR BEFORE ANY ANALYSIS SAYS SO (visual contract v3
 * §02 draft: "Working assumption · no analysis yet"; the fixture shows no
 * attention cue before a run).
 *
 * Before: a valued factor pre-run showed its value with nothing saying no
 * analysis exists, so a user could not tell a working assumption from a figure
 * the analysis had used.
 *
 * WHEN IT MAY BE SAID — the conservative "no analysis at all" state, and never
 * after a run:
 *   · no completed result on screen (`results.status !== 'complete'`), AND
 *   · no run has ever completed for this model (`hasCompletedFirstRun`), AND
 *   · the composed verdict speaks of no run (`useRunCurrency() === 'none'`),
 *     so a wire that states a completed run with nothing hydrated never gets
 *     "no analysis yet" over it.
 * And only on a factor that SHOWS a value (the contract's own branch): a factor
 * that needs input already states its gap.
 *
 * WHERE (ED #63 5809278282, bounded anatomy): the Standard card body is ONE
 * visible row (`FactorNode.boundedAnatomy.spec.tsx` pins it; the landing layout
 * reserves each card's height at that bound). So in Standard the line is in the
 * factor's popover and in the value line's accessible text — never a second
 * visible row. Detailed ("adds information") shows it inline on the card.
 *
 * Bound by identity: test ids and exact text; every absence has a present
 * control from the same render (the card title).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { ATTENTION_MARKER_TESTID_PREFIX } from '../shared/NodeAttentionMarker'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

const ID = 'fac_conversion'
const LINE = 'Working assumption · no analysis yet'

const VALUED = {
  label: 'Trial conversion', type: 'factor', category: 'controllable',
  observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' },
}
const MISSING = { label: 'Trial conversion', type: 'factor', category: 'controllable' }

const metadata = (isResultsMode: boolean) => ({
  sensitivityRank: isResultsMode ? 1 : null, influence: isResultsMode ? 1 : null,
  influenceProvenance: 'influence_score', influenceImportanceBasis: null,
  influenceSetSize: isResultsMode ? 6 : null, influenceRankedCount: isResultsMode ? 3 : null,
  confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
  inSensitivityAnalysis: isResultsMode, achievementProbability: null,
  achievementProbabilityIsModelledBasis: false, stabilityPercentage: null, winRate: null,
  isResultsMode, predictedOutcome: null, valueOfInformation: null, voiRank: null,
})

const REPORT = {
  option_probabilities: {
    opt_a: { status: 'computed', win_probability: 0.6 },
    opt_b: { status: 'computed', win_probability: 0.4 },
  },
  robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
  flip_thresholds: [
    { node_id: ID, label: 'Trial conversion', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' },
  ],
}

const envelope = (kind: string) => ({
  run_state: { kind, computed_at: '2026-09-24T00:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true, separation: 'separated' },
  robustness: { aggregate_level: 'low' },
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
})

type Phase = 'pre' | 'current' | 'changed' | 'wire-says-run-nothing-hydrated'
const seed = (data: Record<string, unknown>, phase: Phase, viewMode: 'standard' | 'expert' = 'standard') => {
  displayMetadata = metadata(phase === 'current' || phase === 'changed')
  const ran = phase === 'current' || phase === 'changed'
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode, lodRung: 'full', goalConstraints: [],
    importPendingServerRegistration: false, currentScenarioId: 'no-analysis-yet',
    analysisStateV1: phase === 'changed'
      ? envelope('complete_stale')
      : phase === 'wire-says-run-nothing-hydrated' ? envelope('complete_current') : null,
    analysisFreshness: ran ? { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-24T00:00:00.000Z' } : null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: ran ? { scenarioId: 'no-analysis-yet', analysisHash: 'run-1', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: ran,
    results: ran ? { status: 'complete', hash: 'run-1', report: REPORT } : { status: 'idle', report: null },
  } as never)
}

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}
const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

/** BaseNode's root for THIS card — the positive control every absence needs. */
const card = () => {
  const title = screen.getByTestId('node-title')
  expect(title.textContent).toContain('Trial conversion')
  return title.closest('[role="group"]') as HTMLElement
}
const visibleBodyRows = (primary: Element) =>
  Array.from(primary.parentElement!.children).filter((el) => !el.classList.contains('sr-only'))
const allText = () => document.body.textContent ?? ''

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
    lodRung: 'full', viewMode: 'standard',
  } as never)
})

describe('row 10 — a factor before any analysis reads "Working assumption · no analysis yet"', () => {
  it('pre-run, Standard: the line is in the popover and the value line\'s accessible text — NOT a second visible row', () => {
    seed(VALUED, 'pre')
    renderFactor(VALUED)
    expect(semantic()).toBe('none')
    const popoverLine = within(screen.getByTestId('factor-node-popover')).getByTestId(`factor-popover-no-analysis-${ID}`)
    expect(popoverLine.textContent).toBe(LINE)
    const valueLine = within(card()).getByTestId('factor-recorded-value')
    expect(within(valueLine).getByTestId(`factor-no-analysis-sr-${ID}`).textContent).toBe(LINE)
    // Bounded anatomy: still exactly ONE visible body row on the card.
    expect(visibleBodyRows(valueLine)).toHaveLength(1)
    expect(within(card()).queryByTestId(`factor-no-analysis-${ID}`)).toBeNull()
  })

  it('pre-run, Detailed: the line is inline on the card, as its own row after the value', () => {
    seed(VALUED, 'pre', 'expert')
    renderFactor(VALUED)
    const row = within(card()).getByTestId(`factor-no-analysis-${ID}`)
    expect(row.textContent).toBe(LINE)
    const valueLine = within(card()).getByTestId('factor-recorded-value')
    expect(Boolean(valueLine.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('pre-run: NO run-derived attention cue on the card', () => {
    seed(VALUED, 'pre')
    renderFactor(VALUED)
    expect(card()).toBeInTheDocument()
    expect(screen.queryByTestId(`${ATTENTION_MARKER_TESTID_PREFIX}${ID}`)).toBeNull()
  })

  for (const viewMode of ['standard', 'expert'] as const) {
    it(`CONTRAST — after a CURRENT run (${viewMode}): the line is gone everywhere`, () => {
      seed(VALUED, 'current', viewMode)
      renderFactor(VALUED)
      expect(semantic()).toBe('current')
      expect(card()).toBeInTheDocument()
      expect(allText()).not.toContain('no analysis yet')
      expect(screen.queryByTestId(`factor-no-analysis-${ID}`)).toBeNull()
      expect(screen.queryByTestId(`factor-popover-no-analysis-${ID}`)).toBeNull()
    })

    it(`after a run, model since CHANGED (${viewMode}): never "no analysis yet" over a stale run`, () => {
      seed(VALUED, 'changed', viewMode)
      renderFactor(VALUED)
      expect(semantic()).toBe('changed')
      expect(card()).toBeInTheDocument()
      expect(allText()).not.toContain('no analysis yet')
    })
  }

  it('the wire states a completed run but nothing is hydrated → the line is NOT claimed', () => {
    seed(VALUED, 'wire-says-run-nothing-hydrated')
    renderFactor(VALUED)
    expect(semantic()).not.toBe('none')
    expect(card()).toBeInTheDocument()
    expect(allText()).not.toContain('no analysis yet')
  })

  it('a RERUN in progress after an earlier run (no result on screen, a run has completed before) → NOT claimed', () => {
    seed(VALUED, 'pre')
    // `resultsStart` moves status off 'complete' mid-rerun; `hasCompletedFirstRun` stays true.
    useCanvasStore.setState({ hasCompletedFirstRun: true, results: { status: 'preparing', report: null } } as never)
    renderFactor(VALUED)
    expect(card()).toBeInTheDocument()
    expect(allText()).not.toContain('no analysis yet')
  })

  it('a factor that needs input states its gap, not "no analysis yet"', () => {
    seed(MISSING, 'pre')
    renderFactor(MISSING)
    expect(within(card()).getByTestId(`factor-needs-input-row-${ID}`)).toBeInTheDocument()
    expect(allText()).not.toContain('no analysis yet')
  })
})
