/**
 * ModelHealthSection — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, title, testId }: { children: React.ReactNode; title: string; testId?: string }) => (
    <div data-testid={testId}>
      <span>{title}</span>
      {children}
    </div>
  ),
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  countEdgesWithEvidence: () => ({ evidenced: 0, total: 0 }),
}))

const makeNode = (id: string): Node => ({
  id,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: id },
})

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
})

describe('ModelHealthSection', () => {
  it('renders without crashing', () => {
    render(<ModelHealthSection nodes={[]} edges={[]} />)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
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
    render(<ModelHealthSection nodes={[makeNode('n1')]} edges={[]} auditTrail={auditTrail} />)
    expect(screen.getByTestId('root-node-warning')).toBeInTheDocument()
    expect(screen.getByText(/2 factors have no value set/)).toBeInTheDocument()
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
    render(<ModelHealthSection nodes={[makeNode('n1')]} edges={[]} auditTrail={auditTrail} />)
    expect(screen.queryByTestId('root-node-warning')).not.toBeInTheDocument()
  })

  it('shows audit trail in detail mode', () => {
    // The DetailToggleContext needs to be provided — our Accordion mock renders children directly
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
        <ModelHealthSection nodes={[makeNode('n1')]} edges={[]} auditTrail={auditTrail} />
      </DetailToggleContext.Provider>
    )
    expect(screen.getByTestId('model-health-audit')).toBeInTheDocument()
    expect(screen.getByText('325022')).toBeInTheDocument()
    expect(screen.getByText('4d11687e9836')).toBeInTheDocument()
    expect(screen.getByText(/DEFAULT_EXISTS_PROBABILITY \(x2\)/)).toBeInTheDocument()
  })
})
