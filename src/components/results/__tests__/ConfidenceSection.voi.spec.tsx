/**
 * ConfidenceSection V11 Phase E: VOI promoted block tests
 *
 * Tests for the "Most valuable next step" block that appears in
 * sensitive/indeterminate states with hinge info.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceSection } from '../ConfidenceSection'
import type { ConfidenceSectionData, HingeInfo, TopAction } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

const baseData: ConfidenceSectionData = {
  tier: {
    tier: 'fair',
    icon: '⚠',
    label: 'Fair',
    description: 'Your model covers the basics.',
  },
  qualityScore: 55,
  uncertainties: [],
  topUncertainties: [],
  improvements: [],
  topImprovements: [],
  rankingStability: 0.65,
  robustnessStatus: 'computed',
}

const testHinge: HingeInfo = {
  label: 'Customer churn',
  nodeId: 'factor-churn',
  kind: 'edge',
  reason: 'fragile_edge',
  edgeDetail: 'Customer churn → Revenue',
  alternativeWinnerLabel: 'Option B',
}

const flippableAction: TopAction = {
  label: 'Customer churn',
  nodeId: 'factor-churn',
  couldFlip: true,
}

const nonFlippableAction: TopAction = {
  label: 'Market size',
  nodeId: 'factor-market',
  couldFlip: false,
}

describe('ConfidenceSection: V11 VOI promoted block', () => {
  it('shows VOI block for sensitive state with hinge', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    const block = screen.getByTestId('voi-promoted-block')
    expect(block).toBeInTheDocument()
    expect(screen.getByText('Most valuable next step')).toBeInTheDocument()
    expect(screen.getByText(/Validate Customer churn/)).toBeInTheDocument()
  })

  it('shows VOI block for indeterminate state with hinge', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="indeterminate"
        hinge={testHinge}
        topAction={nonFlippableAction}
      />
    )

    expect(screen.getByTestId('voi-promoted-block')).toBeInTheDocument()
    expect(screen.getByText('Most valuable next step')).toBeInTheDocument()
  })

  it('hides VOI block for robust state', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="robust"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    expect(screen.queryByTestId('voi-promoted-block')).not.toBeInTheDocument()
  })

  it('hides VOI block when hinge is null', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={null}
        topAction={null}
      />
    )

    expect(screen.queryByTestId('voi-promoted-block')).not.toBeInTheDocument()
  })

  it('hides VOI block when decisionState is not provided (legacy)', () => {
    render(
      <ConfidenceSection
        data={baseData}
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    expect(screen.queryByTestId('voi-promoted-block')).not.toBeInTheDocument()
  })

  it('shows "Could change the recommendation" when topAction.couldFlip', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    expect(screen.getByTestId('voi-could-flip')).toBeInTheDocument()
    expect(screen.getByText('Could change the recommendation')).toBeInTheDocument()
  })

  it('hides "Could change the recommendation" when !topAction.couldFlip', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={nonFlippableAction}
      />
    )

    expect(screen.queryByTestId('voi-could-flip')).not.toBeInTheDocument()
  })

  it('hides "Could change the recommendation" when topAction is null', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={null}
      />
    )

    expect(screen.queryByTestId('voi-could-flip')).not.toBeInTheDocument()
  })

  it('shows "Strongest driver" copy for fragile_edge hinge', () => {
    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    expect(screen.getByText(/Strongest driver, widest uncertainty/)).toBeInTheDocument()
  })

  it('shows "Highest information value" copy for VOI hinge', () => {
    const voiHinge: HingeInfo = {
      label: 'Market size',
      nodeId: 'factor-market',
      kind: 'node',
      reason: 'voi',
      edgeDetail: null,
      alternativeWinnerLabel: null,
    }

    render(
      <ConfidenceSection
        data={baseData}
        decisionState="sensitive"
        hinge={voiHinge}
        topAction={nonFlippableAction}
      />
    )

    expect(screen.getByText(/Highest information value/)).toBeInTheDocument()
    expect(screen.queryByText(/Strongest driver/)).not.toBeInTheDocument()
  })
})

describe('ConfidenceSection: V11 hinge de-duplication', () => {
  it('excludes hinge factor from fragile edge cards when excludeFactorIds provided', () => {
    const dataWithEdges: ConfidenceSectionData = {
      ...baseData,
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'If "Customer churn → Revenue" changes, recommendation shifts',
          displayText: 'If "Customer churn → Revenue" changes, recommendation shifts',
          affectedNodes: ['factor-churn', 'outcome-revenue'],
          severity: 'critical',
        },
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'If "Market size → Revenue" changes, recommendation shifts',
          displayText: 'If "Market size → Revenue" changes, recommendation shifts',
          affectedNodes: ['factor-market', 'outcome-revenue'],
          severity: 'warning',
        },
      ],
      topUncertainties: [],
    }

    render(
      <ConfidenceSection
        data={dataWithEdges}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={flippableAction}
        excludeFactorIds={['factor-churn']}
      />
    )

    // Only the non-excluded edge should render (V12.1 Fix 4: from_label only)
    expect(screen.getByText('Market size')).toBeInTheDocument()
    // The excluded edge (hinge factor) should not render as a card
    expect(screen.queryByText('Customer churn')).not.toBeInTheDocument()
  })

  it('shows all fragile edges when no excludeFactorIds', () => {
    const dataWithEdges: ConfidenceSectionData = {
      ...baseData,
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'If "Customer churn → Revenue" changes',
          displayText: 'If "Customer churn → Revenue" changes',
          affectedNodes: ['factor-churn', 'outcome-revenue'],
        },
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'If "Market size → Revenue" changes',
          displayText: 'If "Market size → Revenue" changes',
          affectedNodes: ['factor-market', 'outcome-revenue'],
        },
      ],
      topUncertainties: [],
    }

    render(
      <ConfidenceSection
        data={dataWithEdges}
        decisionState="sensitive"
        hinge={testHinge}
      />
    )

    // V12.1 Fix 4: from_label only (no arrow paths)
    expect(screen.getByText('Customer churn')).toBeInTheDocument()
    expect(screen.getByText('Market size')).toBeInTheDocument()
  })
})
