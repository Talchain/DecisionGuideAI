import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ParetoChart } from '../ParetoChart'
import * as useParetoModule from '../../../hooks/usePareto'

// Mock usePareto hook
vi.mock('../../../hooks/usePareto', () => ({
  usePareto: vi.fn(),
}))

describe('ParetoChart', () => {
  const mockOptions = [
    { id: 'opt1', label: 'Option A', scores: { cost: 0.3, quality: 0.8, speed: 0.6 } },
    { id: 'opt2', label: 'Option B', scores: { cost: 0.5, quality: 0.9, speed: 0.7 } },
    { id: 'opt3', label: 'Option C', scores: { cost: 0.7, quality: 0.6, speed: 0.9 } },
  ]

  const mockCriteria = ['cost', 'quality']

  const defaultMockReturn = {
    frontier: ['opt1', 'opt2'],
    dominated: ['opt3'],
    dominancePairs: [{ dominator: 'opt1', dominated: 'opt3' }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useParetoModule.usePareto).mockReturnValue(defaultMockReturn)
  })

  describe('rendering states', () => {
    it('renders loading state', () => {
      vi.mocked(useParetoModule.usePareto).mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        frontier: [],
        dominated: [],
      })

      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      expect(screen.getByTestId('pareto-chart-loading')).toBeInTheDocument()
    })

    it('renders error state with retry button', () => {
      const mockRefetch = vi.fn()
      vi.mocked(useParetoModule.usePareto).mockReturnValue({
        ...defaultMockReturn,
        error: new Error('Server unavailable'),
        frontier: [],
        dominated: [],
        refetch: mockRefetch,
      })

      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      expect(screen.getByTestId('pareto-chart-error')).toBeInTheDocument()
      expect(screen.getByText('Pareto analysis unavailable')).toBeInTheDocument()
      expect(screen.getByText('Server unavailable')).toBeInTheDocument()

      // Click retry
      fireEvent.click(screen.getByText('Retry'))
      expect(mockRefetch).toHaveBeenCalled()
    })

    it('renders empty state when not enough options', () => {
      render(
        <ParetoChart
          options={mockOptions.slice(0, 2)}
          criteria={mockCriteria}
        />
      )

      expect(screen.getByTestId('pareto-chart-empty')).toBeInTheDocument()
      expect(
        screen.getByText('Add more options to see Pareto frontier')
      ).toBeInTheDocument()
    })

    it('renders empty state when not enough criteria', () => {
      render(<ParetoChart options={mockOptions} criteria={['cost']} />)

      expect(screen.getByTestId('pareto-chart-empty')).toBeInTheDocument()
      expect(
        screen.getByText('Need at least 2 criteria for Pareto analysis')
      ).toBeInTheDocument()
    })

    it('renders chart with data', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      expect(screen.getByTestId('pareto-chart')).toBeInTheDocument()
      expect(screen.getByText('Pareto Frontier Analysis')).toBeInTheDocument()
    })
  })

  describe('desktop view', () => {
    it('renders SVG chart', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      const desktopView = screen.getByTestId('pareto-desktop-view')
      expect(desktopView).toBeInTheDocument()

      // Should have SVG
      const svg = desktopView.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('aria-label', 'Pareto frontier chart')
    })

    it('shows legend with correct counts', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      expect(screen.getByText(/Pareto optimal \(2\)/)).toBeInTheDocument()
      expect(screen.getByText(/Dominated \(1\)/)).toBeInTheDocument()
    })

    it('shows axis selectors when >2 criteria', () => {
      render(
        <ParetoChart options={mockOptions} criteria={['cost', 'quality', 'speed']} />
      )

      expect(screen.getByText('X-Axis:')).toBeInTheDocument()
      expect(screen.getByText('Y-Axis:')).toBeInTheDocument()
    })

    it('does not show axis selectors when exactly 2 criteria', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      expect(screen.queryByText('X-Axis:')).not.toBeInTheDocument()
    })
  })

  describe('mobile view', () => {
    it('renders mobile list view', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      const mobileView = screen.getByTestId('pareto-mobile-view')
      expect(mobileView).toBeInTheDocument()
    })

    it('shows frontier badge for optimal options', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      const mobileView = screen.getByTestId('pareto-mobile-view')
      const frontierBadges = mobileView.querySelectorAll('span')
      const frontierTexts = Array.from(frontierBadges).filter(
        (el) => el.textContent === 'Frontier'
      )
      expect(frontierTexts.length).toBe(2) // opt1 and opt2
    })

    it('shows dominated badge for dominated options', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      const mobileView = screen.getByTestId('pareto-mobile-view')
      const dominatedBadges = Array.from(mobileView.querySelectorAll('span')).filter(
        (el) => el.textContent === 'Dominated'
      )
      expect(dominatedBadges.length).toBe(1) // opt3
    })

    it('expands dominated option to show "Why dominated?"', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      // Find and click on dominated option
      const dominatedButton = screen.getByText('Option C').closest('button')
      expect(dominatedButton).toBeInTheDocument()

      fireEvent.click(dominatedButton!)

      // Should show "Why dominated?" explanation
      expect(screen.getByText('Why dominated?')).toBeInTheDocument()
      expect(screen.getByText(/Outperformed by:/)).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onOptionClick when option is clicked', () => {
      const onOptionClick = vi.fn()
      render(
        <ParetoChart
          options={mockOptions}
          criteria={mockCriteria}
          onOptionClick={onOptionClick}
        />
      )

      // Click on mobile frontier option - use within() to scope to mobile view
      const mobileView = screen.getByTestId('pareto-mobile-view')
      const optionButton = within(mobileView).getByText('Option A').closest('button')
      fireEvent.click(optionButton!)

      expect(onOptionClick).toHaveBeenCalledWith('opt1')
    })
  })

  describe('accessibility', () => {
    it('has accessible SVG chart', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      const svg = screen.getByRole('img', { name: 'Pareto frontier chart' })
      expect(svg).toBeInTheDocument()
    })

    it('error state has alert role', () => {
      vi.mocked(useParetoModule.usePareto).mockReturnValue({
        ...defaultMockReturn,
        error: new Error('Test error'),
        frontier: [],
        dominated: [],
      })

      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('score formatting', () => {
    it('formats percentage scores correctly in mobile view', () => {
      render(<ParetoChart options={mockOptions} criteria={mockCriteria} />)

      // Expand an option to see scores
      const optionButton = screen.getByText('Option C').closest('button')
      fireEvent.click(optionButton!)

      // Should format 0.7 as 70% and 0.6 as 60%
      expect(screen.getByText(/cost: 70%/)).toBeInTheDocument()
      expect(screen.getByText(/quality: 60%/)).toBeInTheDocument()
    })
  })
})
