/**
 * DecisionConfidencePanel auto-noise disclosure tests (audit B3, P0).
 *
 * The visible marker (Info icon + Tooltip) is anchored next to the
 * "Decision confidence" title via TriageHealthHeader's `titleAdornment`
 * slot. It renders only when PLoT explicitly emitted
 * `applied=true && is_provisional=true` for this run; cached / older
 * payloads (no provenance) yield no marker — graceful degradation.
 *
 * Mirrors the A1 DriversSection.provenance.spec.tsx test pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  AutoNoiseProvenance,
  ConfidenceSectionData,
  DriversSectionData,
  DriverItem,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
} from '../types'
import { useCanvasStore } from '@/canvas/store'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: 'Top driver',
    rawElasticity: 1,
    normalisedInfluence: 1,
    influenceScore: 0.9,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_top',
    ...overrides,
  }
}

function provisionalProvenance(
  overrides: Partial<AutoNoiseProvenance> = {},
): AutoNoiseProvenance {
  return {
    applied: true,
    effect: 'widens_outcome_and_risk_uncertainty',
    formulaVersion: 'plot_auto_v1',
    multiplier: 1.0,
    noiseDistribution: 'normal_zero_mean_outcome_std',
    filterScope: 'outcome_and_risk_nodes',
    isProvisional: true,
    calibrationStatus: 'provisional_pending_pilot_calibration',
    ...overrides,
  }
}

function makeData(
  autoNoiseProvenance: AutoNoiseProvenance | null,
): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [makeDriver()],
    topDrivers: [makeDriver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
  } as ConfidenceSectionData

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
    goalLabel: 'Maximise success',
    autoNoiseProvenance,
  } as ResultsSectionDataReturn
}

beforeEach(() => {
  useCanvasStore.setState({ draftCoaching: null })
})

describe('DecisionConfidencePanel — auto-noise provenance disclosure (audit B3)', () => {
  it('renders the visible marker when applied=true and isProvisional=true', () => {
    render(<DecisionConfidencePanel data={makeData(provisionalProvenance())} onSendMessage={() => {}} />)
    const marker = screen.getByTestId('auto-noise-provisional-marker')
    expect(marker).toBeInTheDocument()
    // Marker is anchored inside the trust panel header.
    const card = screen.getByTestId('t1-decision-confidence-card')
    expect(card.contains(marker)).toBe(true)
  })

  it('hides the marker when applied=false (no firing)', () => {
    render(
      <DecisionConfidencePanel
        data={makeData(provisionalProvenance({ applied: false }))}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('auto-noise-provisional-marker')).toBeNull()
  })

  it('hides the marker when isProvisional=false (post-calibration future state)', () => {
    render(
      <DecisionConfidencePanel
        data={makeData(provisionalProvenance({ isProvisional: false }))}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('auto-noise-provisional-marker')).toBeNull()
  })

  it('graceful degradation: missing provenance (old PLoT payload) renders without crashing and without the marker', () => {
    expect(() =>
      render(<DecisionConfidencePanel data={makeData(null)} onSendMessage={() => {}} />),
    ).not.toThrow()
    expect(screen.queryByTestId('auto-noise-provisional-marker')).toBeNull()
    // Trust panel header itself still renders.
    expect(screen.getByTestId('confidence-health-header')).toBeInTheDocument()
  })

  it('marker exposes the disclosure aria-label', () => {
    render(<DecisionConfidencePanel data={makeData(provisionalProvenance())} onSendMessage={() => {}} />)
    const marker = screen.getByTestId('auto-noise-provisional-marker')
    expect(marker).toHaveAttribute(
      'aria-label',
      'Outcome uncertainty adjustment — operational estimate pending pilot calibration',
    )
  })

  it('hovering the marker reveals the verbatim tooltip copy', async () => {
    // Tooltip primitive wraps the marker in a <div> that owns Floating UI's
    // useHover. Hover events must target that wrapper (mirrors the A1
    // DriversSection.provenance.spec.tsx pattern).
    render(<DecisionConfidencePanel data={makeData(provisionalProvenance())} onSendMessage={() => {}} />)
    const marker = screen.getByTestId('auto-noise-provisional-marker')
    const tooltipRef = marker.parentElement!
    fireEvent.pointerEnter(tooltipRef)
    fireEvent.mouseEnter(tooltipRef)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toBe(
      'Outcome ranges include an operational uncertainty adjustment pending pilot calibration.',
    )
  })

  it('focusing the marker reveals the same tooltip (keyboard accessibility)', async () => {
    render(<DecisionConfidencePanel data={makeData(provisionalProvenance())} onSendMessage={() => {}} />)
    const marker = screen.getByTestId('auto-noise-provisional-marker') as HTMLButtonElement
    marker.focus()

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toBe(
      'Outcome ranges include an operational uncertainty adjustment pending pilot calibration.',
    )
  })

  it('marker hit area extends to ≥44px via the `before:-inset-4` pseudo-element pattern', () => {
    // Touch target spec: WCAG 2.5.5 / DS v5 require ≥44px on every axis.
    // Icon glyph is w-3.5 h-3.5 (14px); -inset-4 (16px on each side) gives
    // 14 + 32 = 46px effective hit area. Asserting the class presence
    // pins the configuration so a future drift back to -inset-3 (38px)
    // fails this test.
    render(<DecisionConfidencePanel data={makeData(provisionalProvenance())} onSendMessage={() => {}} />)
    const marker = screen.getByTestId('auto-noise-provisional-marker')
    expect(marker.className).toContain('before:-inset-4')
    expect(marker.className).not.toMatch(/before:-inset-(0|1|2|3)\b/)
  })

  it('payload-only enum literals never appear in the rendered DOM', () => {
    render(<DecisionConfidencePanel data={makeData(provisionalProvenance())} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')
    const text = card.textContent ?? ''
    expect(text).not.toMatch(/plot_auto_v1/)
    expect(text).not.toMatch(/normal_zero_mean_outcome_std/)
    expect(text).not.toMatch(/outcome_and_risk_nodes/)
    expect(text).not.toMatch(/widens_outcome_and_risk_uncertainty/)
    expect(text).not.toMatch(/provisional_pending_pilot_calibration/)
    // No "auto-noise" / "variance" jargon in user-facing copy.
    expect(text).not.toMatch(/auto-noise/i)
    expect(text).not.toMatch(/variance/i)
  })
})
