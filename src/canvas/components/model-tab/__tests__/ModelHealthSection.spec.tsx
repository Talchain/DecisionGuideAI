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
  it('renders with Audit title when CEE quality data is present', () => {
    render(<ModelHealthSection ceeQuality={{ overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }} />)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
    expect(screen.getByText('Audit')).toBeInTheDocument()
  })

  it('renders nothing pre-analysis when no audit data and no CEE quality', () => {
    const { container } = render(<ModelHealthSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when audit trail is all-null and no CEE quality', () => {
    const emptyAudit: AuditTrailData = {
      seedUsed: null,
      responseHash: null,
      nSamples: null,
      repairsApplied: null,
      inferenceWarnings: null,
      recommendationStability: null,
      autoNoiseApplied: null,
      stabilityPenaltyFactor: null,
    }
    const { container } = render(<ModelHealthSection auditTrail={emptyAudit} />)
    expect(container.firstChild).toBeNull()
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
})
