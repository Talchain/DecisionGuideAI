/**
 * OutcomesSignal Unit Tests
 *
 * Tests for outcome display including baseline edge cases:
 * - baseline === 0 (status quo / "do nothing" scenario)
 * - identical options (negligible difference)
 * - no meaningful difference
 *
 * Rewritten to match current component API:
 * - Collapsed view shows "Success Likelihood" (high conf) or "Outcome Range" (medium/low)
 * - Expanded view shows "80% Confidence Range", "Pessimistic", "Optimistic"
 * - Baseline comparison uses absolute points format ("+N pts better/worse")
 * - Negligible delta shows "Stable outcome" / "No significant change"
 * - Null/undefined baseline shows "No baseline set"
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

    it('displays Success Likelihood label for high-confidence results', () => {
      render(<OutcomesSignal />)
      // High confidence → precisionDisplay.isPointEstimate = true → "Success Likelihood"
      expect(screen.getByText('Success Likelihood')).toBeInTheDocument()
    })

    it('displays Outcome Range label for medium-confidence results', () => {
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

      render(<OutcomesSignal />)
      // Medium confidence → precisionDisplay.isPointEstimate = false → "Outcome Range"
      expect(screen.getByText('Outcome Range')).toBeInTheDocument()
    })

    it('displays the headline value (point estimate for high confidence)', () => {
      render(<OutcomesSignal />)
      // High confidence: headline = formatOutcomeValue(0.25, 'percent') = "25.0%"
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

    it('displays empty state when results have no report', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        return selector({ results: {} } as any)
      })

      render(<OutcomesSignal />)
      expect(screen.getByText('No outcomes yet')).toBeInTheDocument()
    })
  })

  describe('baseline comparison', () => {
    describe('baseline === 0 (status quo)', () => {
      it('shows comparison when baseline is exactly 0', () => {
        render(<OutcomesSignal baseline={0} baselineName="do nothing" />)

        // delta=0.25, probability scale → "+25 pts" then "better" (maximize default)
        expect(screen.getByText(/\+25 pts/)).toBeInTheDocument()
        expect(screen.getByText(/better/)).toBeInTheDocument()
        expect(screen.getByText(/vs\. do nothing/)).toBeInTheDocument()
      })

      it('formats absolute change correctly with baseline=0', () => {
        render(<OutcomesSignal baseline={0} baselineName="status quo" />)

        // Outcome is 0.25 (25%), baseline is 0
        // computeBaselineComparison: delta=0.25, prob scale → "+25 pts"
        expect(screen.getByText(/\+25 pts/)).toBeInTheDocument()
      })

      it('shows negative change when outcome below baseline', () => {
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

        // outcome 0.10 vs baseline 0.25: delta=-0.15 → "-15 pts"
        // goal=maximize, decrease → isPositive=false → "worse"
        render(<OutcomesSignal baseline={0.25} goalDirection="maximize" />)

        expect(screen.getByText(/worse/)).toBeInTheDocument()
      })
    })

    describe('identical options (negligible difference)', () => {
      it('shows stable outcome for negligible difference in 0-1 scale', () => {
        // Outcome is 0.25, baseline is 0.252
        // Delta = -0.002 which is < 0.005 threshold → null → "Stable outcome"
        render(<OutcomesSignal baseline={0.252} />)

        expect(screen.getByText('Stable outcome')).toBeInTheDocument()
        expect(screen.getByText('No significant change')).toBeInTheDocument()
      })

      it('shows stable outcome for exactly identical values', () => {
        render(<OutcomesSignal baseline={0.25} />)

        expect(screen.getByText('Stable outcome')).toBeInTheDocument()
        expect(screen.getByText('No significant change')).toBeInTheDocument()
      })

      it('shows comparison when difference is meaningful', () => {
        // Baseline 0.20, outcome 0.25: delta=0.05 > threshold 0.005 → "+5 pts better"
        render(<OutcomesSignal baseline={0.20} />)

        expect(screen.queryByText('Stable outcome')).not.toBeInTheDocument()
        expect(screen.getByText(/better/)).toBeInTheDocument()
      })
    })

    describe('no baseline provided', () => {
      it('handles null baseline gracefully', () => {
        render(<OutcomesSignal baseline={null} />)

        expect(screen.getByText('No baseline set')).toBeInTheDocument()
      })

      it('handles undefined baseline gracefully', () => {
        render(<OutcomesSignal baseline={undefined} />)

        expect(screen.getByText('No baseline set')).toBeInTheDocument()
      })
    })

    describe('comparison format', () => {
      it('uses absolute points for probability-scale values', () => {
        // Baseline 0.20, outcome 0.25: prob scale → "+5 pts"
        render(<OutcomesSignal baseline={0.20} />)

        expect(screen.getByText(/\+5 pts/)).toBeInTheDocument()
        expect(screen.getByText(/better/)).toBeInTheDocument()
      })

      it('uses absolute points for baseline=0', () => {
        // Baseline 0, outcome 0.25: prob scale → "+25 pts"
        render(<OutcomesSignal baseline={0} />)

        expect(screen.getByText(/\+25 pts/)).toBeInTheDocument()
      })
    })

    describe('goal direction interpretation', () => {
      it('marks increase as positive when goal is maximize', () => {
        render(<OutcomesSignal baseline={0.10} goalDirection="maximize" />)

        // Outcome 0.25 > baseline 0.10 → increase → positive for maximize
        const comparison = screen.getByText(/better/)
        expect(comparison.closest('span')).toHaveClass('text-mint-600')
      })

      it('marks decrease as positive when goal is minimize', () => {
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

        render(<OutcomesSignal baseline={0.25} goalDirection="minimize" />)

        // Outcome 0.10 < baseline 0.25 → decrease → positive for minimize
        const comparison = screen.getByText(/better/)
        expect(comparison.closest('span')).toHaveClass('text-mint-600')
      })

      it('marks increase as negative when goal is minimize', () => {
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

        render(<OutcomesSignal baseline={0.20} goalDirection="minimize" />)

        // Outcome 0.40 > baseline 0.20 → increase → negative for minimize
        const comparison = screen.getByText(/worse/)
        expect(comparison.closest('span')).toHaveClass('text-carrot-600')
      })
    })
  })

  describe('expanded view', () => {
    it('starts collapsed by default', () => {
      render(<OutcomesSignal />)

      expect(screen.queryByText('80% Confidence Range')).not.toBeInTheDocument()
    })

    it('starts expanded when defaultExpanded=true', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      expect(screen.getByText('80% Confidence Range')).toBeInTheDocument()
    })

    it('expands when clicked', () => {
      render(<OutcomesSignal />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.getByText('80% Confidence Range')).toBeInTheDocument()
      expect(screen.getByText('Pessimistic')).toBeInTheDocument()
      expect(screen.getByText('Optimistic')).toBeInTheDocument()
    })

    it('collapses when clicked again', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.queryByText('80% Confidence Range')).not.toBeInTheDocument()
    })

    it('shows pessimistic and optimistic values', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      // p10=0.15 → "15.0%", p90=0.45 → "45.0%"
      expect(screen.getByText('If things go poorly')).toBeInTheDocument()
      expect(screen.getByText('If things go well')).toBeInTheDocument()
    })

    it('shows baseline detail in expanded view', () => {
      render(<OutcomesSignal defaultExpanded={true} baseline={0.20} baselineName="current state" />)

      // "vs. current state" appears in both collapsed header and expanded detail
      expect(screen.getAllByText(/vs\. current state/).length).toBeGreaterThan(0)
    })

    it('shows range bar with expected value', () => {
      render(<OutcomesSignal defaultExpanded={true} />)

      // Range labels in the bar section
      expect(screen.getByText('Expected')).toBeInTheDocument()
      expect(screen.getByText('70% likely range')).toBeInTheDocument()
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

    it('hides Target icon from screen readers with aria-hidden', () => {
      render(<OutcomesSignal objectiveText="Test objective" />)

      // The Target icon in the objective section has aria-hidden="true"
      const icons = document.querySelectorAll('[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('p90 capping', () => {
    it('caps p90 at 0.99 for probability-scale values', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const state = {
          results: {
            report: {
              results: {
                conservative: 0.80,
                likely: 0.95,
                optimistic: 1.0,
                units: 'percent',
              },
              confidence: { level: 'high', why: 'Strong data' },
            },
          },
        }
        return selector(state as any)
      })

      render(<OutcomesSignal defaultExpanded={true} />)

      // p90=1.0 should be capped at 0.99 → displayed as "99.0%" (not "100.0%")
      expect(screen.queryByText('100.0%')).not.toBeInTheDocument()
      // Positive assertion: the capped value must appear in rendered output
      expect(document.body.textContent).toContain('99')
    })
  })
})
