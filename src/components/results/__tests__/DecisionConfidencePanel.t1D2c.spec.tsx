/**
 * DecisionConfidencePanel — Brief 5.8B D2c T1 enrichments.
 *
 * Verifies:
 *   - Flip-risk callout is rendered as a sibling of the hero (data-testid
 *     `t1-flip-risk-callout`); copy is preserved verbatim from the previous
 *     `ResultChecks` block ("LOCKED — placement only").
 *   - Dominant-factor nudge fires inside the T1 stack (`t1-dominant-nudge`)
 *     when the top driver carries ≥80% influence; suppressed otherwise.
 *     The legacy `dominant-factor-warning` testid (in DriversSection) is
 *     gone — replaced by this T1 nudge.
 *   - T1 checks footer surfaces Winner / Robust / Evidence-gaps glyphs and
 *     the "{N}/{M} addressed" counter; suppressed slots stay quiet.
 *   - DriversSection no longer renders any dominant-factor warning.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import { DriversSection } from '../DriversSection'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  DriverItem,
  EvidenceGapItem,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
  FragileEdgeItem,
} from '../types'
import { useCanvasStore } from '@/canvas/store'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: 'Top factor',
    rawElasticity: 1,
    normalisedInfluence: 1,
    influenceScore: 1,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_top',
    ...overrides,
  }
}

function makeGap(overrides: Partial<EvidenceGapItem> = {}): EvidenceGapItem {
  return {
    factorId: 'fac_g',
    factorLabel: 'Evidence Gap A',
    confidence: 70,
    voi: 0.5,
    suggestion: 'Gather data',
    targetNodeId: 'node_g',
    ...overrides,
  }
}

interface MakeOpts {
  drivers?: DriverItem[]
  topInfluence?: number
  dominantFactorLabel?: string
  dominantFactorId?: string
  fragile?: FragileEdgeItem | undefined
  recommendationStability?: number | undefined
  robustnessLevel?: DecisionResultData['robustnessLevel']
  robustnessVerdict?: DecisionResultData['robustnessVerdict']
  gaps?: EvidenceGapItem[]
}

function makeData(opts: MakeOpts = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult

  const drivers = opts.drivers ?? [
    makeDriver({ influenceScore: opts.topInfluence ?? 0.4 }),
  ]

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability:
      'recommendationStability' in opts ? opts.recommendationStability : 0.92,
    // robustnessLevel is the structured PLoT/fallback field (NOT display-safe).
    // robustnessVerdict is the display-safe verdict the glyph reads — they are
    // set independently here so a test can prove the glyph ignores the structured
    // field. Production never populates robustnessVerdict today (always undefined);
    // tests set it to simulate a future display-safe robustness contract.
    robustnessLevel: 'robustnessLevel' in opts ? opts.robustnessLevel : 'high',
    robustnessVerdict:
      'robustnessVerdict' in opts ? opts.robustnessVerdict : 'robust',
    coachingReadiness: 'ready',
  } as DecisionResultData

  const driversSection: DriversSectionData = {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
    dominantFactorId: opts.dominantFactorId,
    dominantFactorLabel: opts.dominantFactorLabel,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: opts.gaps ?? [],
    topEvidenceGaps: opts.gaps ?? [],
    nextActions: [],
    topNextActions: [],
    topFragileEdge: opts.fragile,
  } as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers: driversSection,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

beforeEach(() => {
  useCanvasStore.setState({ draftCoaching: null, analysisFreshness: null, analysisFreshnessDirty: false })
})

describe('DecisionConfidencePanel — hero freshness qualifier is CEE-only (never fabricated stale)', () => {
  it('shows a freshness qualifier for a genuine CEE stale verdict', () => {
    useCanvasStore.setState({
      analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
    })
    const { container } = render(<DecisionConfidencePanel data={makeData()} />)
    expect(container.querySelector('[data-qualifier-source="freshness"]')).not.toBeNull()
  })

  it('does NOT fabricate a stale qualifier from a local edit (CEE fresh + dirty → no freshness qualifier)', () => {
    // The legacy useAnalysisFreshnessState path turned graphEditedSinceLastRun into
    // a fabricated 'stale'. The hero now reads the CEE-only slice via
    // resolveDisplayedFreshness, which can only downgrade fresh→unknown — and
    // HeroQualifier renders the freshness qualifier only for a genuine 'stale'.
    useCanvasStore.setState({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: true,
    })
    const { container } = render(<DecisionConfidencePanel data={makeData()} />)
    expect(container.querySelector('[data-qualifier-source="freshness"]')).toBeNull()
  })

  it('shows no freshness qualifier when there is no CEE verdict', () => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    const { container } = render(<DecisionConfidencePanel data={makeData()} />)
    expect(container.querySelector('[data-qualifier-source="freshness"]')).toBeNull()
  })
})

describe('DecisionConfidencePanel — Brief 5.8B D2c T1 flip-risk + nudge + checks', () => {
  it('renders the flip-risk callout when a fragile edge is present', () => {
    const fragile: FragileEdgeItem = {
      fromId: 'node_x',
      fromLabel: 'Hiring rate',
      toId: 'node_y',
      toLabel: 'Revenue',
      switchProbability: 0.42,
      alternativeWinnerLabel: 'Option B',
    } as FragileEdgeItem
    render(<DecisionConfidencePanel data={makeData({ fragile })} />)
    const callout = screen.getByTestId('t1-flip-risk-callout')
    expect(callout).toBeInTheDocument()
    expect(callout).toHaveTextContent(/Hiring rate/)
    expect(callout).toHaveTextContent(/Option B/)
    expect(callout).toHaveTextContent(/42% probability/)
  })

  it('suppresses the flip-risk callout when no fragile edge is present', () => {
    render(<DecisionConfidencePanel data={makeData({ fragile: undefined })} />)
    expect(screen.queryByTestId('t1-flip-risk-callout')).not.toBeInTheDocument()
  })

  it('fires the dominant-factor nudge inside T1 when top influence ≥ 0.8', () => {
    const onSendMessage = vi.fn()
    render(
      <DecisionConfidencePanel
        data={makeData({
          topInfluence: 0.85,
          dominantFactorLabel: 'Pricing',
          dominantFactorId: 'node_pricing',
        })}
        onSendMessage={onSendMessage}
      />,
    )
    const nudge = screen.getByTestId('t1-dominant-nudge')
    expect(nudge).toBeInTheDocument()
    expect(nudge).toHaveTextContent(/Dominant factor/)
    expect(nudge).toHaveTextContent(/Pricing/)
    expect(nudge).toHaveTextContent(/85% of the outcome/)
    // Validate + Research chips render with handlers wired.
    expect(screen.getByLabelText(/Research Pricing/i)).toBeInTheDocument()
  })

  it('suppresses the dominant-factor nudge when top influence < 0.8', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ topInfluence: 0.5 })}
      />,
    )
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })

  it('Lane 2 (policy divergence): nudge gates on displayInfluence, not raw influenceScore — raw 0.95 / display 0.6 → suppressed', () => {
    // Under partial producer coverage the shared driverDisplayModel falls
    // back to normalised elasticity for EVERY driver; the panel bar shows
    // displayInfluence. A nudge keyed on the raw score would then claim a
    // dominance the same panel's bars contradict (the tornado had exactly
    // this bug — Codex final-audit B1).
    render(
      <DecisionConfidencePanel
        data={makeData({
          drivers: [
            makeDriver({
              influenceScore: 0.95,
              displayInfluence: 0.6,
              displayProvenance: 'normalised_elasticity',
            }),
          ],
          dominantFactorLabel: 'Pricing',
        })}
      />,
    )
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })

  it('Lane 2 (review fold): a SET-RELATIVE display value never fires the absolute dominance claim — display 1.0 (partial coverage) → suppressed', () => {
    // Under partial coverage the top driver's display value is 1.0 BY
    // CONSTRUCTION (set-normalised). "Drives 100% of the outcome" from that
    // basis is a fabricated causal share — and would contradict the V17
    // dominance gate (UI-SEM-040, absolute) on the same screen.
    render(
      <DecisionConfidencePanel
        data={makeData({
          drivers: [
            makeDriver({
              influenceScore: 0.3,
              displayInfluence: 1.0,
              displayProvenance: 'normalised_elasticity',
            }),
          ],
          dominantFactorLabel: 'Pricing',
          dominantFactorId: 'node_pricing',
        })}
      />,
    )
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })

  it('Lane 2 (review fold): the absolute claim fires on the PRODUCER basis — display 0.85 with influence_score provenance → "85% of the outcome"', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          drivers: [
            makeDriver({
              influenceScore: 0.85,
              displayInfluence: 0.85,
              displayProvenance: 'influence_score',
            }),
          ],
          dominantFactorLabel: 'Pricing',
          dominantFactorId: 'node_pricing',
        })}
      />,
    )
    const nudge = screen.getByTestId('t1-dominant-nudge')
    expect(nudge).toHaveTextContent(/85% of the outcome/)
  })

  it('DriversSection no longer renders any dominant-factor warning (legacy testid is gone)', () => {
    const drivers: DriverItem[] = [makeDriver({ influenceScore: 0.95 })]
    const driversData: DriversSectionData = {
      drivers,
      topDrivers: drivers,
      driversStatus: 'computed',
      totalCount: 1,
      hasMagnitudeData: true,
      dominantFactorId: 'node_top',
      dominantFactorLabel: 'Top factor',
    }
    render(<DriversSection data={driversData} />)
    expect(screen.queryByTestId('dominant-factor-warning')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Your result depends heavily on one factor/i),
    ).not.toBeInTheDocument()
  })

  it('renders the T1 checks footer with Winner / Robust / Evidence glyphs', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          recommendationStability: 0.92,
          gaps: [makeGap({ confidence: 80 })],
        })}
      />,
    )
    expect(screen.getByTestId('t1-checks-footer')).toBeInTheDocument()
    expect(screen.getByTestId('checks-winner')).toHaveTextContent('Has leading option')
    expect(screen.getByTestId('checks-robust')).toHaveTextContent('Robust')
    expect(screen.getByTestId('checks-evidence')).toHaveTextContent('Evidence covered')
    expect(screen.getByTestId('checks-addressed')).toHaveTextContent('1/1 addressed')
  })

  it('flips Robust to "Sensitive" on a sensitive display-safe verdict', () => {
    // The glyph follows the display-safe robustnessVerdict, not a UI-local
    // recommendationStability threshold or the structured PLoT level.
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessVerdict: 'moderate' })}
      />,
    )
    expect(screen.getByTestId('checks-robust')).toHaveTextContent('Sensitive')
  })

  const glyphIconClass = (testid: string) =>
    screen.getByTestId(testid).querySelector('svg')?.getAttribute('class') ?? ''

  it('shows "Robustness unknown" as a NEUTRAL state (not a red failure)', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessVerdict: undefined })}
      />,
    )
    expect(screen.getByTestId('checks-robust')).toHaveTextContent('Robustness unknown')
    // Unknown renders the muted neutral glyph, NOT the red danger "X" that would
    // falsely imply "not robust".
    expect(glyphIconClass('checks-robust')).toContain('text-text-light')
    expect(glyphIconClass('checks-robust')).not.toContain('text-danger')
  })

  it('renders Robust (success) and Sensitive (danger) distinctly from unknown', () => {
    const { rerender } = render(
      <DecisionConfidencePanel data={makeData({ robustnessVerdict: 'robust' })} />,
    )
    expect(glyphIconClass('checks-robust')).toContain('text-success')
    rerender(<DecisionConfidencePanel data={makeData({ robustnessVerdict: 'moderate' })} />)
    expect(glyphIconClass('checks-robust')).toContain('text-danger')
  })

  it('renders "Robustness not assessed" as a NEUTRAL state for the producer\'s stated absence (never "Sensitive")', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessVerdict: 'not_assessed' })}
      />,
    )
    expect(screen.getByTestId('checks-robust')).toHaveTextContent('Robustness not assessed')
    expect(glyphIconClass('checks-robust')).toContain('text-text-light')
    expect(glyphIconClass('checks-robust')).not.toContain('text-danger')
  })

  it('ignores the structured PLoT/fallback robustnessLevel for the glyph (renders unknown)', () => {
    // Proof of provenance: even when the structured robustnessLevel is 'high'
    // (PLoT report.robustness.level, or derived from recommendationStability via
    // UI-SEM-005), the glyph must read ONLY robustnessVerdict. With that absent —
    // as production always sets it today — the glyph stays "Robustness unknown".
    render(
      <DecisionConfidencePanel
        data={makeData({
          robustnessLevel: 'high',
          robustnessVerdict: undefined,
          recommendationStability: 0.99,
        })}
      />,
    )
    expect(screen.getByTestId('checks-robust')).toHaveTextContent('Robustness unknown')
  })

  it('flips Evidence to "Evidence gaps" when any review-card confidence < 50%', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [
            makeGap({ factorId: 'fac_low', confidence: 30 }),
            makeGap({ factorId: 'fac_ok', confidence: 80 }),
          ],
        })}
      />,
    )
    expect(screen.getByTestId('checks-evidence')).toHaveTextContent('Evidence gaps')
  })

  it('hides the addressed counter when there are no gaps to address', () => {
    render(<DecisionConfidencePanel data={makeData({ gaps: [] })} />)
    expect(screen.queryByTestId('checks-addressed')).not.toBeInTheDocument()
  })

  it('renders the embedded MissingKnowledgePrompt inside the T1 checks footer', () => {
    render(<DecisionConfidencePanel data={makeData()} />)
    const footer = screen.getByTestId('t1-checks-footer')
    expect(
      footer.querySelector('[data-testid="missing-knowledge-prompt"]'),
    ).not.toBeNull()
  })
})
