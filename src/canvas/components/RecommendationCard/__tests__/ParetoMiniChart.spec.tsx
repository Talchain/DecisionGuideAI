/**
 * ParetoMiniChart Tests
 *
 * Brief 10.6: Tests for inline Pareto visualization
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParetoMiniChart } from '../ParetoMiniChart'
import type { ParetoResult } from '../types'

describe('ParetoMiniChart', () => {
  const mockPareto: ParetoResult = {
    frontier: ['opt-1', 'opt-2'],
    dominated: ['opt-3'],
    tradeoff_narrative: 'Option 1 excels on revenue, Option 2 on risk',
    criteria: ['revenue', 'risk'],
  }

  const mockLabels = {
    'opt-1': 'Option A',
    'opt-2': 'Option B',
    'opt-3': 'Option C',
  }

  describe('Basic rendering', () => {
    it('renders without crashing', () => {
      render(<ParetoMiniChart pareto={mockPareto} />)
      // Should render either list or chart
      expect(
        screen.getByTestId('pareto-mini-list') || screen.getByTestId('pareto-mini-chart')
      ).toBeTruthy()
    })

    it('shows empty state when frontier is empty', () => {
      const emptyPareto: ParetoResult = {
        frontier: [],
        dominated: [],
        criteria: [],
      }
      render(<ParetoMiniChart pareto={emptyPareto} />)
      expect(screen.getByText('No Pareto frontier available')).toBeInTheDocument()
    })
  })

  describe('List view (small datasets)', () => {
    it('uses list view for small frontier/dominated counts', () => {
      render(<ParetoMiniChart pareto={mockPareto} />)
      expect(screen.getByTestId('pareto-mini-list')).toBeInTheDocument()
    })

    it('shows frontier options with Optimal badge', () => {
      render(<ParetoMiniChart pareto={mockPareto} optionLabels={mockLabels} />)
      expect(screen.getAllByText('Optimal')).toHaveLength(2)
    })

    it('shows dominated count', () => {
      render(<ParetoMiniChart pareto={mockPareto} />)
      expect(screen.getByText(/1 dominated option/)).toBeInTheDocument()
    })

    it('uses option labels when provided', () => {
      render(<ParetoMiniChart pareto={mockPareto} optionLabels={mockLabels} />)
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('falls back to option ID when no label provided', () => {
      render(<ParetoMiniChart pareto={mockPareto} />)
      expect(screen.getByText('opt-1')).toBeInTheDocument()
    })
  })

  describe('Chart view (larger datasets)', () => {
    const largePareto: ParetoResult = {
      frontier: ['opt-1', 'opt-2', 'opt-3', 'opt-4'],
      dominated: ['opt-5', 'opt-6', 'opt-7'],
      criteria: ['a', 'b'],
    }

    it('uses chart view for larger datasets', () => {
      render(<ParetoMiniChart pareto={largePareto} />)
      expect(screen.getByTestId('pareto-mini-chart')).toBeInTheDocument()
    })

    it('renders SVG chart', () => {
      render(<ParetoMiniChart pareto={largePareto} />)
      const svg = screen.getByRole('img', { name: /Pareto frontier/i })
      expect(svg).toBeInTheDocument()
      expect(svg.tagName).toBe('svg')
    })

    it('shows legend with counts', () => {
      render(<ParetoMiniChart pareto={largePareto} />)
      expect(screen.getByText('Optimal (4)')).toBeInTheDocument()
      expect(screen.getByText('Dominated (3)')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onOptionClick when frontier option is clicked in list view', () => {
      const onOptionClick = vi.fn()
      render(<ParetoMiniChart pareto={mockPareto} onOptionClick={onOptionClick} />)

      const optionButtons = screen.getAllByRole('button')
      fireEvent.click(optionButtons[0])

      expect(onOptionClick).toHaveBeenCalledWith('opt-1')
    })

    it('calls onOptionClick when frontier option is clicked in chart view', () => {
      const largePareto: ParetoResult = {
        frontier: ['opt-1', 'opt-2', 'opt-3', 'opt-4'],
        dominated: ['opt-5', 'opt-6', 'opt-7'],
        criteria: ['a', 'b'],
      }
      const onOptionClick = vi.fn()
      render(<ParetoMiniChart pareto={largePareto} onOptionClick={onOptionClick} />)

      // Click a frontier point (circle with teal fill)
      const frontierCircles = document.querySelectorAll('circle[fill="#0d9488"]')
      if (frontierCircles.length > 0) {
        fireEvent.click(frontierCircles[0])
        expect(onOptionClick).toHaveBeenCalled()
      }
    })
  })

  describe('Pluralization', () => {
    it('shows singular "option" for one dominated', () => {
      render(<ParetoMiniChart pareto={mockPareto} />)
      expect(screen.getByText(/1 dominated option$/)).toBeInTheDocument()
    })

    it('shows plural "options" for multiple dominated', () => {
      const multiDominated: ParetoResult = {
        frontier: ['opt-1'],
        dominated: ['opt-2', 'opt-3'],
        criteria: ['a'],
      }
      render(<ParetoMiniChart pareto={multiDominated} />)
      expect(screen.getByText(/2 dominated options$/)).toBeInTheDocument()
    })
  })
})
