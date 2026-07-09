import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InsightsPanel, InsightsSummaryCompact } from '../InsightsPanel'
import { useCanvasStore } from '../../store'
import type { Insights } from '../../../types/plot'

// Phase 2.3 "strict-render" (0c95929f, P0-3): InsightsPanel now overrides
// ANY summary — engine-supplied, driver-generated, or caller-provided — with
// a non-success-implying fallback when useHasAnyRealProbability() is false.
// This file renders the component with no canvas-store wiring at all, so
// every test previously saw `hasAnyProbability === false` and, for any test
// actually asserting on the *content* of a provided summary, silently got
// the fallback text instead. Tests whose purpose is to verify a provided
// summary renders verbatim now stamp a real probability into the canvas
// store first (reset after each test so it doesn't leak into siblings);
// tests whose purpose is defensive null/undefined/empty-insights handling
// assert the (correct, honest) fallback text a probability-less run
// actually produces.
afterEach(() => {
  useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never)
})

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
      // Real probability so the strict-render guard doesn't override
      // mockFullInsights.summary with the no-probability fallback.
      useCanvasStore.setState({ results: { status: 'complete', report: { probability_of_goal: 0.62 } } } as never)
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
      expect(screen.getByText('Risks to Consider')).toHaveClass('text-warning')
    })

    it('does not show risks section when empty', () => {
      render(<InsightsPanel insights={mockMinimalInsights} />)

      expect(screen.queryByText('Risks to Consider')).not.toBeInTheDocument()
    })

    it('shows only risks when no next steps', () => {
      render(<InsightsPanel insights={mockRisksOnlyInsights} />)

      expect(screen.getByText('Risks to Consider')).toBeInTheDocument()
      expect(
        screen.queryByText('Suggested Next Steps')
      ).not.toBeInTheDocument()
    })
  })

  describe('Next Steps section', () => {
    it('shows next steps section with correct styling', () => {
      render(<InsightsPanel insights={mockFullInsights} />)

      expect(screen.getByText('Suggested Next Steps')).toBeInTheDocument()
      expect(screen.getByText('Suggested Next Steps')).toHaveClass(
        'text-success'
      )
    })

    it('does not show next steps section when empty', () => {
      render(<InsightsPanel insights={mockRisksOnlyInsights} />)

      expect(
        screen.queryByText('Suggested Next Steps')
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
        screen.getByRole('list', { name: 'Suggested next steps' })
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

// P0.3: Hardening tests for defensive data handling
describe('InsightsPanel hardening (P0.3)', () => {
  it('handles null insights gracefully', () => {
    // No canvas-store probability => the strict-render guard (Phase 2.3,
    // 0c95929f) is the source of truth here, not the pre-guard default —
    // this is the actual, honest text a probability-less run produces.
    render(<InsightsPanel insights={null} />)

    const summary = screen.getByTestId('insights-summary')
    expect(summary).toHaveTextContent('Analysis finished, but no probability was computed. Check the canvas for any incomplete inputs.')
  })

  it('handles undefined insights gracefully', () => {
    render(<InsightsPanel insights={undefined} />)

    const summary = screen.getByTestId('insights-summary')
    expect(summary).toHaveTextContent('Analysis finished, but no probability was computed. Check the canvas for any incomplete inputs.')
  })

  it('handles missing summary with default', () => {
    render(<InsightsPanel insights={{ risks: ['Risk 1'], next_steps: [] }} />)

    const summary = screen.getByTestId('insights-summary')
    expect(summary).toHaveTextContent('Analysis finished, but no probability was computed. Check the canvas for any incomplete inputs.')
  })

  it('truncates oversized summary to 200 characters', () => {
    // Real probability so the strict-render guard doesn't override the
    // (deliberately oversized) summary this test exists to truncate.
    useCanvasStore.setState({ results: { status: 'complete', report: { probability_of_goal: 0.62 } } } as never)
    const longSummary = 'A'.repeat(250) // 250 chars
    render(<InsightsPanel insights={{ summary: longSummary, risks: [], next_steps: [] }} />)

    const summary = screen.getByTestId('insights-summary')
    // Should be truncated to 197 + '...' = 200 chars
    expect(summary.textContent?.length).toBeLessThanOrEqual(200)
    expect(summary.textContent?.endsWith('...')).toBe(true)
  })

  it('limits risks to maximum 5 items', () => {
    const manyRisks = Array.from({ length: 10 }, (_, i) => `Risk ${i + 1}`)
    render(<InsightsPanel insights={{ summary: 'Test', risks: manyRisks, next_steps: [] }} />)

    const risksList = screen.getByTestId('risks-list')
    const items = risksList.querySelectorAll('li')
    expect(items.length).toBe(5)
  })

  it('limits next_steps to maximum 3 items', () => {
    const manySteps = Array.from({ length: 10 }, (_, i) => `Step ${i + 1}`)
    render(<InsightsPanel insights={{ summary: 'Test', risks: [], next_steps: manySteps }} />)

    const nextStepsList = screen.getByTestId('next-steps-list')
    const items = nextStepsList.querySelectorAll('li')
    expect(items.length).toBe(3)
  })

  it('filters out empty strings from arrays', () => {
    render(<InsightsPanel insights={{ summary: 'Test', risks: ['Risk 1', '', 'Risk 2', null as any], next_steps: [] }} />)

    const risksList = screen.getByTestId('risks-list')
    const items = risksList.querySelectorAll('li')
    expect(items.length).toBe(2)
    expect(screen.getByText('Risk 1')).toBeInTheDocument()
    expect(screen.getByText('Risk 2')).toBeInTheDocument()
  })

  it('handles empty object insights', () => {
    render(<InsightsPanel insights={{}} />)

    const summary = screen.getByTestId('insights-summary')
    expect(summary).toHaveTextContent('Analysis finished, but no probability was computed. Check the canvas for any incomplete inputs.')
    expect(screen.queryByTestId('insights-details')).not.toBeInTheDocument()
  })
})

describe('InsightsSummaryCompact', () => {
  it('renders summary in compact form', () => {
    // Real probability so the strict-render guard doesn't override
    // mockFullInsights.summary with the no-probability fallback.
    useCanvasStore.setState({ results: { status: 'complete', report: { probability_of_goal: 0.62 } } } as never)
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
