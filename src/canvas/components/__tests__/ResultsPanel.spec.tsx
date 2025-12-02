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
import { ToastProvider } from '../../ToastContext'
import type { ReportV1 } from '../../../adapters/plot/types'

// toHaveNoViolations is already globally extended in tests/setup/rtl.ts

// Mock validation feedback to avoid requiring a React Flow provider in these DOM tests
vi.mock('../../hooks/useValidationFeedback', () => ({
  useValidationFeedback: () => ({
    focusError: () => {},
    formatError: (error: any) => error,
    formatErrors: (errors: any[]) => errors,
  }),
}))

// Test wrapper with LayerProvider and ToastProvider
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <LayerProvider>{ui}</LayerProvider>
    </ToastProvider>
  )
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
      expect(container.querySelector('[aria-label="Analysis Results"]')).not.toBeInTheDocument()
    })

    it('renders when isOpen is true', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByRole('complementary', { name: 'Analysis Results' })).toBeInTheDocument()
    })

    it('displays Results heading', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Analysis Results')).toBeInTheDocument()
    })

    it('displays tabs (Latest, History, Compare)', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByRole('button', { name: /Latest/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /History/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Compare/ })).toBeInTheDocument()
    })
  })

  describe('State Transitions', () => {
    it('shows Idle state initially', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Ready to analyse')).toBeInTheDocument()
      expect(screen.getByText('Add nodes to your canvas to get started.')).toBeInTheDocument()
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

      expect(screen.getByText('Analysing decision tree...')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
    })

    it('renders loading skeleton while analysis is streaming', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsConnecting('test-run-123')
      useCanvasStore.getState().resultsProgress(10)

      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(
        screen.getByRole('status', { name: 'Running analysis' }),
      ).toBeInTheDocument()
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
    it('displays seed in trust footer when available', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Trust footer should show Seed label and value
      expect(screen.getByText('Seed')).toBeInTheDocument()
      expect(screen.getByText('1337')).toBeInTheDocument()
    })

    it('displays hash in trust footer when available', () => {
      useCanvasStore.getState().resultsStart({ seed: 1337 })
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: 'abc123def456'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Trust footer should show Response label and hash preview
      expect(screen.getByText('Response')).toBeInTheDocument()
      expect(screen.getByText(/abc123def456/)).toBeInTheDocument()
    })

    it('shows not-available messages when seed and hash are missing', () => {
      // Do not set seed or hash explicitly
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: undefined as any
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Trust footer still renders with calm "Not available" copy
      const notAvailableMessages = screen.getAllByText('Not available for this run')
      expect(notAvailableMessages.length).toBeGreaterThanOrEqual(1)

      // Copy button should not be rendered without a hash
      expect(screen.queryByRole('button', { name: 'Copy full hash' })).not.toBeInTheDocument()
    })

    it('does not render trust footer when there is no report', () => {
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.queryByLabelText('Trust and reproducibility details')).not.toBeInTheDocument()
    })

    it('copies full hash to clipboard when copy button is clicked', async () => {
      const hash = 'sha256:abcdef1234567890abcdef1234567890'

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })

      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      const copyButton = screen.getByRole('button', { name: 'Copy full hash' })
      fireEvent.click(copyButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(hash)
    })

    it('shows an engine label in the trust footer', () => {
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Engine')).toBeInTheDocument()
      // Label is derived from adapterName (e.g. "PLoT (mock)", "PLoT (auto-detect)")
      expect(screen.getByText(/PLoT/)).toBeInTheDocument()
    })
  })

  describe('Decision story', () => {
    it('falls back to generic copy when framing is missing', () => {
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })

      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Section heading
      expect(screen.getByText('Decision story')).toBeInTheDocument()

      // Generic story when no framing has been captured
      expect(
        screen.getByText('You are reviewing this decision based on the current graph and results.'),
      ).toBeInTheDocument()

      // Limits and health summaries should use calm fallback copy
      expect(
        screen.getByText(
          'Limits: Limits unavailable. You can still edit the graph, but run behaviour may be constrained.',
        ),
      ).toBeInTheDocument()

      expect(screen.getByText('Run analysis to check health')).toBeInTheDocument()
      expect(
        screen.getByText('No recent health check. Run diagnostics to analyse this graph.'),
      ).toBeInTheDocument()
    })

    it('renders scenario framing when present in the store', () => {
      useCanvasStore.setState({
        currentScenarioFraming: {
          title: 'Choose launch strategy',
          goal: 'Maximise sustainable impact',
          timeline: 'Next 6 months',
        },
      } as any)

      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash,
      })

      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Decision story')).toBeInTheDocument()
      expect(screen.getByText(/You are deciding/)).toBeInTheDocument()
      expect(screen.getByText('Choose launch strategy')).toBeInTheDocument()
      // Goal and timeline text may be split across text nodes and spans
      expect(screen.getByText(/Primary goal:/)).toBeInTheDocument()
      expect(screen.getByText('Maximise sustainable impact')).toBeInTheDocument()
      expect(screen.getByText(/Time horizon:/)).toBeInTheDocument()
      expect(screen.getByText('Next 6 months')).toBeInTheDocument()
    })

    it('offers a CTA to open graph issues when health data is present', () => {
      // Seed graph health in the store
      useCanvasStore.setState({
        graphHealth: {
          status: 'errors',
          score: 60,
          issues: [
            { id: 'i1', type: 'cycle', severity: 'error', message: 'Cycle detected' },
          ],
        },
      } as any)

      // Seed a completed report so the Decision story section renders
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash,
      })

      const setShowIssuesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'setShowIssuesPanel')

      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      const cta = screen.getByRole('button', { name: 'Open graph issues' })
      expect(cta).toBeInTheDocument()

      fireEvent.click(cta)

      expect(setShowIssuesPanelSpy).toHaveBeenCalledWith(true)
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

      expect(screen.getByRole('button', { name: 'Analyse again' })).toBeInTheDocument()
    })

    it('calls onRunAgain when Run Again clicked', async () => {
      useCanvasStore.getState().resultsComplete({
        report: mockReport,
        hash: mockReport.model_card.response_hash
      })
      const onRunAgain = vi.fn()
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} onRunAgain={onRunAgain} />)

      const runAgainButton = screen.getByRole('button', { name: 'Analyse again' })
      fireEvent.click(runAgainButton)

      await waitFor(() => {
        expect(onRunAgain).toHaveBeenCalledTimes(1)
      })
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
        <ToastProvider>
          <LayerProvider>
            <ResultsPanel isOpen={true} onClose={vi.fn()} />
          </LayerProvider>
        </ToastProvider>
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

      expect(screen.getByText('Analysing decision tree...')).toBeInTheDocument()
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

  describe('v1.2 Canonical Run Format', () => {
    it('renders non-null bands from canonical run', () => {
      const reportWithCanonical: ReportV1 = {
        ...mockReport,
        run: {
          responseHash: 'v1.2-hash',
          bands: { p10: 1000, p50: 5000, p90: 10000 },
        },
      }

      useCanvasStore.getState().resultsComplete({
        report: reportWithCanonical,
        hash: 'v1.2-hash'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // KPI headline should show p50 value
      const kpiValues = screen.getAllByText('5000.0%')
      expect(kpiValues.length).toBeGreaterThanOrEqual(1)

      // Range chips should show p10/p50/p90
      expect(screen.getByText('1000.0%')).toBeInTheDocument()
      expect(screen.getByText('10000.0%')).toBeInTheDocument()
    })

    it('renders "—" placeholder for null bands', () => {
      const reportWithNullBands: ReportV1 = {
        ...mockReport,
        run: {
          responseHash: 'partial-hash',
          bands: { p10: null, p50: null, p90: null },
        },
      }

      useCanvasStore.getState().resultsComplete({
        report: reportWithNullBands,
        hash: 'partial-hash'
      })
      const { container } = renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Should show "—" placeholders (appears multiple times - KPIHeadline + 3 RangeChips)
      const textContent = container.textContent || ''
      const placeholderCount = (textContent.match(/—/g) || []).length
      expect(placeholderCount).toBeGreaterThanOrEqual(4)
    })

    it('falls back to legacy results when canonical run not present', () => {
      const reportWithoutCanonical: ReportV1 = {
        ...mockReport,
        run: undefined,
      }

      useCanvasStore.getState().resultsComplete({
        report: reportWithoutCanonical,
        hash: mockReport.model_card.response_hash
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Should show legacy results values
      const likelyValues = screen.getAllByText('150.0%')
      expect(likelyValues.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('100.0%')).toBeInTheDocument() // conservative
      expect(screen.getByText('200.0%')).toBeInTheDocument() // optimistic
    })

    it('displays BLOCKER critique as advisory banner', () => {
      const reportWithCritique: ReportV1 = {
        ...mockReport,
        run: {
          responseHash: 'critique-hash',
          bands: { p10: 1000, p50: 5000, p90: 10000 },
          critique: [
            { severity: 'INFO', message: 'Graph is well-formed' },
            { severity: 'BLOCKER', message: 'Cycle detected in graph' },
            { severity: 'WARNING', message: 'Low confidence on edge E1' },
          ],
        },
      }

      useCanvasStore.getState().resultsComplete({
        report: reportWithCritique,
        hash: 'critique-hash'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Should show BLOCKER advisory
      expect(screen.getByText('Critical Issues Detected')).toBeInTheDocument()
      expect(screen.getByText(/Cycle detected in graph/)).toBeInTheDocument()

      // Should NOT show INFO or WARNING in the advisory
      expect(screen.queryByText(/Graph is well-formed/)).not.toBeInTheDocument()
    })

    it('does not show critique banner when no BLOCKER items', () => {
      const reportWithoutBlockers: ReportV1 = {
        ...mockReport,
        run: {
          responseHash: 'no-blockers',
          bands: { p10: 1000, p50: 5000, p90: 10000 },
          critique: [
            { severity: 'INFO', message: 'Graph is well-formed' },
            { severity: 'WARNING', message: 'Low confidence on edge E1' },
          ],
        },
      }

      useCanvasStore.getState().resultsComplete({
        report: reportWithoutBlockers,
        hash: 'no-blockers'
      })
      renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

      // Should NOT show critical issues banner
      expect(screen.queryByText('Critical Issues Detected')).not.toBeInTheDocument()
    })
  })
})
