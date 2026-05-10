/**
 * ModelHealthSection (Audit) — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, title, tierLabel, testId }: { children: React.ReactNode; title: string; tierLabel?: string; testId?: string }) => (
    <div data-testid={testId}>
      <span>{title}</span>
      {tierLabel && <span data-testid="accordion-tier-label">{tierLabel}</span>}
      {children}
    </div>
  ),
}))

describe('ModelHealthSection', () => {
  it('renders with Model card title when CEE quality data is present', () => {
    render(<ModelHealthSection ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }} />)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
    expect(screen.getByText('Model card')).toBeInTheDocument()
  })

  it('renders pre-analysis content when no audit data and no CEE quality', () => {
    render(<ModelHealthSection factorCount={4} edgeCount={6} factorsToVerify={2} />)
    expect(screen.getByTestId('model-card-pre-analysis')).toBeInTheDocument()
    expect(screen.getByText(/4 factors and 6 relationships/)).toBeInTheDocument()
    expect(screen.getByText(/2 factors need your input/)).toBeInTheDocument()
    expect(screen.getByText(/Run analysis to see stability/)).toBeInTheDocument()
  })

  it('renders pre-analysis content when audit trail is all-null and no CEE quality', () => {
    const emptyAudit: AuditTrailData = {
      seedUsed: null,
      responseHash: null,
      nSamples: null,
      repairsApplied: null,
      inferenceWarnings: null,
      recommendationStability: null,
      autoNoiseApplied: null,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: null,
    }
    render(<ModelHealthSection auditTrail={emptyAudit} factorCount={3} edgeCount={5} />)
    expect(screen.getByTestId('model-card-pre-analysis')).toBeInTheDocument()
  })

  it('renders when only CEE quality is present (post-analysis with no audit trail)', () => {
    render(<ModelHealthSection ceeQuality={{ overall: 6.5, structure: 7, causality: 6, coverage: 6.5, safety: 6 }} />)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
  })

  it('renders when audit trail has any signal (e.g. only seedUsed set)', () => {
    const auditTrail: AuditTrailData = {
      seedUsed: '12345',
      responseHash: null,
      nSamples: null,
      repairsApplied: null,
      inferenceWarnings: null,
      recommendationStability: null,
      autoNoiseApplied: null,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: null,
    }
    render(<ModelHealthSection auditTrail={auditTrail} />)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
  })

  it('shows stability and quality in accordion header (visible when collapsed)', () => {
    const auditTrail: AuditTrailData = {
      seedUsed: null,
      responseHash: null,
      nSamples: null,
      repairsApplied: null,
      inferenceWarnings: null,
      recommendationStability: 0.71,
      autoNoiseApplied: null,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: null,
    }
    render(<ModelHealthSection auditTrail={auditTrail} ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }} />)
    const tierLabel = screen.getByTestId('accordion-tier-label')
    expect(tierLabel).toHaveTextContent('71% stability')
    expect(tierLabel).toHaveTextContent('7.2 / 10')
  })

  it('shows root node warning when inference_warnings contain ROOT_NODE_DEFAULT_VALUE', () => {
    const auditTrail: AuditTrailData = {
      seedUsed: '12345',
      responseHash: 'abc123',
      nSamples: 1000,
      repairsApplied: null,
      inferenceWarnings: [
        { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'warning', message: 'Node has default value' },
        { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'warning', message: 'Node has default value' },
      ],
      recommendationStability: null,
      autoNoiseApplied: null,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: null,
    }
    render(<ModelHealthSection auditTrail={auditTrail} />)
    expect(screen.getByTestId('root-node-warning')).toBeInTheDocument()
    expect(screen.getByText(/2 factors have no value set/)).toBeInTheDocument()
  })

  it('shows penalty text when stabilityPenaltyFactor < 1.0', () => {
    const auditTrail: AuditTrailData = {
      seedUsed: null,
      responseHash: null,
      nSamples: null,
      repairsApplied: null,
      inferenceWarnings: [
        { code: 'ROOT_NODE_DEFAULT_VALUE', severity: 'warning', message: 'test' },
      ],
      recommendationStability: null,
      autoNoiseApplied: null,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: 0.90,
    }
    render(<ModelHealthSection auditTrail={auditTrail} />)
    expect(screen.getByText(/Penalty: 0.90x stability/)).toBeInTheDocument()
  })

  it('does not show root node warning when no inference warnings', () => {
    const auditTrail: AuditTrailData = {
      seedUsed: '12345',
      responseHash: 'abc123',
      nSamples: 1000,
      repairsApplied: null,
      inferenceWarnings: null,
      recommendationStability: null,
      autoNoiseApplied: null,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: null,
    }
    render(<ModelHealthSection auditTrail={auditTrail} />)
    expect(screen.queryByTestId('root-node-warning')).not.toBeInTheDocument()
  })

  it('shows audit trail in detail mode', () => {
    const auditTrail: AuditTrailData = {
      seedUsed: '325022',
      responseHash: '4d11687e9836abcdef',
      nSamples: 1000,
      repairsApplied: [
        { code: 'DEFAULT_EXISTS_PROBABILITY', field_path: 'edges[0]', reason: 'No exists_probability provided' },
        { code: 'DEFAULT_EXISTS_PROBABILITY', field_path: 'edges[1]', reason: 'No exists_probability provided' },
      ],
      inferenceWarnings: null,
      recommendationStability: 0.71,
      autoNoiseApplied: true,
      autoNoiseProvenance: null,
      stabilityPenaltyFactor: null,
    }
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection auditTrail={auditTrail} />
      </DetailToggleContext.Provider>
    )
    expect(screen.getByTestId('model-health-audit')).toBeInTheDocument()
    expect(screen.getByText('325022')).toBeInTheDocument()
    expect(screen.getByText('4d11687e9836')).toBeInTheDocument()
    expect(screen.getByText(/DEFAULT_EXISTS_PROBABILITY \(x2\)/)).toBeInTheDocument()
  })

  it('shows quality sub-scores (without Overall) in detail mode', () => {
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }} />
      </DetailToggleContext.Provider>
    )
    // Overall is in the accordion header, not in the detail sub-scores
    expect(screen.queryByTestId('quality-row-overall')).not.toBeInTheDocument()
    expect(screen.getByTestId('quality-row-structure')).toBeInTheDocument()
    expect(screen.getByTestId('quality-row-causality')).toBeInTheDocument()
    expect(screen.getByTestId('quality-row-coverage')).toBeInTheDocument()
    expect(screen.getByTestId('quality-row-safety')).toBeInTheDocument()
  })

  it('hides quality sub-scores when detail is off', () => {
    render(
      <DetailToggleContext.Provider value={{ showDetail: false }}>
        <ModelHealthSection ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }} />
      </DetailToggleContext.Provider>
    )
    expect(screen.queryByTestId('quality-row-structure')).not.toBeInTheDocument()
  })

  // ─── Audit B3: auto-noise disclosure copy ────────────────────────────────
  describe('auto-noise disclosure (audit B3)', () => {
    function makeAudit(overrides: Partial<AuditTrailData>): AuditTrailData {
      return {
        seedUsed: '42',
        responseHash: 'abc',
        nSamples: 1000,
        repairsApplied: null,
        inferenceWarnings: null,
        recommendationStability: null,
        autoNoiseApplied: null,
        autoNoiseProvenance: null,
        stabilityPenaltyFactor: null,
        ...overrides,
      }
    }

    it('renders non-technical copy when auto-noise was applied', () => {
      render(
        <DetailToggleContext.Provider value={{ showDetail: true }}>
          <ModelHealthSection auditTrail={makeAudit({ autoNoiseApplied: true })} />
        </DetailToggleContext.Provider>
      )
      const row = screen.getByTestId('model-health-auto-noise-row')
      expect(row).toHaveTextContent('Operational adjustment applied (calibration pending).')
      expect(screen.getByText('Outcome uncertainty adjustment')).toBeInTheDocument()
    })

    it('renders non-technical copy when auto-noise was not applied', () => {
      render(
        <DetailToggleContext.Provider value={{ showDetail: true }}>
          <ModelHealthSection auditTrail={makeAudit({ autoNoiseApplied: false })} />
        </DetailToggleContext.Provider>
      )
      const row = screen.getByTestId('model-health-auto-noise-row')
      expect(row).toHaveTextContent('No additional uncertainty adjustment applied.')
    })

    it('omits the row entirely when autoNoiseApplied is null (legacy/no signal)', () => {
      render(
        <DetailToggleContext.Provider value={{ showDetail: true }}>
          <ModelHealthSection auditTrail={makeAudit({ autoNoiseApplied: null })} />
        </DetailToggleContext.Provider>
      )
      expect(screen.queryByTestId('model-health-auto-noise-row')).not.toBeInTheDocument()
    })

    it('falls back to autoNoiseProvenance.applied when autoNoiseApplied is null but provenance is valid', () => {
      // Defensive guard against payload drift: a future PLoT build that
      // emits structured provenance without the boolean echo should still
      // populate the accordion row. Today's PLoT always emits both, so
      // this is an audit-feedback Imp-3 follow-up.
      render(
        <DetailToggleContext.Provider value={{ showDetail: true }}>
          <ModelHealthSection
            auditTrail={makeAudit({
              autoNoiseApplied: null,
              autoNoiseProvenance: {
                applied: true,
                effect: 'widens_outcome_and_risk_uncertainty',
                formulaVersion: 'plot_auto_v1',
                multiplier: 1.0,
                noiseDistribution: 'normal_zero_mean_outcome_std',
                filterScope: 'outcome_and_risk_nodes',
                isProvisional: true,
                calibrationStatus: 'provisional_pending_pilot_calibration',
              },
            })}
          />
        </DetailToggleContext.Provider>
      )
      const row = screen.getByTestId('model-health-auto-noise-row')
      expect(row).toHaveTextContent('Operational adjustment applied (calibration pending).')
    })

    it('uses no user-facing technical jargon — payload-only fields stay out of the DOM', () => {
      render(
        <DetailToggleContext.Provider value={{ showDetail: true }}>
          <ModelHealthSection
            auditTrail={makeAudit({
              autoNoiseApplied: true,
              autoNoiseProvenance: {
                applied: true,
                effect: 'widens_outcome_and_risk_uncertainty',
                formulaVersion: 'plot_auto_v1',
                multiplier: 1.0,
                noiseDistribution: 'normal_zero_mean_outcome_std',
                filterScope: 'outcome_and_risk_nodes',
                isProvisional: true,
                calibrationStatus: 'provisional_pending_pilot_calibration',
              },
            })}
          />
        </DetailToggleContext.Provider>
      )
      const audit = screen.getByTestId('model-health-audit')
      const text = audit.textContent ?? ''
      // Payload-only enum literals must never leak into rendered text.
      expect(text).not.toMatch(/plot_auto_v1/)
      expect(text).not.toMatch(/normal_zero_mean_outcome_std/)
      expect(text).not.toMatch(/outcome_and_risk_nodes/)
      expect(text).not.toMatch(/widens_outcome_and_risk_uncertainty/)
      expect(text).not.toMatch(/provisional_pending_pilot_calibration/)
      expect(text).not.toMatch(/auto-noise/i)
      expect(text).not.toMatch(/variance/i)
    })
  })
})
