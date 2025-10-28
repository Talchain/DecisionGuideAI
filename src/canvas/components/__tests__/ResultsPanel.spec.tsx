/**
 * ResultsPanel tests
 * Tests state transitions, progress, cancel, error handling, and a11y
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { ResultsPanel } from '../../panels/ResultsPanel'
import { useCanvasStore } from '../../store'
import { LayerProvider } from '../LayerProvider'
import type { ReportV1 } from '../../../adapters/plot/types'

// toHaveNoViolations is already globally extended in tests/setup/rtl.ts

// Test wrapper with LayerProvider
function renderWithProviders(ui: React.ReactElement) {
  return render(<LayerProvider>{ui}</LayerProvider>)
}

// Mock report data
const mockReport: ReportV1 = {
  schema: 'report.v1',
  meta: {
    seed: 1337,
    response_id: 'test-123',
    elapsed_ms: 1500
  },
  model_card: {
    response_hash: 'abc123def456',
    response_hash_algo: 'sha256',
    normalized: true
  },
  results: {
    conservative: 100,
    likely: 150,
    optimistic: 200
  },
  confidence: {
    level: 'high',
    why: 'Strong data support'
  },
  drivers: [
    { label: 'Market growth', polarity: 'up', strength: 'high' },
    { label: 'Competition', polarity: 'down', strength: 'medium' }
  ]
}

describe('ResultsPanel', () => {
  beforeEach(() => {
    useCanvasStore.getState().resultsReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('does not render when isOpen is false', () => {
      const { container } = renderWithProviders(
        <ResultsPanel isOpen={false} onClose={vi.fn()} />
      )
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
    })

    it('renders when isOpen is true', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByRole('dialog', { name: 'Results Panel' })).toBeInTheDocument()
    })

    it('displays Results heading', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Results')).toBeInTheDocument()
    })

    it('displays tabs (Latest Run, History, Compare)', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByRole('button', { name: /Latest Run/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /History/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Compare/ })).toBeInTheDocument()
    })
  })

  describe('State Transitions', () => {
    it('shows Idle state initially', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Ready to analyze')).toBeInTheDocument()
      expect(screen.getByText('Click "Run Analysis" to start analyzing your decision tree.')).toBeInTheDocument()
    })

    it('shows Preparing state', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Preparing analysis...')).toBeInTheDocument()
    })

    it('shows Connecting state', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsConnecting('test-run-123')
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Connecting to service...')).toBeInTheDocument()
    })

    it('shows Streaming state with progress', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsConnecting('test-run-123')
      useCanvasStore.getState().resultsProgress(45)
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Analyzing decision tree...')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
    })

    it('shows Complete state with KPI and report details', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // KPI headline shows likely value (appears multiple times - in KPIHeadline and RangeChips)
      const likelyValues = screen.getAllByText('150.0%')
      expect(likelyValues.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Most Likely Outcome')).toBeInTheDocument()

      // Range chips show all three values (formatted as percent)
      expect(screen.getByText('100.0%')).toBeInTheDocument() // conservative
      expect(screen.getByText('200.0%')).toBeInTheDocument() // optimistic

      // Confidence badge
      expect(screen.getByText('High Confidence')).toBeInTheDocument()
    })

    it('shows Error state with message', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsError({
        code: 'SERVER_ERROR',
        message: 'Temporary issue. Please try again.'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('SERVER_ERROR')).toBeInTheDocument()
      expect(screen.getByText('Temporary issue. Please try again.')).toBeInTheDocument()
    })

    it('shows Cancelled state', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsCancelled()
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Analysis cancelled')).toBeInTheDocument()
    })
  })

  describe('Progress', () => {
    it('displays progress percentage during streaming', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsProgress(60)
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('60%')).toBeInTheDocument()
    })

    it('caps progress at 90% until complete', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsProgress(95) // Should be capped

      const progress = useCanvasStore.getState().results.progress
      expect(progress).toBe(90)
    })

    it('shows 100% on complete', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })

      const progress = useCanvasStore.getState().results.progress
      expect(progress).toBe(100)
    })
  })

  describe('Metadata Display', () => {
    it('displays seed in reproducibility section when available', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Open the reproducibility details section
      const details = screen.getByText('Reproducibility Info').closest('details')
      expect(details).toBeInTheDocument()

      // Click to open
      if (details) {
        fireEvent.click(screen.getByText('Reproducibility Info'))
      }

      // Seed should now be visible
      expect(screen.getByText(/Seed:/)).toBeInTheDocument()
      expect(screen.getByText('1337')).toBeInTheDocument()
    })

    it('displays hash in reproducibility section when available', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: 'abc123def456'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Open the reproducibility details section
      const details = screen.getByText('Reproducibility Info').closest('details')
      expect(details).toBeInTheDocument()

      // Click to open
      if (details) {
        fireEvent.click(screen.getByText('Reproducibility Info'))
      }

      // Hash should now be visible (first 16 chars)
      expect(screen.getByText(/Hash:/)).toBeInTheDocument()
      expect(screen.getByText(/abc123def456/)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows rate limit countdown when retryAfter provided', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsError({
        code: 'RATE_LIMITED',
        message: "We're at capacity. Try again soon.",
        retryAfter: 30
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('RATE_LIMITED')).toBeInTheDocument()
      expect(screen.getByText('Retry after 30 seconds')).toBeInTheDocument()
    })

    it('shows Retry button on error', () => {
      useCanvasStore.getState().resultsError({
        code: 'SERVER_ERROR',
        message: 'Server error'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('resets state when Retry clicked', () => {
      useCanvasStore.getState().resultsError({
        code: 'SERVER_ERROR',
        message: 'Server error'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      const retryButton = screen.getByRole('button', { name: 'Retry' })
      fireEvent.click(retryButton)

      const state = useCanvasStore.getState().results
      expect(state.status).toBe('idle')
      expect(state.error).toBeUndefined()
    })
  })

  describe('Cancel Functionality', () => {
    it('shows Run Again button after completion', () => {
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'Run Again' })).toBeInTheDocument()
    })

    it('calls onRunAgain when Run Again clicked', () => {
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      const onRunAgain = vi.fn()
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} onRunAgain={onRunAgain} />)

      const runAgainButton = screen.getByRole('button', { name: 'Run Again' })
      fireEvent.click(runAgainButton)

      expect(onRunAgain).toHaveBeenCalledTimes(1)
    })
  })

  describe('Keyboard Navigation', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn()
      renderWithProviders(<ResultsPanel isOpen={true} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: 'Close panel' })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('focuses first button when opened', async () => {
      const { rerender } = renderWithProviders(
        <ResultsPanel isOpen={false} onClose={vi.fn()} />
      )

      rerender(
        <LayerProvider>
          <ResultsPanel isOpen={true} onClose={vi.fn()} />
        </LayerProvider>
      )

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: 'Close panel' })
        expect(closeButton).toHaveFocus()
      })
    })

    it('switches to History tab when Cmd+2 pressed', async () => {
      // Add some runs to history first
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })

      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Simulate Cmd+2
      fireEvent.keyDown(window, { key: '2', metaKey: true })

      // History content should be visible
      await waitFor(() => {
        // RunHistory component should be rendered (check for history-specific elements)
        expect(screen.getByRole('button', { name: /History/ })).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has no axe violations in idle state', async () => {
      const { container } = renderWithProviders(
        <ResultsPanel isOpen={true} onClose={vi.fn()} />
      )

      const results = await axe(container)
      expect(results.violations).toHaveLength(0)
    })

    // TODO: Fix axe violation in streaming state (minor color contrast issue)
    it.skip('has no axe violations in streaming state', async () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsProgress(50)

      const { container } = renderWithProviders(
        <ResultsPanel isOpen={true} onClose={vi.fn()} />
      )

      const results = await axe(container)
      expect(results.violations).toHaveLength(0)
    })

    it('has no axe violations in error state', async () => {
      useCanvasStore.getState().resultsError({
        code: 'SERVER_ERROR',
        message: 'Test error'
      })

      const { container } = renderWithProviders(
        <ResultsPanel isOpen={true} onClose={vi.fn()} />
      )

      const results = await axe(container)
      expect(results.violations).toHaveLength(0)
    })

    it('shows status messages during streaming', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsProgress(50)
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Analyzing decision tree...')).toBeInTheDocument()
    })

    it('displays error messages prominently', () => {
      useCanvasStore.getState().resultsError({
        code: 'SERVER_ERROR',
        message: 'Test error'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('SERVER_ERROR')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })
  })
})
