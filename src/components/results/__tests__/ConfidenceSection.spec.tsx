/**
 * ConfidenceSection Tests
 *
 * Tests for the "What to do next" panel — grouped action items layout.
 * V9.2 Phase 4: Replaces two-tier uncertainty display with grouped layout.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfidenceSection } from '../ConfidenceSection'
import type { ConfidenceSectionData } from '../types'

// Mock focusNodeById
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
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
        displayText: 'Some assumptions may significantly affect results',
        suggestion: 'Consider validating with additional data',
      },
    ],
    topUncertainties: [
      {
        code: 'SENSITIVE_ASSUMPTION',
        message: 'Some assumptions may significantly affect results',
        displayText: 'Some assumptions may significantly affect results',
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

  it('renders the component with grouped layout', () => {
    render(<ConfidenceSection data={mockData} />)

    // V9.2: Group 1 header "Validate before committing" shown for fragile edges
    expect(screen.getByText('Validate before committing')).toBeInTheDocument()
    // Uncertainty message should be rendered via UncertaintyRow
    expect(screen.getByText('Some assumptions may significantly affect results')).toBeInTheDocument()
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

    // V9.2: Tier info now in Accordion header, not inline. But fair tier shows
    // grouped content. Check that the Group 1 heading renders.
    expect(screen.getByText('Validate before committing')).toBeInTheDocument()
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

    // Has fragile edges, so Group 1 renders
    expect(screen.getByText('Validate before committing')).toBeInTheDocument()
  })

  it('renders fragile edge uncertainties in Group 1', () => {
    render(<ConfidenceSection data={mockData} />)

    // V9.2: Fragile edges render in Group 1 via UncertaintyRow
    expect(screen.getByText('Validate before committing')).toBeInTheDocument()
    expect(screen.getByText('Some assumptions may significantly affect results')).toBeInTheDocument()
  })

  it('renders suggestion for uncertainties', () => {
    render(<ConfidenceSection data={mockData} />)

    expect(screen.getByText(/Consider validating/)).toBeInTheDocument()
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

    expect(screen.getByText(/Good foundation, a few items to consider below/)).toBeInTheDocument()
  })

  it('shows "items to consider" when strong tier has improvements', () => {
    const strongWithImprovementsData: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [],
      topUncertainties: [],
    }

    render(<ConfidenceSection data={strongWithImprovementsData} />)

    expect(screen.getByText(/Good foundation, a few items to consider below/)).toBeInTheDocument()
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

  it('shows "Show more" when more than 3 fragile edges', () => {
    const manyFragileEdges: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 1', displayText: 'Edge 1' },
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 2', displayText: 'Edge 2' },
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 3', displayText: 'Edge 3' },
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 4', displayText: 'Edge 4' },
      ],
      topUncertainties: [
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 1', displayText: 'Edge 1' },
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 2', displayText: 'Edge 2' },
        { code: 'SENSITIVE_ASSUMPTION', message: 'Edge 3', displayText: 'Edge 3' },
      ],
      robustnessStatus: 'computed',
    }

    render(<ConfidenceSection data={manyFragileEdges} />)

    // V9.2: Show more button for Group 1 fragile edges (capped at 3)
    expect(screen.getByText('Show 1 more')).toBeInTheDocument()
  })

  it('renders threshold message for sensitive assumptions', () => {
    const dataWithThreshold: ConfidenceSectionData = {
      ...mockData,
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'Cost sensitivity',
          displayText: 'Cost sensitivity',
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
          displayText: 'Cost sensitivity',
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
          description: '3 additional assumptions changed the best option in <30% of simulations',
        },
      }

      render(<ConfidenceSection data={filteredData} />)

      expect(screen.getByText(/No high-sensitivity assumptions found/)).toBeInTheDocument()
    })
  })

  // =============================================================================
  // V9.2: Evidence Gaps in grouped layout
  // =============================================================================

  describe('V9.2: Evidence Gaps in grouped layout', () => {
    it('renders evidence gap in Group 2 with confidence pill', () => {
      const dataWithEvidenceGaps: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        evidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'Market Size',
            suggestion: 'Research market trends',
            voi: 0.75,
            confidence: 30, // low confidence
          },
        ],
        topEvidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'Market Size',
            suggestion: 'Research market trends',
            voi: 0.75,
            confidence: 30,
          },
        ],
      }

      render(<ConfidenceSection data={dataWithEvidenceGaps} />)

      expect(screen.getByText('Market Size')).toBeInTheDocument()
      // V9.2: Group 2 header
      expect(screen.getByText('Investigate')).toBeInTheDocument()
      // V9.2: Confidence pill instead of VOI label
      expect(screen.getByText('Low confidence')).toBeInTheDocument()
    })

    it('renders medium confidence pill for evidence gap', () => {
      const dataWithMediumConfidence: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        evidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'Competition',
            voi: 0.5,
            confidence: 55, // medium confidence (55/100 = 0.55)
          },
        ],
        topEvidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'Competition',
            voi: 0.5,
            confidence: 55,
          },
        ],
      }

      render(<ConfidenceSection data={dataWithMediumConfidence} />)

      expect(screen.getByText('Competition')).toBeInTheDocument()
      expect(screen.getByText('Medium confidence')).toBeInTheDocument()
    })

    it('renders factor label cleanly when VOI is undefined', () => {
      const dataWithUndefinedVOI: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        evidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'Unknown Factor',
            suggestion: 'Investigate this',
            voi: undefined as unknown as number,
          },
        ],
        topEvidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'Unknown Factor',
            suggestion: 'Investigate this',
            voi: undefined as unknown as number,
          },
        ],
      }

      render(<ConfidenceSection data={dataWithUndefinedVOI} />)

      expect(screen.getByText('Unknown Factor')).toBeInTheDocument()
    })

    it('renders factor label cleanly when VOI is NaN', () => {
      const dataWithNaNVOI: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [],
        topUncertainties: [],
        evidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'NaN Factor',
            voi: NaN,
          },
        ],
        topEvidenceGaps: [
          {
            factorId: 'factor-1',
            factorLabel: 'NaN Factor',
            voi: NaN,
          },
        ],
      }

      render(<ConfidenceSection data={dataWithNaNVOI} />)

      expect(screen.getByText('NaN Factor')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // V11.2 Fix 1+4: Humanised suggestion CTA for constraint items
  // =========================================================================

  describe('V11.2: Constraint item humanised CTA', () => {
    it('renders humanised suggestion as CTA text for clickable constraint items', () => {
      const constraintData: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [
          {
            code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
            message: 'observed_state.value is missing for constraint_fac_budget_max',
            affectedNodes: ['fac_budget'],
            severity: 'warning',
          },
        ],
        topUncertainties: [],
        humanisedCritiques: [
          {
            title: 'Budget has no estimate set',
            displayText: 'Budget has no estimate set',
            description: 'Results may be unreliable without a current value for this constraint.',
            suggestion: 'Set estimate \u2192',
            factorId: 'fac_budget',
          },
        ],
      }

      render(<ConfidenceSection data={constraintData} />)

      // Humanised title should render instead of raw message
      expect(screen.getByText('Budget has no estimate set')).toBeInTheDocument()
      // CTA should render inline
      expect(screen.getByText('Set estimate \u2192')).toBeInTheDocument()
      // Raw internal strings should NOT appear
      expect(screen.queryByText(/observed_state/)).not.toBeInTheDocument()
      expect(screen.queryByText(/constraint_fac_/)).not.toBeInTheDocument()
    })

    it('never exposes raw critique message for unknown codes', () => {
      const unknownCodeData: ConfidenceSectionData = {
        ...mockData,
        uncertainties: [
          {
            code: 'BRAND_NEW_CODE',
            message: 'constraint_fac_churn_max observed_state.value intercept=0',
            affectedNodes: ['fac_churn'],
            severity: 'warning',
          },
        ],
        topUncertainties: [],
        humanisedCritiques: [
          {
            title: "Review this factor's inputs",
            displayText: "Review this factor's inputs",
            description: "Some information needed to assess this factor isn't available yet.",
            suggestion: 'Check and update this factor',
            factorId: 'fac_churn',
          },
        ],
      }

      render(<ConfidenceSection data={unknownCodeData} />)

      // Raw internal strings should never appear
      expect(screen.queryByText(/constraint_fac_/)).not.toBeInTheDocument()
      expect(screen.queryByText(/observed_state/)).not.toBeInTheDocument()
      expect(screen.queryByText(/intercept=0/)).not.toBeInTheDocument()
    })
  })

  // V12: Next actions ungated
  // V12.1 Fix 3: Next actions merged into Validate group (no separate section)
  describe('V12.1: Next actions merged into Validate', () => {
    it('renders next actions within Validate group (no Recommended actions heading)', () => {
      const dataWithActions: ConfidenceSectionData = {
        ...mockData,
        nextActions: [
          { action: 'Validate pricing model', rationale: 'High uncertainty', priority: 1, targetId: 'fac-price' },
          { action: 'Check market size data', rationale: 'Low confidence', priority: 2, targetId: 'fac-market' },
        ],
      }

      render(<ConfidenceSection data={dataWithActions} />)

      // V12.1 Fix 3: No separate "Recommended actions" heading
      expect(screen.queryByText('Recommended actions')).not.toBeInTheDocument()
      // Items appear under "Validate before committing"
      expect(screen.getByText('Validate before committing')).toBeInTheDocument()
      expect(screen.getByText('Validate pricing model')).toBeInTheDocument()
      expect(screen.getByText('Check market size data')).toBeInTheDocument()
    })

    it('renders pre-sanitized action text (sanitization happens at data layer)', () => {
      // Data layer sanitizes arrows before passing to ConfidenceSection
      const dataWithCleanActions: ConfidenceSectionData = {
        ...mockData,
        nextActions: [
          { action: 'Price to Revenue relationship', rationale: '', priority: 1, targetId: 'fac-price' },
        ],
      }

      render(<ConfidenceSection data={dataWithCleanActions} />)

      expect(screen.getByText('Price to Revenue relationship')).toBeInTheDocument()
    })

    it('excludes actions targeting the hinge factor', () => {
      const dataWithActions: ConfidenceSectionData = {
        ...mockData,
        nextActions: [
          { action: 'Validate pricing model', rationale: '', priority: 1, targetId: 'fac-price' },
          { action: 'Check market size', rationale: '', priority: 2, targetId: 'fac-market' },
        ],
      }

      render(
        <ConfidenceSection
          data={dataWithActions}
          hinge={{ label: 'Price', nodeId: 'fac-price', kind: 'node', reason: 'voi', edgeDetail: null, alternativeWinnerLabel: null }}
        />
      )

      // fac-price should be excluded (matches hinge nodeId)
      expect(screen.queryByText('Validate pricing model')).not.toBeInTheDocument()
      // fac-market should still render in Validate group
      expect(screen.getByText('Check market size')).toBeInTheDocument()
    })

    it('does not render Recommended actions section when no next actions', () => {
      render(<ConfidenceSection data={mockData} />)
      expect(screen.queryByText('Recommended actions')).not.toBeInTheDocument()
    })
  })
})
