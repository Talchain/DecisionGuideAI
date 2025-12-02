/**
 * ProvenancePanel Tests
 *
 * Tests for provenance panel display and interaction:
 * - Coverage percentage calculation
 * - Sources list display
 * - Warning state for zero sources
 * - Expand/collapse functionality
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProvenancePanel } from '../ProvenancePanel'

describe('ProvenancePanel', () => {
  describe('Visibility', () => {
    it('hides when no provenance data provided', () => {
      const { container } = render(<ProvenancePanel />)
      expect(container.firstChild).toBeNull()
    })

    it('hides when provenance is undefined', () => {
      const { container } = render(<ProvenancePanel provenance={undefined} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Coverage Display', () => {
    it('shows correct coverage fraction', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      expect(screen.getByText('8/10 edges')).toBeInTheDocument()
    })

    it('calculates correct coverage percentage', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))
      expect(screen.getByText('80%')).toBeInTheDocument()
    })

    it('handles 100% coverage', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 10,
            edges_total: 10,
          }}
        />
      )

      expect(screen.getByText('10/10 edges')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Evidence Coverage'))
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('handles 0% coverage', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: [],
            source_count: 0,
            edges_with_provenance: 0,
            edges_total: 10,
          }}
        />
      )

      expect(screen.getByText('0/10 edges')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Evidence Coverage'))
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles edge case of zero total edges', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: [],
            source_count: 0,
            edges_with_provenance: 0,
            edges_total: 0,
          }}
        />
      )

      expect(screen.getByText('0/0 edges')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Evidence Coverage'))
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('Color Coding', () => {
    it('shows green for high coverage (>=50%)', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      const edgesText = screen.getByText('8/10 edges')
      expect(edgesText).toHaveClass('text-green-600')
    })

    it('shows amber for low coverage (<50%)', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 3,
            edges_total: 10,
          }}
        />
      )

      const edgesText = screen.getByText('3/10 edges')
      expect(edgesText).toHaveClass('text-amber-600')
    })

    it('shows amber at exactly 49% coverage', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 49,
            edges_total: 100,
          }}
        />
      )

      const edgesText = screen.getByText('49/100 edges')
      expect(edgesText).toHaveClass('text-amber-600')
    })

    it('shows green at exactly 50% coverage', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 50,
            edges_total: 100,
          }}
        />
      )

      const edgesText = screen.getByText('50/100 edges')
      expect(edgesText).toHaveClass('text-green-600')
    })
  })

  describe('Sources List', () => {
    it('displays all sources when 5 or fewer', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source A', 'Source B', 'Source C'],
            source_count: 3,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(screen.getByText('Source A')).toBeInTheDocument()
      expect(screen.getByText('Source B')).toBeInTheDocument()
      expect(screen.getByText('Source C')).toBeInTheDocument()
    })

    it('limits display to first 5 sources', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: [
              'Source 1',
              'Source 2',
              'Source 3',
              'Source 4',
              'Source 5',
              'Source 6',
              'Source 7',
            ],
            source_count: 7,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(screen.getByText('Source 1')).toBeInTheDocument()
      expect(screen.getByText('Source 5')).toBeInTheDocument()
      expect(screen.queryByText('Source 6')).not.toBeInTheDocument()
      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })

    it('shows warning when no sources', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: [],
            source_count: 0,
            edges_with_provenance: 0,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(screen.getByText('No external evidence')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Model based on assumptions only. Consider gathering supporting data.'
        )
      ).toBeInTheDocument()
    })

    it('does not show sources list when count is zero', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: [],
            source_count: 0,
            edges_with_provenance: 0,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(screen.queryByText('Sources:')).not.toBeInTheDocument()
      expect(screen.getByText('No external evidence')).toBeInTheDocument()
    })
  })

  describe('Expand/Collapse', () => {
    it('starts collapsed', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      expect(screen.queryByText('Coverage')).not.toBeInTheDocument()
      expect(screen.queryByText('Sources:')).not.toBeInTheDocument()
    })

    it('expands on click', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(screen.getByText('Coverage')).toBeInTheDocument()
      expect(screen.getByText('80%')).toBeInTheDocument()
    })

    it('collapses on second click', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      const button = screen.getByText('Evidence Coverage')

      fireEvent.click(button)
      expect(screen.getByText('Coverage')).toBeInTheDocument()

      fireEvent.click(button)
      expect(screen.queryByText('Coverage')).not.toBeInTheDocument()
    })

    it('shows correct arrow indicator', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      expect(screen.getByText('▶')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(screen.getByText('▼')).toBeInTheDocument()
      expect(screen.queryByText('▶')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-expanded attribute', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      const button = screen.getByRole('button', { name: 'Evidence coverage details' })
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('marks detail region with proper role', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      expect(
        screen.getByRole('region', { name: 'Evidence coverage details' })
      ).toBeInTheDocument()
    })

    it('has progressbar role and aria attributes', () => {
      render(
        <ProvenancePanel
          provenance={{
            sources: ['Source 1'],
            source_count: 1,
            edges_with_provenance: 8,
            edges_total: 10,
          }}
        />
      )

      fireEvent.click(screen.getByText('Evidence Coverage'))

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '80')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    })
  })
})
