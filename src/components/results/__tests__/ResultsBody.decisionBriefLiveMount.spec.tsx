/**
 * Decision Brief live mount proof.
 *
 * A real captured V5 turn travels through the real applicator and store before
 * ResultsBody renders. The withheld and stale cases then prove the new reader
 * is independent of leader entitlement and freshness authority.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { applyV5State } from '@/v5/applyV5State'
import { useCanvasStore } from '@/canvas/store'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import walkTurnFixture from '@/v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

const PROVENANCE_KEYS = ['__source__', '__captured_at__', '__captured_against__', '__notes__']

function capturedWalkTurn(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(walkTurnFixture as Record<string, unknown>)
      .filter(([key]) => !PROVENANCE_KEYS.includes(key)),
  )
}

function applyCapturedWalkTurn(): void {
  const state = useCanvasStore.getState()
  applyV5State(capturedWalkTurn() as never, {
    ...state,
    currentResultsHash: state.results?.hash ?? null,
  } as never)
}

function makeData(withheld = false, duplicateBriefWarning = false): ResultsSectionDataReturn {
  const first = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: !withheld,
    winProbability: 0.51,
    goalProbability: 0.7,
  } as unknown as OptionResult
  const second = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.79,
    outcome: { mean: 0.79, p10: 0.59, p50: 0.77, p90: 0.94 },
    p10: 0.59,
    p50: 0.77,
    p90: 0.94,
    isRecommended: false,
    winProbability: 0.49,
    goalProbability: 0.69,
  } as unknown as OptionResult
  const recommendation = {
    recommendedOption: withheld ? null : first,
    allOptions: [first, second],
    goalLabel: 'Grow sustainably',
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    isNormalised: false,
    verdict: {
      hasLeadingOption: !withheld,
      leadingOptionId: withheld ? null : 'opt_a',
      reason: withheld ? 'constraint_verdict_withheld' : 'producer_leader',
    },
  } as unknown as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }
  const confidence = {
    tier: { tier: 'needs_work', icon: 'Alert', label: 'Needs work', description: 'd' },
    qualityScore: 45,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
    inferenceWarnings: duplicateBriefWarning ? [{
      code: 'CONSTRAINT_OUT_OF_DOMAIN',
      affected_nodes: [],
      message: 'Constraint gc-e9543857-e145-4ed5-a729-905529d9b0dd targets risk node risk_ae_attrition.',
      severity: 'warning',
    }] : [],
    humanisedCritiques: [],
  } as unknown as ConfidenceSectionData
  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Grow sustainably',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function renderBody({
  withheld = false,
  isStale = false,
  duplicateBriefWarning = false,
} = {}) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(withheld, duplicateBriefWarning)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      isStale={isStale}
      onSendMessage={() => {}}
    />,
  )
}

const WITHHELD_BRIEF = {
  brief_id: '50d0209b-6cfa-4b6a-a22b-84c94a80c06e',
  version: '1',
  created_at: '2026-08-25T08:16:07.476Z',
  top_drivers: [
    { factor_label: 'October Product Launch Readiness', sensitivity: 1, direction: 'positive' },
    { factor_label: 'VP Enterprise Sales Scalability', sensitivity: 0.955, direction: 'positive' },
  ],
  key_assumptions: ['October Product Launch Readiness', 'VP Enterprise Sales Scalability'],
  what_would_change: [
    'October Product Launch Readiness → ARR Growth Trajectory',
    'ARR Growth Trajectory → Grow ARR to £6m by June 2027',
  ],
  warnings: [
    {
      code: 'CONSTRAINT_OUT_OF_DOMAIN',
      message: 'Constraint gc-e9543857-e145-4ed5-a729-905529d9b0dd targets risk node "risk_ae_attrition" with threshold 2 outside [0,1] range',
      severity: 'warning',
    },
    {
      code: 'INFLUENTIAL_EXTERNALS',
      message: 'External factors materially affect this outcome and remain uncertain.',
      severity: 'warning',
    },
  ],
}

describe('ResultsBody — Decision Brief live mount', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      results: { status: 'idle', progress: 0 },
      runMeta: null,
    } as never)
  })

  afterEach(() => cleanup())

  it('real captured V5 turn → mapper → store → canonical Analysis body renders the brief', () => {
    applyCapturedWalkTurn()
    renderBody()

    const report = useCanvasStore.getState().results
    expect(report?.status).toBe('complete')
    expect((report?.report as { decision_brief?: unknown }).decision_brief).toBeTruthy()
    expect(screen.getAllByTestId('decision-brief-section')).toHaveLength(1)
    const briefSection = screen.getByTestId('decision-brief-section')
    const method = screen.getByTestId('how-computed-trigger')
    const hero = screen.getByTestId('analysis-hero-panel')
    expect(briefSection.compareDocumentPosition(method) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(briefSection.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const brief = within(screen.getByTestId('decision-brief-section'))
    // The producer names the same factor independently as a driver and an
    // assumption; preserving both categories is intentional, not a duplicate
    // surface.
    expect(brief.getAllByText('Churn Trend')).toHaveLength(2)
    expect(brief.getByText('Product-Led Growth Conversion → Reach £1M ARR')).toBeInTheDocument()
  })

  it('withheld/no-leader run keeps all non-designating groups useful without restoring a winner', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: { decision_brief: WITHHELD_BRIEF },
      },
    } as never)
    renderBody({ withheld: true })

    const brief = screen.getByTestId('decision-brief-section')
    expect(brief).toHaveTextContent('October Product Launch Readiness')
    expect(brief).toHaveTextContent('October Product Launch Readiness → ARR Growth Trajectory')
    expect(brief).not.toHaveTextContent('gc-e9543857')
    expect(brief).not.toHaveTextContent('risk_ae_attrition')
    expect(brief).not.toHaveTextContent('Cautions')
    expect(brief).not.toHaveTextContent(/winner|recommended|leading option|probability/i)
  })

  it('no eligible option still shows producer assumptions without inventing an outcome', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          decision_brief: {
            ...WITHHELD_BRIEF,
            options: [],
            top_drivers: [],
            what_would_change: [],
          },
        },
      },
    } as never)
    renderBody({ withheld: true })

    const brief = screen.getByTestId('decision-brief-section')
    expect(brief).toHaveTextContent('What this rests on')
    expect(brief).toHaveTextContent('October Product Launch Readiness')
    expect(brief).not.toHaveTextContent(/winner|recommended|leading option|eligible|probability/i)
  })

  it('unresolved inputs remain visible as producer assumptions without a UI certainty judgement', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          decision_brief: {
            ...WITHHELD_BRIEF,
            top_drivers: [],
            what_would_change: [],
            warnings: [],
          },
        },
      },
    } as never)
    renderBody({ withheld: true })

    const brief = screen.getByTestId('decision-brief-section')
    expect(brief).toHaveTextContent('What this rests on')
    expect(brief).toHaveTextContent('October Product Launch Readiness')
    expect(brief).toHaveTextContent('+1 more')
    expect(brief).not.toHaveTextContent(/certain|confirmed|confidence/i)
  })

  it('does not re-admit a nested warning while the existing canonical strip remains sole owner', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: { decision_brief: WITHHELD_BRIEF },
      },
    } as never)
    renderBody({ withheld: true, duplicateBriefWarning: true })

    expect(screen.getAllByTestId('inference-warning-strip-entry')).toHaveLength(1)
    const warning = screen.getByTestId('inference-warning-strip-entry')
    const brief = screen.getByTestId('decision-brief-section')
    expect(warning).toHaveAttribute(
      'data-warning-code',
      'CONSTRAINT_OUT_OF_DOMAIN',
    )
    expect(warning.compareDocumentPosition(brief) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(brief).queryByText('Cautions')).toBeNull()
  })

  it('stale analysis leaves the brief readable and adds no competing freshness claim', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: { decision_brief: WITHHELD_BRIEF },
      },
    } as never)
    renderBody({ withheld: true, isStale: true })

    const brief = screen.getByTestId('decision-brief-section')
    expect(brief).toHaveTextContent('October Product Launch Readiness')
    expect(brief).not.toHaveTextContent(/fresh|stale|current|out of date|re-run/i)
  })

  it('a retained report stays mounted while the canonical run state is preparing', () => {
    useCanvasStore.setState({
      results: {
        status: 'preparing',
        progress: 0,
        report: { decision_brief: WITHHELD_BRIEF },
      },
    } as never)
    renderBody({ withheld: true })

    expect(screen.getByTestId('decision-brief-section')).toHaveTextContent(
      'October Product Launch Readiness',
    )
  })

  it('with no producer brief, renders no placeholder or fabricated surface', () => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, report: {} },
    } as never)
    renderBody()

    expect(screen.queryByTestId('decision-brief-section')).toBeNull()
  })
})
