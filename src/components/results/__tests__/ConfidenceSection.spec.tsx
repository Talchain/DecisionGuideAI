/**
 * ConfidenceSection Tests
 *
 * Tests for the "What needs attention" panel - merged confidence + improvements.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfidenceSection } from '../ConfidenceSection'
import type { ConfidenceSectionData } from '../types'

// Mock focusNodeById
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

describe('ConfidenceSection', () => {
  const mockData: ConfidenceSectionData = {
    tier: {
      tier: 'strong',
      icon: '✓',
      label: 'Good foundation',
      description: 'Your model captures this decision well.',
    },
    qualityScore: 75,
    uncertainties: [
      {
        code: 'SENSITIVE_ASSUMPTION',
        message: 'Some assumptions may significantly affect results',
        suggestion: 'Consider validating with additional data',
      },
    ],
    topUncertainties: [
      {
        code: 'SENSITIVE_ASSUMPTION',
        message: 'Some assumptions may significantly affect results',
        suggestion: 'Consider validating with additional data',
      },
    ],
    improvements: [
      {
        action: 'Add more data sources',
        reason: 'Improve model confidence',
        priority: 1,
        source: 'bias',
      },
    ],
    topImprovements: [
      {
        action: 'Add more data sources',
        reason: 'Improve model confidence',
        priority: 1,
        source: 'bias',
      },
    ],
    rankingStability: 0.85,
  }

  it('renders the component with content', () => {
    render(<ConfidenceSection data={mockData} />)

    // Component should render - title is now in parent panel header
    // Check that some expected content is present
    expect(screen.getByText('Uncertainties')).toBeInTheDocument()
    expect(screen.getByText('Improvements')).toBeInTheDocument()
  })

  it('renders strong confidence tier with items correctly', () => {
    // mockData has uncertainties and improvements, so shows "items to consider" variant
    render(<ConfidenceSection data={mockData} />)

    expect(screen.getByText(/Good foundation/)).toBeInTheDocument()
    expect(screen.getByText(/a few items to consider below/)).toBeInTheDocument()
  })

  it('renders fair confidence tier correctly', () => {
    const fairData: ConfidenceSectionData = {
      ...mockData,
      tier: {
        tier: 'fair',
        icon: '⚠',
        label: 'Partial picture',
        description: 'Your model covers the basics. Address the items below.',
      },
      qualityScore: 55,
    }

    render(<ConfidenceSection data={fairData} />)

    expect(screen.getByText('Partial picture')).toBeInTheDocument()
    expect(screen.getByText('Your model covers the basics. Address the items below.')).toBeInTheDocument()
  })

  it('renders needs_work confidence tier correctly', () => {
    const needsWorkData: ConfidenceSectionData = {
      ...mockData,
      tier: {
        tier: 'needs_work',
        icon: '⚠',
        label: 'Early sketch',
        description: 'Add the missing elements below before relying on the recommendation.',
      },
      qualityScore: 25,
    }

    render(<ConfidenceSection data={needsWorkData} />)

    expect(screen.getByText('Early sketch')).toBeInTheDocument()
  })

  it('renders uncertainties', () => {
    render(<ConfidenceSection data={mockData} />)

    expect(screen.getByText('Uncertainties')).toBeInTheDocument()
    expect(screen.getByText('Some assumptions may significantly affect results')).toBeInTheDocument()
  })

  it('renders suggestion for uncertainties', () => {
    render(<ConfidenceSection data={mockData} />)

    expect(screen.getByText(/Consider validating/)).toBeInTheDocument()
  })

  it('renders improvements section', () => {
    render(<ConfidenceSection data={mockData} />)

    expect(screen.getByText('Improvements')).toBeInTheDocument()
    expect(screen.getByText('Add more data sources')).toBeInTheDocument()
  })

  it('shows "ready to decide" message when strong tier with no issues', () => {
    const fullyReadyData: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [],
      topUncertainties: [],
      improvements: [],
      topImprovements: [],
      robustnessStatus: 'computed',
    }

    render(<ConfidenceSection data={fullyReadyData} />)

    expect(screen.getByText(/Your model looks good/)).toBeInTheDocument()
    expect(screen.getByText(/You're ready to decide/)).toBeInTheDocument()
  })

  it('shows "items to consider" when strong tier has uncertainties', () => {
    const strongWithUncertaintiesData: ConfidenceSectionData = {
      ...mockData,
      improvements: [],
      topImprovements: [],
    }

    render(<ConfidenceSection data={strongWithUncertaintiesData} />)

    expect(screen.getByText(/Good foundation — a few items to consider below/)).toBeInTheDocument()
  })

  it('shows "items to consider" when strong tier has improvements', () => {
    const strongWithImprovementsData: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [],
      topUncertainties: [],
    }

    render(<ConfidenceSection data={strongWithImprovementsData} />)

    expect(screen.getByText(/Good foundation — a few items to consider below/)).toBeInTheDocument()
  })

  it('renders evidence coverage when available', () => {
    const dataWithEvidence: ConfidenceSectionData = {
      ...mockData,
      evidenceCoverage: {
        backedByData: 5,
        needsValidation: 3,
      },
    }

    render(<ConfidenceSection data={dataWithEvidence} />)

    expect(screen.getByText(/5 assumptions backed by data/)).toBeInTheDocument()
    expect(screen.getByText(/3 need validation/)).toBeInTheDocument()
  })

  it('expands to show more uncertainties', () => {
    const manyUncertaintiesData: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [
        { code: 'A', message: 'Uncertainty 1' },
        { code: 'B', message: 'Uncertainty 2' },
        { code: 'C', message: 'Uncertainty 3' },
        { code: 'D', message: 'Uncertainty 4' },
      ],
      topUncertainties: [
        { code: 'A', message: 'Uncertainty 1' },
        { code: 'B', message: 'Uncertainty 2' },
        { code: 'C', message: 'Uncertainty 3' },
      ],
      robustnessStatus: 'computed',
    }

    render(<ConfidenceSection data={manyUncertaintiesData} />)

    // Should show "+1 more items" button
    expect(screen.getByText('+1 more items')).toBeInTheDocument()
  })

  it('expands to show more improvements', () => {
    const manyImprovementsData: ConfidenceSectionData = {
      ...mockData,
      improvements: [
        { action: 'A', reason: '', priority: 1, source: 'bias' },
        { action: 'B', reason: '', priority: 2, source: 'bias' },
        { action: 'C', reason: '', priority: 3, source: 'bias' },
      ],
      topImprovements: [
        { action: 'A', reason: '', priority: 1, source: 'bias' },
        { action: 'B', reason: '', priority: 2, source: 'bias' },
      ],
    }

    render(<ConfidenceSection data={manyImprovementsData} />)

    // Should show "+1 more items" button
    expect(screen.getByText('+1 more items')).toBeInTheDocument()
  })

  it('renders threshold message for sensitive assumptions', () => {
    const dataWithThreshold: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'Cost sensitivity',
          threshold: {
            variable: 'Project Cost',
            direction: 'positive',
            value: 150000,
            alternativeOption: 'Hire Contractors',
          },
        },
      ],
      topUncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'Cost sensitivity',
          threshold: {
            variable: 'Project Cost',
            direction: 'positive',
            value: 150000,
            alternativeOption: 'Hire Contractors',
          },
        },
      ],
      robustnessStatus: 'computed',
    }

    render(<ConfidenceSection data={dataWithThreshold} />)

    expect(screen.getByText(/Project Cost.*drops below.*150000/)).toBeInTheDocument()
    expect(screen.getByText(/Hire Contractors.*becomes the better choice/)).toBeInTheDocument()
  })

  it('renders effort estimate when available', () => {
    const dataWithEffort: ConfidenceSectionData = {
      ...mockData,
      improvements: [
        { action: 'Quick fix', reason: '', priority: 1, source: 'bias', effortMinutes: 15 },
      ],
      topImprovements: [
        { action: 'Quick fix', reason: '', priority: 1, source: 'bias', effortMinutes: 15 },
      ],
    }

    render(<ConfidenceSection data={dataWithEffort} />)

    expect(screen.getByText('~15 min')).toBeInTheDocument()
  })

  // =============================================================================
  // Bug 2: "Good foundation" logic with robustness/stability checks
  // =============================================================================

  describe('Bug 2: Good foundation with robustness checks', () => {
    it('shows "Good foundation" when high robustness and high stability', () => {
      const highConfidenceData: ConfidenceSectionData = {
        tier: {
          tier: 'strong',
          icon: '✓',
          label: 'Good foundation',
          description: 'Your model captures this decision well.',
        },
        qualityScore: 90,
        uncertainties: [],
        topUncertainties: [],
        improvements: [],
        topImprovements: [],
        rankingStability: 0.85,
        robustnessLevel: 'high',
        robustnessStatus: 'computed',
      }

      render(<ConfidenceSection data={highConfidenceData} />)

      expect(screen.getByText(/Good foundation/)).toBeInTheDocument()
      expect(screen.getByText(/Your model looks good/)).toBeInTheDocument()
    })

    it('shows low confidence warning when low robustness with empty fragile edges', () => {
      const lowRobustnessData: ConfidenceSectionData = {
        tier: {
          tier: 'strong',
          icon: '✓',
          label: 'Good foundation',
          description: 'Your model captures this decision well.',
        },
        qualityScore: 75,
        uncertainties: [],
        topUncertainties: [],
        improvements: [],
        topImprovements: [],
        rankingStability: 0.387, // Below 0.6 threshold
        robustnessLevel: 'very_low',
        robustnessStatus: 'computed',
      }

      render(<ConfidenceSection data={lowRobustnessData} />)

      expect(screen.getByText(/Low confidence/)).toBeInTheDocument()
      expect(screen.getByText(/No fragile edges, but overall confidence is low/)).toBeInTheDocument()
    })

    it('shows low confidence warning when stability below threshold', () => {
      const lowStabilityData: ConfidenceSectionData = {
        tier: {
          tier: 'strong',
          icon: '✓',
          label: 'Good foundation',
          description: 'Your model captures this decision well.',
        },
        qualityScore: 75,
        uncertainties: [],
        topUncertainties: [],
        improvements: [],
        topImprovements: [],
        rankingStability: 0.45, // Below 0.6 threshold
        robustnessLevel: 'low',
        robustnessStatus: 'computed',
      }

      render(<ConfidenceSection data={lowStabilityData} />)

      expect(screen.getByText(/Low confidence/)).toBeInTheDocument()
    })
  })

  // =============================================================================
  // Bug 4: UNCERTAINTIES empty state logic
  // =============================================================================

  describe('Bug 4: Uncertainties empty state', () => {
    it('shows pre-run message when robustness not computed', () => {
      const preRunData: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        robustnessStatus: 'pending',
      }

      render(<ConfidenceSection data={preRunData} />)

      expect(screen.getByText(/Analysis will identify sensitive assumptions/)).toBeInTheDocument()
    })

    it('shows post-run message when robustness computed with no uncertainties', () => {
      const postRunData: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        robustnessStatus: 'computed',
      }

      render(<ConfidenceSection data={postRunData} />)

      expect(screen.getByText(/No sensitive assumptions identified/)).toBeInTheDocument()
    })

    it('shows filtered message when edges below threshold', () => {
      const filteredData: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        robustnessStatus: 'computed',
        filteredFragileEdges: {
          filteredCount: 3,
          threshold: 0.3,
          description: '3 additional assumptions changed the best option in <30% of scenarios tested',
        },
      }

      render(<ConfidenceSection data={filteredData} />)

      expect(screen.getByText(/No high-sensitivity assumptions found/)).toBeInTheDocument()
    })
  })
})
