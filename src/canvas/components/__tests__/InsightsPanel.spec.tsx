import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InsightsPanel, InsightsSummaryCompact } from '../InsightsPanel'
import type { Insights } from '../../../types/plot'

const mockFullInsights: Insights = {
  summary:
    'Outcome likely to increase by 15% (range: 8% to 22%) with medium confidence.',
  risks: [
    'Price sensitivity estimate based on assumptions',
    'Only 43% of relationships have supporting evidence',
    'Competition response not modelled',
  ],
  next_steps: [
    'Add evidence to strengthen key assumptions',
    'Validate the Price to Demand relationship',
  ],
}

const mockMinimalInsights: Insights = {
  summary: 'Analysis complete. No significant concerns.',
  risks: [],
  next_steps: [],
}

const mockRisksOnlyInsights: Insights = {
  summary: 'Several risks identified that need attention.',
  risks: ['Risk one', 'Risk two'],
  next_steps: [],
}

describe('InsightsPanel', () => {
  describe('Summary display', () => {
    it('renders the summary text', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      const summary = screen.getByTestId('insights-summary')
      expect(summary).toHaveTextContent(
        'Outcome likely to increase by 15% (range: 8% to 22%) with medium confidence.'
      )
    })

    it('displays Key Insight label', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      expect(screen.getByText('Key Insight')).toBeInTheDocument()
    })
  })

  describe('Expandable details', () => {
    it('shows risks and next steps when expanded by default', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      const details = screen.getByTestId('insights-details')
      expect(details).toBeInTheDocument()

      // Check risks
      const risksList = screen.getByTestId('risks-list')
      expect(risksList).toBeInTheDocument()
      expect(
        screen.getByText('Price sensitivity estimate based on assumptions')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Only 43% of relationships have supporting evidence')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Competition response not modelled')
      ).toBeInTheDocument()

      // Check next steps
      const nextStepsList = screen.getByTestId('next-steps-list')
      expect(nextStepsList).toBeInTheDocument()
      expect(
        screen.getByText('Add evidence to strengthen key assumptions')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Validate the Price to Demand relationship')
      ).toBeInTheDocument()
    })

    it('can start collapsed', () => {
      render(<InsightsPanel insights={mockFullInsights} defaultExpanded={false} />)

      expect(screen.queryByTestId('insights-details')).not.toBeInTheDocument()
    })

    it('toggles expansion on click', () => {
      render(<InsightsPanel insights={mockFullInsights} defaultExpanded={false} />)

      // Initially collapsed
      expect(screen.queryByTestId('insights-details')).not.toBeInTheDocument()

      // Click to expand
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Now visible
      expect(screen.getByTestId('insights-details')).toBeInTheDocument()

      // Click again to collapse
      fireEvent.click(button)
      expect(screen.queryByTestId('insights-details')).not.toBeInTheDocument()
    })

    it('disables toggle when no details', () => {
      render(<InsightsPanel insights={mockMinimalInsights} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Risks section', () => {
    it('shows risks section with correct styling', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      expect(screen.getByText('Risks to Consider')).toBeInTheDocument()
      expect(screen.getByText('Risks to Consider')).toHaveClass('text-amber-700')
    })

    it('does not show risks section when empty', () => {
      render(<InsightsPanel insights={mockMinimalInsights} />)

      expect(screen.queryByText('Risks to Consider')).not.toBeInTheDocument()
    })

    it('shows only risks when no next steps', () => {
      render(<InsightsPanel insights={mockRisksOnlyInsights} />)

      expect(screen.getByText('Risks to Consider')).toBeInTheDocument()
      expect(
        screen.queryByText('Recommended Next Steps')
      ).not.toBeInTheDocument()
    })
  })

  describe('Next Steps section', () => {
    it('shows next steps section with correct styling', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      expect(screen.getByText('Recommended Next Steps')).toBeInTheDocument()
      expect(screen.getByText('Recommended Next Steps')).toHaveClass(
        'text-green-700'
      )
    })

    it('does not show next steps section when empty', () => {
      render(<InsightsPanel insights={mockRisksOnlyInsights} />)

      expect(
        screen.queryByText('Recommended Next Steps')
      ).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has aria-expanded on toggle button', () => {
      render(<InsightsPanel insights={mockFullInsights} defaultExpanded={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('has aria-labels on lists', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      expect(
        screen.getByRole('list', { name: 'Risks to consider' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('list', { name: 'Recommended next steps' })
      ).toBeInTheDocument()
    })
  })

  it('accepts custom className', () => {
    render(
      <InsightsPanel insights={mockFullInsights} className="custom-class" />
    )

    const panel = screen.getByTestId('insights-panel')
    expect(panel).toHaveClass('custom-class')
  })

  it('renders with sky blue styling', () => {
    render(<InsightsPanel insights={mockFullInsights} />)

    const panel = screen.getByTestId('insights-panel')
    expect(panel).toHaveClass('border-sky-200', 'bg-sky-50/50')
  })
})

describe('InsightsSummaryCompact', () => {
  it('renders summary in compact form', () => {
    render(<InsightsSummaryCompact insights={mockFullInsights} />)

    const compact = screen.getByTestId('insights-compact')
    expect(compact).toBeInTheDocument()
    expect(compact).toHaveClass('bg-sky-50', 'border-sky-200')
    expect(
      screen.getByText(
        'Outcome likely to increase by 15% (range: 8% to 22%) with medium confidence.'
      )
    ).toBeInTheDocument()
  })

  it('shows count of additional details', () => {
    render(<InsightsSummaryCompact insights={mockFullInsights} />)

    // 3 risks + 2 next steps = 5
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('does not show count when no details', () => {
    render(<InsightsSummaryCompact insights={mockMinimalInsights} />)

    expect(screen.queryByText('+')).not.toBeInTheDocument()
  })

  it('has correct accessibility attributes', () => {
    render(<InsightsSummaryCompact insights={mockFullInsights} />)

    const compact = screen.getByTestId('insights-compact')
    expect(compact).toHaveAttribute('role', 'region')
    expect(compact).toHaveAttribute('aria-label', 'Key insight summary')
  })

  it('accepts custom className', () => {
    render(
      <InsightsSummaryCompact
        insights={mockFullInsights}
        className="custom-class"
      />
    )

    const compact = screen.getByTestId('insights-compact')
    expect(compact).toHaveClass('custom-class')
  })
})
