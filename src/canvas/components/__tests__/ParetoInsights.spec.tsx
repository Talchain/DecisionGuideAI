/**
 * ParetoInsights Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock RiskTolerancePanel hook
const mockRiskProfile = vi.fn()
vi.mock('../RiskTolerancePanel', () => ({
  useStoredRiskProfile: () => mockRiskProfile(),
}))

// Import after mocks
import { ParetoInsights } from '../ParetoInsights'

const mockOptions = [
  { id: 'opt1', label: 'Option A', scores: { cost: 0.8, quality: 0.6, speed: 0.7 } },
  { id: 'opt2', label: 'Option B', scores: { cost: 0.5, quality: 0.9, speed: 0.6 } },
  { id: 'opt3', label: 'Option C', scores: { cost: 0.4, quality: 0.5, speed: 0.4 } },
]

const mockCriteria = ['cost', 'quality', 'speed']

describe('ParetoInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRiskProfile.mockReturnValue({ profile: 'neutral', score: 0.5 })
  })

  describe('empty state', () => {
    it('returns null when no frontier options', () => {
      const { container } = render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={[]}
          dominated={['opt3']}
          dominancePairs={[]}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('with frontier', () => {
    it('renders collapsed by default', () => {
      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[{ dominator: 'opt1', dominated: 'opt3' }]}
        />
      )

      expect(screen.getByTestId('pareto-insights')).toBeInTheDocument()
      expect(screen.getByText('Pareto Insights')).toBeInTheDocument()
      expect(screen.getByText('2 optimal')).toBeInTheDocument()
    })

    it('expands when header clicked', () => {
      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[{ dominator: 'opt1', dominated: 'opt3' }]}
        />
      )

      const header = screen.getByRole('button', { expanded: false })
      fireEvent.click(header)

      // Should show insights content
      expect(screen.getByText('Balanced choice')).toBeInTheDocument()
    })

    it('starts expanded when defaultExpanded is true', () => {
      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[{ dominator: 'opt1', dominated: 'opt3' }]}
          defaultExpanded={true}
        />
      )

      expect(screen.getByText('Balanced choice')).toBeInTheDocument()
    })
  })

  describe('risk-adjusted recommendation', () => {
    it('shows conservative label for risk_averse profile', () => {
      mockRiskProfile.mockReturnValue({ profile: 'risk_averse', score: 0.2 })

      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[]}
          defaultExpanded={true}
        />
      )

      expect(screen.getByText('Conservative choice')).toBeInTheDocument()
    })

    it('shows aggressive label for risk_seeking profile', () => {
      mockRiskProfile.mockReturnValue({ profile: 'risk_seeking', score: 0.8 })

      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[]}
          defaultExpanded={true}
        />
      )

      expect(screen.getByText('Aggressive choice')).toBeInTheDocument()
    })
  })

  describe('trade-off explanation', () => {
    it('shows trade-off between frontier options', () => {
      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[]}
          defaultExpanded={true}
        />
      )

      expect(screen.getByText('Key trade-off')).toBeInTheDocument()
      // Options may appear in multiple places
      expect(screen.getAllByText('Option A').length).toBeGreaterThan(0)
      expect(screen.getByText('vs')).toBeInTheDocument()
      expect(screen.getAllByText('Option B').length).toBeGreaterThan(0)
    })
  })

  describe('domination explanation', () => {
    it('shows why option is dominated', () => {
      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[{ dominator: 'opt1', dominated: 'opt3' }]}
          defaultExpanded={true}
        />
      )

      expect(screen.getByText(/Option C.*is dominated/)).toBeInTheDocument()
    })
  })

  describe('option click', () => {
    it('calls onOptionClick when recommendation clicked', () => {
      const onOptionClick = vi.fn()

      render(
        <ParetoInsights
          options={mockOptions}
          criteria={mockCriteria}
          frontier={['opt1', 'opt2']}
          dominated={['opt3']}
          dominancePairs={[]}
          defaultExpanded={true}
          onOptionClick={onOptionClick}
        />
      )

      // Click on one of the option buttons (use getAllByRole to handle multiples)
      const optionButtons = screen.getAllByRole('button', { name: /Option [AB]/ })
      expect(optionButtons.length).toBeGreaterThan(0)
      fireEvent.click(optionButtons[0])

      expect(onOptionClick).toHaveBeenCalled()
    })
  })
})
