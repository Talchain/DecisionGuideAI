/**
 * ⭐⭐ A STALE RUN'S INFLUENCE FIGURE AND RANK ARE LABELLED "LAST RUN", NEVER
 * WITHHELD — ON EVERY MOUNTED SURFACE THAT SHOWS ONE.
 *
 * Paul's Ruling 3 (ROADMAP 2.651, quoted at
 * `components/results/analysisState/analysisStateContract.ts`): "out-of-date
 * results are labelled, not withheld … No dimming, no aria-disabled lockout".
 * And the no-hiding ruling as it applies to THIS figure
 * (`influenceScaleCopy.ts`, `influenceRankExplanation`): taking the figure away
 * from a reader who wants it would be hiding a finding.
 *
 * Goal criterion 1: no rank, confidence or similar semantic claim appears
 * unless the underlying analysis state supports it. A factor card that says
 * `Key driver 1` or `Influence 62%` about a model the user has since edited is
 * that claim — so it keeps the figure and SAYS which run it belongs to, exactly
 * as the option card's `Last run · Most supported` pill already does.
 *
 * ⚠ THE PREDICATE IS `useAnalysisTrust().semantic === 'changed'`, NOT
 * `!useAnalysisResultsAreCurrent()`. The latter's `false` pools changed with
 * cannot-confirm / none / never-run, and its own docblock forbids a
 * "the graph has changed" message on it. So every stale case below is
 * precondition-checked against the REAL composed verdict (nothing about
 * freshness is mocked), and a cannot-confirm case pins that the label does NOT
 * fire there.
 *
 * ⚠ WHAT THIS CANNOT PROVE (jsdom): layout. The label is inline text in
 * columns that are `shrink-0`, so it takes width from the bar beside it and
 * cannot add a line to the card by construction — but that is a reading of the
 * classes, not a measurement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { ImportanceBar } from '../../ui/inspector-v2/shared/ImportanceBar'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { LAST_RUN_PREFIX } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * Only the display model is supplied — the influence derivation is its own
 * owner's question and is pinned elsewhere. Freshness is NOT mocked: every
 * label decision below runs through the real store and the real composed
 * verdict.
 */
let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

const FACTOR_ID = 'fac_hiring_speed'
const OTHER_FACTOR_ID = 'fac_delivery_capacity'

/** No stated value, so the reduced line reaches its INFLUENCE arm. */
const UNVALUED = { label: 'Hiring speed', type: 'factor', category: 'external' }
/** A human-stated value — not run-derived, so it must never be labelled. */
const USER_STATED = {
  label: 'Hiring speed',
  type: 'factor',
  category: 'controllable',
  display_value: '0.4',
  observedState: { value: 0.4, source: 'user_override' },
}

const metadata = (rank: number | null, setSize: number | null, influence: number) => ({
  sensitivityRank: rank,
  influence,
  influenceProvenance: 'normalised_elasticity',
  influenceImportanceBasis: null,
  influenceSetSize: setSize,
  confidence: null,
  confidenceIsDefaulted: false,
  confidenceIsProvisional: false,
  inSensitivityAnalysis: true,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
})

const FRESH_VERDICT = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-22T00:00:00.000Z',
}

/** A completed run, exactly as `OptionNode.currentness.spec.tsx` seeds one. */
const seedCompletedRun = (
  nodeData: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => {
  useCanvasStore.setState({
    nodes: [
      { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: nodeData },
      { id: OTHER_FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Delivery capacity', type: 'factor' } },
    ],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'stale-run-scenario',
    v5AnalysisFact: {
      scenarioId: 'stale-run-scenario', analysisHash: 'last-run', hasRunAnalysisFact: true,
    },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'last-run', report: {
      option_probabilities: {
        opt_a: { status: 'computed', win_probability: 0.72 },
        opt_b: { status: 'computed', win_probability: 0.28 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
    } },
    ...extra,
  } as never)
}

/** The local edit that makes the composed verdict 'changed' (real store path). */
const editTheModel = () => act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))

/** Precondition probe: the REAL composed verdict, rendered where a test can read it. */
function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}

const renderFactor = (nodeData: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <FactorNode
        id={FACTOR_ID} type="factor" data={nodeData as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

beforeEach(() => {
  displayMetadata = metadata(null, null, 0.62)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard',
  } as never)
})

