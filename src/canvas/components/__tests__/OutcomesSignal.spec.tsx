/**
 * OutcomesSignal Unit Tests
 *
 * Tests for outcome display including baseline edge cases:
 * - baseline === 0 (status quo / "do nothing" scenario)
 * - identical options (negligible difference)
 * - no meaningful difference
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutcomesSignal } from '../OutcomesSignal'

// Mock the store
const mockResults = {
  report: {
    results: {
      conservative: 0.15,
      likely: 0.25,
      optimistic: 0.45,
      units: 'percent',
    },
    confidence: {
      level: 'high',
      why: 'Based on validated factors',
    },
  },
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      results: mockResults,
    }
    return selector(state)
  }),
}))

// Import after mock setup
import { useCanvasStore } from '../../store'

describe('OutcomesSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to default results
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const state = { results: mockResults }
      return selector(state as any)
    })
  })

  describe('rendering', () => {
    it('renders outcomes signal with data-testid', () => {
      render(<OutcomesSignal />)
      expect(screen.getByTestId('outcomes-signal')).toBeInTheDocument()
    })

    it('displays compact view when collapsed (avoiding duplication with DecisionSummary)', () => {
      render(<OutcomesSignal />)
      // When collapsed, shows "Outcome Details" label to avoid duplicating DecisionSummary
      expect(screen.getByText('Outcome Details')).toBeInTheDocument()
      // Shows range summary in collapsed view
      expect(screen.getByText(/Range:/)).toBeInTheDocument()
      // Does NOT show full "Success Likelihood" - that's in DecisionSummary
      expect(screen.queryByText('Success Likelihood')).not.toBeInTheDocument()
    })

    it('displays success likelihood value when expanded', () => {
      render(<OutcomesSignal defaultExpanded={true} />)
      expect(screen.getByText('Success Likelihood')).toBeInTheDocument()
      // Format shows one decimal place
      expect(screen.getByText('25.0%')).toBeInTheDocument()
    })

    it('displays objective text when provided', () => {
      render(<OutcomesSignal objectiveText="Increase customer satisfaction" />)
      expect(screen.getByText('Your Objective')).toBeInTheDocument()
      expect(screen.getByText('Increase customer satisfaction')).toBeInTheDocument()
    })

    it('displays empty state when no results', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        return selector({ results: null } as any)
      })

      render(<OutcomesSignal />)
      expect(screen.getByText('No outcomes yet')).toBeInTheDocument()
      expect(screen.getByText('Run analysis to see predictions')).toBeInTheDocument()
    })
  })

  describe('baseline comparison', () => {
    describe('baseline === 0 (status quo)', () => {
      it('shows comparison when baseline is exactly 0 (expanded)', () => {
        render(<OutcomesSignal baseline={0} baselineName="do nothing" defaultExpanded={true} />)

        // Should show "25% above" since outcome is 25% (0.25) and baseline is 0
        expect(screen.getByText(/% above/)).toBeInTheDocument()
        // Text appears in both header and detail section
        expect(screen.getAllByText(/vs\. do nothing/).length).toBeGreaterThan(0)
      })

      it('formats absolute change correctly with baseline=0 (expanded)', () => {
        render(<OutcomesSignal baseline={0} baselineName="status quo" defaultExpanded={true} />)

        // Outcome is 0.25 (25%), baseline is 0
        // Should show "+25% above status quo"
        expect(screen.getByText(/\+25% above/)).toBeInTheDocument()
      })

      it('shows negative absolute change when outcome below baseline (expanded)', () => {
        vi.mocked(useCanvasStore).mockImplementation((selector) => {
          const state = {
            results: {
              report: {
                results: {
                  conservative: 0.05,
                  likely: 0.10,
                  optimistic: 0.20,
                  units: 'percent',
                },
                confidence: { level: 'medium' },
              },
            },
          }
          return selector(state as any)
        })

        // outcome 10% vs baseline 25% = -60% (relative change)
        render(<OutcomesSignal baseline={0.25} goalDirection="maximize" defaultExpanded={true} />)

        // Should show "worse" since outcome < baseline and goal is maximize
        expect(screen.getByText(/worse/)).toBeInTheDocument()
      })
    })

    describe('identical options (negligible difference)', () => {
      it('returns null comparison for negligible difference in 0-1 scale (expanded)', () => {
        // Outcome is 0.25 (25%), baseline is 0.252 (25.2%)
        // Delta = -0.002 which is < 0.005 threshold
        render(<OutcomesSignal baseline={0.252} defaultExpanded={true} />)

        expect(screen.getByText('No baseline for comparison')).toBeInTheDocument()
      })

      it('returns null comparison for exactly identical values (expanded)', () => {
        render(<OutcomesSignal baseline={0.25} defaultExpanded={true} />)

        expect(screen.getByText('No baseline for comparison')).toBeInTheDocument()
      })

      it('shows comparison when difference is meaningful (expanded)', () => {
        // Baseline 0.20 (20%), outcome 0.25 (25%) = 5% difference
        render(<OutcomesSignal baseline={0.20} defaultExpanded={true} />)

        expect(screen.queryByText('No baseline for comparison')).not.toBeInTheDocument()
        expect(screen.getByText(/better/)).toBeInTheDocument()
      })
    })

    describe('no meaningful difference', () => {
      it('handles null baseline gracefully (expanded)', () => {
        render(<OutcomesSignal baseline={null} defaultExpanded={true} />)

        expect(screen.getByText('No baseline for comparison')).toBeInTheDocument()
      })

      it('handles undefined baseline gracefully (expanded)', () => {
        render(<OutcomesSignal baseline={undefined} defaultExpanded={true} />)

        expect(screen.getByText('No baseline for comparison')).toBeInTheDocument()
      })
    })

    describe('relative vs absolute comparison', () => {
      it('uses percentage change for non-zero baseline (expanded)', () => {
        // Baseline 0.20, outcome 0.25: (0.25-0.20)/0.20 = 25% increase
        render(<OutcomesSignal baseline={0.20} defaultExpanded={true} />)

        // Should show "25% better" not "5 pts"
        expect(screen.getByText(/25% better/)).toBeInTheDocument()
      })

      it('uses absolute percentage for baseline=0 (expanded)', () => {
        // Baseline 0, outcome 0.25: show +25%
        render(<OutcomesSignal baseline={0} defaultExpanded={true} />)

        expect(screen.getByText(/25% above/)).toBeInTheDocument()
      })
    })

    describe('goal direction interpretation', () => {
      it('marks increase as positive when goal is maximize (expanded)', () => {
        render(<OutcomesSignal baseline={0.10} goalDirection="maximize" defaultExpanded={true} />)

        // Outcome 25% > baseline 10% = increase = positive for maximize
        // Should use mint-600 (positive color)
        const comparison = screen.getByText(/better/)
        expect(comparison).toHaveClass('text-mint-600')
      })

      it('marks decrease as positive when goal is minimize (expanded)', () => {
        vi.mocked(useCanvasStore).mockImplementation((selector) => {
          const state = {
            results: {
              report: {
                results: {
                  conservative: 0.05,
                  likely: 0.10,
                  optimistic: 0.20,
                  units: 'percent',
                },
                confidence: { level: 'medium' },
              },
            },
          }
          return selector(state as any)
        })

        render(<OutcomesSignal baseline={0.25} goalDirection="minimize" defaultExpanded={true} />)

        // Outcome 10% < baseline 25% = decrease = positive for minimize
        const comparison = screen.getByText(/better/)
        expect(comparison).toHaveClass('text-mint-600')
      })

      it('marks increase as negative when goal is minimize (expanded)', () => {
        vi.mocked(useCanvasStore).mockImplementation((selector) => {
          const state = {
            results: {
              report: {
                results: {
                  conservative: 0.30,
                  likely: 0.40,
                  optimistic: 0.60,
                  units: 'percent',
                },
                confidence: { level: 'medium' },
              },
            },
          }
          return selector(state as any)
        })

        render(<OutcomesSignal baseline={0.20} goalDirection="minimize" defaultExpanded={true} />)

        // Outcome 40% > baseline 20% = increase = negative for minimize
        const comparison = screen.getByText(/worse/)
        expect(comparison).toHaveClass('text-carrot-600')
      })
    })
  })

  describe('expanded view', () => {
    it('starts collapsed by default', () => {
      render(<OutcomesSignal />)

      expect(screen.queryByText('70% Confidence Range')).not.toBeInTheDocument()
    })

    it('starts expanded when defaultExpanded=true', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      expect(screen.getByText('70% Confidence Range')).toBeInTheDocument()
    })

    it('expands when clicked', () => {
      render(<OutcomesSignal />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.getByText('70% Confidence Range')).toBeInTheDocument()
      expect(screen.getByText('Worst Case')).toBeInTheDocument()
      expect(screen.getByText('Best Case')).toBeInTheDocument()
    })

    it('collapses when clicked again', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.queryByText('70% Confidence Range')).not.toBeInTheDocument()
    })

    it('shows baseline detail in expanded view', () => {
      render(<OutcomesSignal defaultExpanded={true} baseline={0.20} baselineName="current state" />)

      // "vs. current state" appears in both collapsed header and expanded detail
      expect(screen.getAllByText(/vs\. current state/).length).toBeGreaterThan(0)
    })
  })

  describe('confidence display', () => {
    it('shows high confidence badge', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      expect(screen.getByText('High confidence')).toBeInTheDocument()
    })

    it('shows medium confidence badge', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          results: {
            report: {
              results: {
                conservative: 0.15,
                likely: 0.25,
                optimistic: 0.45,
                units: 'percent',
              },
              confidence: { level: 'medium', why: 'Some uncertainty' },
            },
          },
        }
        return selector(state as any)
      })

      render(<OutcomesSignal defaultExpanded={true} />)

      expect(screen.getByText('Medium confidence')).toBeInTheDocument()
    })

    it('shows low confidence badge', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          results: {
            report: {
              results: {
                conservative: 0.15,
                likely: 0.25,
                optimistic: 0.45,
                units: 'percent',
              },
              confidence: { level: 'low', why: 'High uncertainty' },
            },
          },
        }
        return selector(state as any)
      })

      render(<OutcomesSignal defaultExpanded={true} />)

      expect(screen.getByText('Low confidence')).toBeInTheDocument()
    })

    it('shows confidence explanation when provided', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      expect(screen.getByText('Based on validated factors')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has aria-expanded on expand button', () => {
      render(<OutcomesSignal />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })
  })
})
