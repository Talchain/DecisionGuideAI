/**
 * RiskNode render tests
 * T9: Bridge edge data — contribution % + qualitative direction
 * Severity badge rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { USER_EDGE_DEFAULTS, DEFAULT_EDGE_DATA } from '../../domain/edges'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'risk-1',
  type: 'risk',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderRisk = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} data={{ label: 'Key person dependency', type: 'risk', ...data }} />
    </ReactFlowProvider>
  )

describe('RiskNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  })

  it('renders label', () => {
    renderRisk()
    expect(screen.getByText('Key person dependency')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderRisk()
    expect(screen.getByLabelText(/risk node/i)).toBeDefined()
  })

  it('has displayName set', () => {
    expect(RiskNode.displayName).toBe('RiskNode')
  })

  // Severity badge
  it('shows High Risk badge when probability is high and impact is high', () => {
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.getByText('High Risk')).toBeDefined()
  })

  it('shows Low Risk badge when probability is low and impact is low', () => {
    renderRisk({ probability: 0.1, impact: 'low' })
    expect(screen.getByText('Low Risk')).toBeDefined()
  })

  it('does not show severity badge when probability and impact are absent', () => {
    renderRisk()
    // Severity badge shows "High Risk", "Medium Risk", etc. — not the plain "Risk" type label
    expect(screen.queryByText(/^(High|Medium|Low) Risk$/)).toBeNull()
  })

  // P1.7 — severity badge visible in STANDARD view (was Expert/popover-only).
  it('shows the severity badge in STANDARD view (not Expert-only)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.getByText('High Risk')).toBeDefined()
  })

  // P1.7 — the defining probability × impact pair is shown in the body.
  it('shows the probability/impact pair in STANDARD view', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.getByText('90% likely · High impact')).toBeDefined()
  })

  // P1.7 — honest absence: no fabricated pair when data is missing.
  it('does not show a probability/impact pair when both are absent', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/% likely/)).toBeNull()
    expect(screen.queryByText(/impact$/)).toBeNull()
  })

  // P1.7 — partial data: show only the part that exists (probability only).
  it('shows only likelihood when impact is absent', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk({ probability: 0.5 })
    expect(screen.getByText('50% likely')).toBeDefined()
    expect(screen.queryByText(/impact/)).toBeNull()
  })

  // T9: Bridge edge data
  it('does not show bridge edge data when results status is not complete', () => {
    renderRisk()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows bridge edge impact on goal in results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            // Fixture stamped `weightSource: 'user'` (F4 follow-up). Before the
            // provenance gate an UNSTAMPED 0.6 rendered as "60% assumed strength",
            // so this golden-UI test was pinning a value the product could not
            // distinguish from `USER_EDGE_DEFAULTS.weight`. The test's subject is
            // the LABEL WORDING for a strength somebody set, so the fixture now
            // says somebody set it. The unstamped case is asserted separately
            // below — that pair is the positive/negative control.
            data: { weight: 0.6, direction: 'negative', beliefExists: null, weightSource: 'user' },
          },
        ],
      }) as any)
    )
    renderRisk()
    // UI-SEM-089 (F3, display honesty): the Layer-1 percentage is the static
    // assumed edge strength, NOT a computed goal drag. Post-analysis it must
    // keep the honest "assumed strength" wording and must NEVER relabel to
    // "goal drag" just because results.status flipped to 'complete'.
    expect(screen.getByText(/assumed strength/)).toBeDefined()
    expect(screen.queryByText(/goal drag/)).toBeNull()
    expect(screen.getByText(/60%/)).toBeDefined()
  })

  it('does not show certainty even when beliefExists is present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            data: { weight: 0.4, direction: 'negative', beliefExists: 0.9 },
          },
        ],
      }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/certain/)).toBeNull()
  })

  it('does not show bridge edge when no goal node exists', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [{ id: 'risk-1', type: 'risk', data: { type: 'risk' } }],
        edges: [],
      }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  // Wireframe v4: Detailed view caps "Depends on:" ConnRows at 3 even when
  // more inbound factors exist.
  it('caps Depends on ConnRows at 3 in Detailed post-analysis view', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Key person dependency' } },
          { id: 'goal-1', data: { type: 'goal' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Risk Factor One' } },
          { id: 'f2', type: 'factor', data: { type: 'factor', label: 'Risk Factor Two' } },
          { id: 'f3', type: 'factor', data: { type: 'factor', label: 'Risk Factor Three' } },
          { id: 'f4', type: 'factor', data: { type: 'factor', label: 'Risk Factor Four' } },
          { id: 'f5', type: 'factor', data: { type: 'factor', label: 'Risk Factor Five' } },
        ],
        edges: [
          { id: 'b1', source: 'risk-1', target: 'goal-1', data: { weight: 0.4, direction: 'negative' } },
          { id: 'e1', source: 'f1', target: 'risk-1', data: { exists_probability: 0.9 } },
          { id: 'e2', source: 'f2', target: 'risk-1', data: { exists_probability: 0.85 } },
          { id: 'e3', source: 'f3', target: 'risk-1', data: { exists_probability: 0.8 } },
          { id: 'e4', source: 'f4', target: 'risk-1', data: { exists_probability: 0.75 } },
          { id: 'e5', source: 'f5', target: 'risk-1', data: { exists_probability: 0.7 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderRisk()
    expect(screen.getByText('Risk Factor One')).toBeDefined()
    expect(screen.getByText('Risk Factor Two')).toBeDefined()
    expect(screen.getByText('Risk Factor Three')).toBeDefined()
    expect(screen.queryByText('Risk Factor Four')).toBeNull()
    expect(screen.queryByText('Risk Factor Five')).toBeNull()
  })

  // ── F4: pre-analysis "Strongest: X at N%." was a UI default spoken as prose ──
  //
  // POSITIVE CONTROL FIRST. Without a demonstrated PRESENCE the absence cases
  // below prove nothing (trap 13): they would also pass if the popover simply
  // never rendered.
  describe('pre-analysis inbound strengths (F4)', () => {
    const preAnalysisStore = (edgeData: Record<string, unknown>) =>
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          results: { status: 'idle', report: null },
          nodes: [
            { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Key person dependency' } },
            { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Unit price' } },
          ],
          edges: [{ id: 'e1', source: 'f1', target: 'risk-1', data: edgeData }],
          viewMode: 'expert',
        }) as any)
      )

    it('POSITIVE CONTROL: DOES render the figure for a strength somebody set', () => {
      preAnalysisStore({ weight: 0.42, direction: 'positive', weightSource: 'cee' })
      renderRisk()
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('42%')).toBeDefined()
      expect(screen.queryByText(/Not set/)).toBeNull()
    })

    it('renders "Not set", never the USER_EDGE_DEFAULTS weight, for an edge merely drawn', () => {
      preAnalysisStore({ ...USER_EDGE_DEFAULTS })
      renderRisk()
      // The row IS rendered — the relationship is real, only the number is not.
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('Unit price')).toBeDefined()
      expect(screen.getByTestId('pre-analysis-strength-unset-e1')).toBeDefined()
      // 0.3 → "30%" must not appear anywhere in the card.
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(screen.queryByText('30%')).toBeNull()
    })

  })

  // ── NEW-1: the bridge-to-goal % had a gate that could not fire ───────────
  // `hasStrength = strength_mean present || weight != null` is a TAUTOLOGY —
  // DEFAULT_EDGE_DATA / USER_EDGE_DEFAULTS always define `weight` — so every
  // edge rendered the default as a bold coloured contribution figure. Same
  // shape as F1's dead read gate, in a different file.
  describe('bridge-to-goal contribution % (NEW-1)', () => {
    const bridgeStore = (edgeData: Record<string, unknown>) =>
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          results: { status: 'complete', report: null },
          nodes: [
            { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
            { id: 'goal-1', data: { type: 'goal' } },
          ],
          edges: [{ id: 'b1', source: 'risk-1', target: 'goal-1', data: edgeData }],
        }) as any)
      )

    it('POSITIVE CONTROL: renders the figure for a strength somebody set', () => {
      bridgeStore({ weight: 0.6, direction: 'negative', weightSource: 'user' })
      renderRisk()
      expect(screen.getByText(/assumed strength/)).toBeDefined()
      expect(screen.getByText(/60%/)).toBeDefined()
    })

    it('renders NOTHING for an edge nobody characterised (USER_EDGE_DEFAULTS)', () => {
      bridgeStore({ ...USER_EDGE_DEFAULTS })
      renderRisk()
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(screen.queryByText(/30%/)).toBeNull()
      expect(screen.queryByText(/assumed strength/)).toBeNull()
    })

    it('renders NOTHING for a bare DEFAULT_EDGE_DATA weight of 0.5', () => {
      bridgeStore({ ...DEFAULT_EDGE_DATA })
      renderRisk()
      expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
      expect(screen.queryByText(/50%/)).toBeNull()
      expect(screen.queryByText(/assumed strength/)).toBeNull()
    })

    it('POSITIVE CONTROL: accepts CEE back-compat evidence (strength_mean)', () => {
      bridgeStore({ strength_mean: -0.45, weight: 0.3 })
      renderRisk()
      expect(screen.getByText(/45%/)).toBeDefined()
    })
  })
})