describe('factor card, Standard view — the influence row', () => {
  it('a stale run keeps the figure and prefixes the caption "Last run · "', () => {
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    // FRESH: exactly what shipped before this change.
    expect(screen.getByTestId('factor-influence-row').textContent).toBe('Relative influence62%')

    editTheModel()
    expect(semantic()).toBe('changed')
    const row = screen.getByTestId('factor-influence-row')
    expect(row.textContent).toBe('Last run · Relative influence62%')
    // The accessible name carries the same words the eye gets.
    expect(row.getAttribute('aria-label')).toMatch(/^Last run · Relative influence: 62%\./)
  })

  it('a fresh RANKED row is unchanged — the label never touches a current result', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('factor-influence-row').textContent).toBe('Most influentialof 5')
  })

  it('cannot-confirm is NOT "changed" — no Last-run label (the brief\'s predicate)', () => {
    seedCompletedRun(UNVALUED, {
      analysisFreshness: { ...FRESH_VERDICT, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    })
    renderFactor(UNVALUED)
    expect(semantic()).toBe('cannot_confirm')
    expect(screen.getByTestId('factor-influence-row').textContent).toBe('Relative influence62%')
  })
})

describe('factor card, Detailed view — the influence bar row', () => {
  it('a stale run keeps the figure and labels the caption and the group name', () => {
    seedCompletedRun(UNVALUED, { viewMode: 'expert' })
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(screen.getByRole('group', { name: 'Relative influence' }).textContent).toBe('Relative influence62%')

    editTheModel()
    expect(semantic()).toBe('changed')
    const group = screen.getByRole('group', { name: 'Last run · Relative influence' })
    expect(group.textContent).toBe('Last run · Relative influence62%')
    expect(screen.queryByRole('group', { name: 'Relative influence' })).toBeNull()
  })
})

describe('factor card, below the legibility floor — the reduced line', () => {
  it('a stale run prefixes the influence line', () => {
    seedCompletedRun(UNVALUED, { lodRung: 'line' })
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Influence 62%')

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Last run · Influence 62%')
    expect(screen.getByTestId('node-lod-line').getAttribute('title')).toBe('Last run · Influence 62%')
  })

  it('a human-stated value is NOT run-derived and is never labelled', () => {
    seedCompletedRun(USER_STATED, { lodRung: 'line' })
    renderFactor(USER_STATED)
    editTheModel()
    expect(semantic()).toBe('changed')
    const line = screen.getByTestId('node-lod-line-text').textContent ?? ''
    expect(line).toBe('0.4')
    expect(line).not.toContain('Last run')
  })
})

describe('factor card — the "Key driver N" badge', () => {
  it('a stale run keeps the rank and prefixes it, visible text and accessible name alike', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    const fresh = screen.getByTestId(`sensitivity-rank-${FACTOR_ID}`)
    expect(fresh.textContent).toBe('Key driver 1')
    expect(fresh.getAttribute('aria-label')).toMatch(/^Key driver 1: /)

    editTheModel()
    expect(semantic()).toBe('changed')
    const stale = screen.getByTestId(`sensitivity-rank-${FACTOR_ID}`)
    expect(stale.textContent).toBe('Last run · Key driver 1')
    // Label in Name (WCAG 2.5.3): the visible string opens the spoken one.
    expect(stale.getAttribute('aria-label')).toMatch(/^Last run · Key driver 1: /)
  })
})

describe('inspector — ImportanceBar (the one renderer all four panels mount)', () => {
  it('a stale run keeps the ordinal and percentage and labels the caption', () => {
    seedCompletedRun(UNVALUED)
    render(<><TrustProbe /><ImportanceBar importanceScore={0.62} sensitivityRank={1} influenceProvenance="normalised_elasticity" /></>)
    expect(semantic()).toBe('current')
    const bar = screen.getByTestId('importance-bar')
    expect(bar.textContent).toBe('1st62%Influence on results')

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('importance-bar').textContent).toBe('1st62%Last run · Influence on results')
  })
})

describe('wording parity with the option card', () => {
  it('the shared prefix is the exact string the option pill already renders', () => {
    const option = { label: 'Try a smaller pilot', type: 'option' }
    // The option card reads its win share off the display model (mocked in
    // this file); the leader itself comes from the real report verdict.
    displayMetadata = { ...metadata(null, null, 0), sensitivityRank: null, influence: null, influenceProvenance: null, winRate: 0.72 }
    seedCompletedRun(UNVALUED, {
      nodes: [
        { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: option },
        { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: option },
      ],
    })
    render(<ReactFlowProvider><OptionNode
      id="opt_a" type="option" data={option as never} selected={false}
      isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable
    /></ReactFlowProvider>)
    editTheModel()
    expect(LAST_RUN_PREFIX).toBe('Last run · ')
    expect(screen.getByTestId('leading-option-pill-opt_a').textContent).toBe(`${LAST_RUN_PREFIX}Most supported`)
  })
})
