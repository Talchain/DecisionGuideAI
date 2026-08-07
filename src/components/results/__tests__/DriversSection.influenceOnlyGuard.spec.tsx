/**
 * DriversSection — INFLUENCE-ONLY guard (acceptance #6).
 *
 * Driver pills must state INFLUENCE only and must NEVER render a
 * stability / robustness / confidence / readiness / evidence claim derived from
 * raw fields. This guard locks the influence-label vocabulary and asserts none
 * of the removed claim labels (or the raw-confidence column) can reappear — it
 * is intentionally broader than the literal string "Important and stable".
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem, DriverSemanticLabel } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.8,
    influenceScore: 0.8,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

// Influence-only vocabulary (the ONLY labels a driver pill may show).
const INFLUENCE_LABELS: Record<DriverSemanticLabel, string> = {
  biggest: 'Top driver',
  strong: 'High-impact driver',
  moderate: 'Moderate influence',
  minor: 'Lower influence',
}

// Removed stability / confidence / evidence claim labels — must never reappear.
const BANNED_CLAIM_LABELS = [
  'Important and stable',
  'High impact, low evidence',
  'High confidence',
  'Moderate confidence',
  'Low confidence',
  'Could benefit from more evidence',
  'Ranking may shift',
]

describe('DriversSection — influence-only guard', () => {
  it.each(Object.entries(INFLUENCE_LABELS) as Array<[DriverSemanticLabel, string]>)(
    'semanticLabel "%s" → influence-only pill "%s" (even at high raw confidence)',
    (semanticLabel, expected) => {
      render(
        <DriversSection
          data={makeData([makeDriver({ factorKey: 'fac', semanticLabel, confidence: 0.95 })])}
          goalLabel="test"
        />,
      )
      expect(screen.getByTestId('driver-influence-pill-fac')).toHaveTextContent(expected)
    },
  )

  it('renders NONE of the removed stability/confidence/evidence claim labels (high raw confidence)', () => {
    render(
      <DriversSection
        data={makeData([
          makeDriver({ factorKey: 'fac', semanticLabel: 'biggest', confidence: 0.95, isDefaultedConfidence: true }),
        ])}
        goalLabel="test"
      />,
    )
    for (const label of BANNED_CLAIM_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    // No raw-confidence column: no bar, no glyph, no default-estimate icon.
    expect(screen.queryByRole('progressbar', { name: /confidence:/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('confidence-glyph-fac')).not.toBeInTheDocument()
    expect(screen.queryByTestId('default-estimate-icon')).not.toBeInTheDocument()
    // The pill is one of the four allowed influence labels.
    const pill = screen.getByTestId('driver-influence-pill-fac')
    expect(Object.values(INFLUENCE_LABELS)).toContain(pill.textContent?.trim())
  })

  it('an unknown/missing semanticLabel falls back to a neutral influence label (never a claim)', () => {
    render(
      <DriversSection
        // Force a malformed semanticLabel at runtime; must not crash or claim.
        data={makeData([makeDriver({ factorKey: 'fac', semanticLabel: 'bogus' as unknown as DriverSemanticLabel, confidence: 0.95 })])}
        goalLabel="test"
      />,
    )
    const pill = screen.getByTestId('driver-influence-pill-fac')
    expect(Object.values(INFLUENCE_LABELS)).toContain(pill.textContent?.trim())
    expect(screen.queryByText('Important and stable')).not.toBeInTheDocument()
  })

  it('a driver triggering EVERY non-influence signal renders none of them (influence only)', () => {
    // One top driver that would, pre-fix, trigger: the confidence column + glyph
    // + default-estimate + provisional header marker (low/defaulted/provisional
    // confidence), the technique chip (influence>0.6 && conf<0.5), the
    // "Ranking may shift" row (rankFlipRate>=0.15), and the "If wrong, X
    // overtakes" microline (fragile edge). All must be hidden; only the
    // influence pill + Sensitivity remain.
    render(
      <DriversSection
        data={makeData([
          makeDriver({
            factorKey: 'fac',
            semanticLabel: 'biggest',
            influenceScore: 0.9,
            confidence: 0.3,
            isDefaultedConfidence: true,
            hasContestedEdge: true,
            rankFlipRate: 0.4,
            fragileEdgeInfo: { switchProbability: 0.4, alternativeWinnerLabel: 'Option B' },
            confidenceProvenance: {
              computationSource: 'plot_unified_from_isl_bootstrap',
              formulaVersion: 'plot_unified_v2',
              isProvisional: true,
              calibrationStatus: 'provisional_pending_pilot_calibration',
              inputQuality: 'standard',
            },
          } as DriverItem),
        ])}
        goalLabel="test"
        onSendMessage={() => {}}
      />,
    )
    // Influence pill present (the one allowed signal).
    expect(screen.getByTestId('driver-influence-pill-fac')).toHaveTextContent('Top driver')
    // None of the non-influence signals.
    expect(screen.queryByTestId('drivers-confidence-header')).toBeNull()
    expect(screen.queryByTestId('drivers-confidence-provisional-marker')).toBeNull()
    expect(screen.queryByTestId('confidence-glyph-fac')).toBeNull()
    expect(screen.queryByTestId('default-estimate-icon')).toBeNull()
    expect(screen.queryByTestId('driver-technique-chip-fac')).toBeNull()
    expect(screen.queryByTestId('driver-ranking-shift-fac')).toBeNull()
    expect(screen.queryByTestId('driver-microline')).toBeNull()
    expect(screen.queryByText(/Ranking may shift/i)).toBeNull()
    expect(screen.queryByText(/overtakes/i)).toBeNull()
    expect(screen.queryByText(/reference class forecasting/i)).toBeNull()
    // Contested-driver confidence control (Weakly/Moderately/Strongly presets +
    // the "Custom confidence value" input) is hidden too.
    expect(screen.queryByText('Weakly')).toBeNull()
    expect(screen.queryByText('Moderately')).toBeNull()
    expect(screen.queryByText('Strongly')).toBeNull()
    expect(screen.queryByLabelText('Custom confidence value')).toBeNull()
  })

  it('does NOT render the decision-flip line even with the tooltip OPEN (decisionChangeRisk gated)', () => {
    // Force the (i) info icon to appear via enrichment (an always-visible
    // influence explanation), so we can open the top-driver tooltip and prove
    // the fragility/decision-flip line is gated off inside it. (The zero-reason
    // lever line now renders as a visible body badge, not in the tooltip — D-U.)
    render(
      <DriversSection
        data={makeData([
          makeDriver({
            factorKey: 'fac',
            semanticLabel: 'biggest',
            influenceScore: 0.9,
            flipRiskCategory: 'isolated',
            fragileEdgeInfo: { switchProbability: 0.35, alternativeWinnerLabel: 'Option B' },
            enrichment: {
              factor_id: 'fac',
              factor_label: 'fac',
              observations: ['An always-visible enrichment observation'],
              perspectives: [],
            },
          } as DriverItem),
        ])}
        goalLabel="test"
      />,
    )
    // Open the tooltip via the info button.
    fireEvent.click(screen.getByRole('button', { name: /more information/i }))
    // The tooltip is open (the enrichment "Insights" disclosure shows)...
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
    // ...but the decision-flip / fragility line is hidden.
    expect(screen.queryByText(/becomes the better choice/i)).toBeNull()
    expect(screen.queryByText(/can change which option is best/i)).toBeNull()
  })

  it('renders the zero-reason lever explanation as a VISIBLE badge, not inside the tooltip (D-U)', () => {
    render(
      <DriversSection
        data={makeData([
          makeDriver({
            factorKey: 'fac',
            semanticLabel: 'biggest',
            influenceScore: 0.9,
            zeroReason: 'intervention_override',
          } as DriverItem),
        ])}
        goalLabel="test"
      />,
    )
    // The badge is visible without any hover/click.
    const badge = screen.getByTestId('driver-lever-badge-fac')
    expect(badge).toHaveTextContent(/controlled by your options/i)
    // No tooltip trigger is forced into existence by the zero-reason alone.
    expect(screen.queryByRole('button', { name: /more information/i })).toBeNull()
  })
})
