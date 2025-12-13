/**
 * UtilityWeightPanel Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UtilityWeightPanel } from '../UtilityWeightPanel'

// Mock the httpV1Adapter
vi.mock('../../../adapters/plot/httpV1Adapter', () => ({
  httpV1Adapter: {
    suggestUtilityWeights: vi.fn(),
  },
}))

describe('UtilityWeightPanel', () => {
  const mockOutcomeNodes = [
    { id: 'outcome-1', label: 'Revenue' },
    { id: 'outcome-2', label: 'Customer Satisfaction' },
    { id: 'outcome-3', label: 'Market Share' },
  ]

  const mockGraph = {
    nodes: [
      { id: 'outcome-1', type: 'outcome', label: 'Revenue' },
      { id: 'outcome-2', type: 'outcome', label: 'Customer Satisfaction' },
      { id: 'outcome-3', type: 'outcome', label: 'Market Share' },
    ],
    edges: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders weight sliders for each outcome node', () => {
      render(<UtilityWeightPanel outcomeNodes={mockOutcomeNodes} />)

      expect(screen.getByLabelText('Revenue weight')).toBeInTheDocument()
      expect(screen.getByLabelText('Customer Satisfaction weight')).toBeInTheDocument()
      expect(screen.getByLabelText('Market Share weight')).toBeInTheDocument()
    })

    it('renders empty state when no outcome nodes', () => {
      render(<UtilityWeightPanel outcomeNodes={[]} />)

      expect(screen.getByText(/no outcome nodes available/i)).toBeInTheDocument()
    })

    it('displays "Suggest weights" button', () => {
      render(<UtilityWeightPanel outcomeNodes={mockOutcomeNodes} graph={mockGraph} />)

      expect(screen.getByLabelText('Get AI-suggested weights')).toBeInTheDocument()
    })

    it('has data-testid for integration testing', () => {
      render(<UtilityWeightPanel outcomeNodes={mockOutcomeNodes} />)

      expect(screen.getByTestId('utility-weight-panel')).toBeInTheDocument()
    })
  })

  describe('weight sliders', () => {
    it('initializes with equal weights', () => {
      render(<UtilityWeightPanel outcomeNodes={mockOutcomeNodes} />)

      // With 3 nodes, each should be ~33%
      const sliders = screen.getAllByRole('slider')
      expect(sliders).toHaveLength(3)

      // Each slider should have value around 0.33
      sliders.forEach(slider => {
        const value = parseFloat((slider as HTMLInputElement).value)
        expect(value).toBeCloseTo(1 / 3, 1)
      })
    })

    it('uses initial weights when provided', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.5,
            'outcome-2': 0.3,
            'outcome-3': 0.2,
          }}
        />
      )

      const slider1 = screen.getByLabelText('Revenue weight') as HTMLInputElement
      expect(parseFloat(slider1.value)).toBeCloseTo(0.5)

      const slider2 = screen.getByLabelText('Customer Satisfaction weight') as HTMLInputElement
      expect(parseFloat(slider2.value)).toBeCloseTo(0.3)
    })

    it('updates weight when slider changes', () => {
      const onWeightsChange = vi.fn()
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          onWeightsChange={onWeightsChange}
        />
      )

      const slider = screen.getByLabelText('Revenue weight')
      fireEvent.change(slider, { target: { value: '0.6' } })

      expect(onWeightsChange).toHaveBeenCalled()
    })

    it('displays weight percentages', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.5,
            'outcome-2': 0.3,
            'outcome-3': 0.2,
          }}
        />
      )

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('30%')).toBeInTheDocument()
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
  })

  describe('normalization', () => {
    it('shows warning when weights do not sum to 100%', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.6,
            'outcome-2': 0.3,
            'outcome-3': 0.3,
          }}
        />
      )

      // Total is 120%, should show warning
      expect(screen.getByRole('alert')).toBeInTheDocument()
      // 120% appears in both warning and total indicator - use getAllByText
      expect(screen.getAllByText(/120%/).length).toBeGreaterThan(0)
    })

    it('hides warning when weights sum to 100%', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.5,
            'outcome-2': 0.3,
            'outcome-3': 0.2,
          }}
        />
      )

      // Should not have warning role
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows normalize button when not normalized', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.6,
            'outcome-2': 0.3,
            'outcome-3': 0.3,
          }}
        />
      )

      expect(screen.getByText('Normalize')).toBeInTheDocument()
    })
  })

  describe('action buttons', () => {
    it('renders "Equal split" button', () => {
      render(<UtilityWeightPanel outcomeNodes={mockOutcomeNodes} />)

      expect(screen.getByText('Equal split')).toBeInTheDocument()
    })

    it('resets to equal weights when Equal split is clicked', () => {
      const onWeightsChange = vi.fn()
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.7,
            'outcome-2': 0.2,
            'outcome-3': 0.1,
          }}
          onWeightsChange={onWeightsChange}
        />
      )

      fireEvent.click(screen.getByText('Equal split'))

      // Should call onWeightsChange with equal weights
      expect(onWeightsChange).toHaveBeenCalled()
      const lastCall = onWeightsChange.mock.calls[onWeightsChange.mock.calls.length - 1][0]
      expect(lastCall['outcome-1']).toBeCloseTo(1 / 3)
      expect(lastCall['outcome-2']).toBeCloseTo(1 / 3)
      expect(lastCall['outcome-3']).toBeCloseTo(1 / 3)
    })
  })

  describe('disabled state', () => {
    it('disables sliders when disabled prop is true', () => {
      render(<UtilityWeightPanel outcomeNodes={mockOutcomeNodes} disabled={true} />)

      const sliders = screen.getAllByRole('slider')
      sliders.forEach(slider => {
        expect(slider).toBeDisabled()
      })
    })

    it('disables suggest button when disabled', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          graph={mockGraph}
          disabled={true}
        />
      )

      expect(screen.getByLabelText('Get AI-suggested weights')).toBeDisabled()
    })
  })

  describe('total indicator', () => {
    it('shows normalized total with checkmark', () => {
      render(
        <UtilityWeightPanel
          outcomeNodes={mockOutcomeNodes}
          initialWeights={{
            'outcome-1': 0.5,
            'outcome-2': 0.3,
            'outcome-3': 0.2,
          }}
        />
      )

      // Checkmark is part of the total indicator text
      expect(screen.getByText(/Total:.*100%.*✓/)).toBeInTheDocument()
    })
  })
})
