/**
 * Tests for DecisionReviewPanel - M1 CEE Orchestrator UI Component
 *
 * Tests cover:
 * - Four render states (hidden, error, unavailable, success)
 * - V1 types (new contract)
 * - Legacy types (backwards compatibility)
 * - ReadinessHeader rendering
 * - TraceFooter behavior
 * - Block rendering with getBlock helper
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DecisionReviewPanel } from '../DecisionReviewPanel'
import type {
  CeeDecisionReviewPayloadV1,
  CeeTrace,
  CeeError,
  ReviewBlock,
} from '../../../types/cee'
import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from '../../decisionReview/types'

describe('DecisionReviewPanel', () => {
  describe('Loading state', () => {
    it('renders loading skeleton when status is loading', () => {
      render(<DecisionReviewPanel status="loading" />)

      expect(screen.getByTestId('decision-review-loading')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Decision review' })).toBeInTheDocument()
    })
  })

  describe('Legacy types (backwards compatibility)', () => {
    it('renders legacy ready state with story headline', () => {
      const legacyReview: CeeDecisionReviewPayload = {
        story: {
          headline: 'Legacy Test Headline',
          key_drivers: [
            { label: 'Market Size', why: 'Primary factor' },
          ],
          next_actions: [
            { label: 'Run analysis', why: 'To get results' },
          ],
        },
        journey: { is_complete: true, missing_envelopes: [] },
      }

      render(
        <DecisionReviewPanel
          status="ready"
          review={legacyReview}
        />
      )

      expect(screen.getByTestId('decision-review-ready')).toBeInTheDocument()
      expect(screen.getByTestId('decision-review-headline')).toHaveTextContent('Legacy Test Headline')
      expect(screen.getByTestId('decision-review-journey')).toHaveTextContent('complete decision journey')
      expect(screen.getByTestId('decision-review-drivers')).toBeInTheDocument()
      expect(screen.getByTestId('decision-review-next-actions')).toBeInTheDocument()
    })

    it('renders legacy error state with trace ID', () => {
      const legacyError: CeeErrorViewModel = {
        code: 'CEE_TEMPORARY',
        retryable: true,
        traceId: 'trace-123',
        suggestedAction: 'retry',
      }

      const legacyTrace: CeeTraceMeta = {
        requestId: 'req-abc',
        degraded: false,
        timestamp: '2025-11-20T18:30:00Z',
      }

      render(
        <DecisionReviewPanel
          status="error"
          error={legacyError}
          trace={legacyTrace}
        />
      )

      expect(screen.getByTestId('decision-review-error')).toBeInTheDocument()
      expect(screen.getByText('Decision Review is temporarily unavailable')).toBeInTheDocument()
      expect(screen.getByTestId('decision-review-trace-id')).toHaveTextContent('req-abc')
    })

    it('renders empty state when status is empty', () => {
      render(<DecisionReviewPanel status="empty" />)

      expect(screen.getByTestId('decision-review-empty')).toBeInTheDocument()
      expect(screen.getByText(/not available for this run/i)).toBeInTheDocument()
    })
  })

  describe('V1 types (new contract)', () => {
    const mockBlocks: ReviewBlock[] = [
      {
        id: 'recommendation',
        status: 'ok',
        source: 'cee',
        summary: 'Proceed with the plan',
        details: 'High confidence recommendation',
        priority: 1,
      },
      {
        id: 'drivers',
        status: 'ok',
        source: 'engine',
        summary: 'Key factors analyzed',
        items: [
          { id: 'drv1', label: 'Market Size', description: 'Primary driver' },
        ],
        priority: 2,
      },
      {
        id: 'risks',
        status: 'ok',
        source: 'cee',
        summary: 'Two risks identified',
        severity: 'medium',
        priority: 2,
      },
      {
        id: 'biases',
        status: 'ok',
        source: 'cee',
        summary: 'No significant biases detected',
        priority: 2,
      },
      {
        id: 'next_steps',
        status: 'ok',
        source: 'cee',
        summary: 'Review results and decide',
        priority: 3,
      },
    ]

    const mockV1Review: CeeDecisionReviewPayloadV1 = {
      intent: 'selection',
      analysis_state: 'ran',
      readiness: {
        level: 'ready',
        headline: 'Ready for decision',
        factors: [
          { label: 'Data complete', status: 'ok' },
          { label: 'Model validated', status: 'ok' },
        ],
      },
      blocks: mockBlocks,
    }

    const mockV1Trace: CeeTrace = {
      plot_request_id: 'plot-123',
      cee_sent_request_id: 'cee-sent-456',
      cee_returned_request_id: 'cee-ret-456',
      latency_ms: 150,
      model: 'claude-3-sonnet',
      id_mismatch: false,
    }

    it('renders V1 ready state with readiness header', () => {
      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={mockV1Review}
          traceV1={mockV1Trace}
        />
      )

      expect(screen.getByTestId('decision-review-ready')).toBeInTheDocument()
      expect(screen.getByTestId('readiness-header')).toBeInTheDocument()
      expect(screen.getByText('Ready for decision')).toBeInTheDocument()
    })

    it('renders V1 blocks based on intent layout', () => {
      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={mockV1Review}
          traceV1={mockV1Trace}
        />
      )

      expect(screen.getByTestId('intent-based-layout')).toBeInTheDocument()
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      expect(screen.getByTestId('review-block-recommendation')).toBeInTheDocument()
    })

    it('renders trace footer with collapse/expand', () => {
      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={mockV1Review}
          traceV1={mockV1Trace}
        />
      )

      const traceFooter = screen.getByTestId('trace-footer')
      expect(traceFooter).toBeInTheDocument()

      // Initially collapsed
      expect(screen.queryByText('PLoT Request ID:')).not.toBeInTheDocument()

      // Click to expand
      const expandButton = screen.getByRole('button', { name: /debug trace/i })
      fireEvent.click(expandButton)

      // Now expanded
      expect(screen.getByText('PLoT Request ID:')).toBeInTheDocument()
      expect(screen.getByText('plot-123')).toBeInTheDocument()
      expect(screen.getByText('CEE Latency:')).toBeInTheDocument()
      expect(screen.getByText('150ms')).toBeInTheDocument()
    })

    it('renders V1 error state with retry button', () => {
      const mockError: CeeError = {
        code: 'CEE_TIMEOUT',
        message: 'Request timed out',
        retriable: true,
      }

      const onRetry = vi.fn()

      render(
        <DecisionReviewPanel
          status="error"
          errorV1={mockError}
          traceV1={mockV1Trace}
          onRetry={onRetry}
        />
      )

      expect(screen.getByTestId('decision-review-error')).toBeInTheDocument()
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()

      const retryButton = screen.getByTestId('decision-review-retry')
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)
      expect(onRetry).toHaveBeenCalledOnce()
    })

    it('renders unavailable state when only trace is present', () => {
      render(
        <DecisionReviewPanel
          status="ready"
          traceV1={mockV1Trace}
        />
      )

      expect(screen.getByTestId('decision-review-unavailable')).toBeInTheDocument()
      expect(screen.getByText(/not available for this run/i)).toBeInTheDocument()
      expect(screen.getByTestId('trace-footer')).toBeInTheDocument()
    })

    it('shows ID mismatch warning in trace footer', () => {
      const traceWithMismatch: CeeTrace = {
        ...mockV1Trace,
        cee_returned_request_id: 'different-id',
        id_mismatch: true,
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={mockV1Review}
          traceV1={traceWithMismatch}
        />
      )

      const traceFooter = screen.getByTestId('trace-footer')
      expect(traceFooter).toHaveTextContent('ID mismatch')
    })
  })

  describe('Readiness Header', () => {
    it('renders ready level with success styling', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'ready',
          headline: 'Good to go',
          factors: [],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      const header = screen.getByTestId('readiness-header')
      expect(header).toHaveTextContent('Good to go')
    })

    it('renders caution level with warning styling', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'caution',
          headline: 'Review recommended',
          factors: [
            { label: 'Some data missing', status: 'warning' },
          ],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      const header = screen.getByTestId('readiness-header')
      expect(header).toHaveTextContent('Review recommended')
      expect(header).toHaveTextContent('Some data missing')
    })

    it('renders not_ready level with error styling', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'not_ready',
          headline: 'Cannot proceed',
          factors: [
            { label: 'Critical data missing', status: 'blocking' },
          ],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      const header = screen.getByTestId('readiness-header')
      expect(header).toHaveTextContent('Cannot proceed')
      expect(header).toHaveTextContent('Critical data missing')
    })
  })

  describe('Analysis State Indicator', () => {
    it('shows stale indicator when analysis_state is stale', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'stale',
        readiness: {
          level: 'ready',
          headline: 'Ready',
          factors: [],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      expect(screen.getByTestId('analysis-state-indicator')).toHaveTextContent('outdated')
    })

    it('shows partial indicator when analysis_state is partial', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'partial',
        readiness: {
          level: 'ready',
          headline: 'Ready',
          factors: [],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      expect(screen.getByTestId('analysis-state-indicator')).toHaveTextContent('Partial')
    })

    it('does not show indicator when analysis_state is ran', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'ready',
          headline: 'Ready',
          factors: [],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      expect(screen.queryByTestId('analysis-state-indicator')).not.toBeInTheDocument()
    })
  })

  describe('Block rendering', () => {
    it('renders cannot_compute blocks with unavailable badge and reason', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'ready',
          headline: 'Ready',
          factors: [],
        },
        blocks: [
          {
            id: 'recommendation',
            status: 'cannot_compute',
            status_reason: 'Insufficient data for recommendation',
            source: 'cee',
            summary: 'Cannot compute',
            priority: 1,
          },
        ],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      // cannot_compute blocks should render with "unavailable" badge
      const block = screen.getByTestId('review-block-recommendation')
      expect(block).toBeInTheDocument()
      expect(block).toHaveTextContent('unavailable')
      expect(block).toHaveTextContent('Insufficient data for recommendation')
    })

    it('does not render blocks with status not_applicable', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'ready',
          headline: 'Ready',
          factors: [],
        },
        blocks: [
          {
            id: 'recommendation',
            status: 'not_applicable',
            source: 'cee',
            summary: 'Not applicable',
            priority: 1,
          },
        ],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      // not_applicable blocks should NOT render (truly irrelevant)
      expect(screen.queryByTestId('review-block-recommendation')).not.toBeInTheDocument()
    })

    it('shows low_discrimination badge on blocks', () => {
      const review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'caution',
          headline: 'Review needed',
          factors: [],
        },
        blocks: [
          {
            id: 'recommendation',
            status: 'low_discrimination',
            status_reason: 'Options are very close',
            source: 'engine',
            summary: 'Results are similar',
            priority: 1,
          },
        ],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          reviewV1={review}
        />
      )

      const block = screen.getByTestId('review-block-recommendation')
      expect(block).toHaveTextContent('low discrimination')
      expect(block).toHaveTextContent('Options are very close')
    })
  })

  describe('Hidden state', () => {
    it('renders nothing when all data is nullish', () => {
      const { container } = render(
        <DecisionReviewPanel status="ready" />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('V1 takes precedence over legacy', () => {
    it('uses V1 data when both V1 and legacy are provided', () => {
      const legacyReview: CeeDecisionReviewPayload = {
        story: { headline: 'Legacy Headline' },
      }

      const v1Review: CeeDecisionReviewPayloadV1 = {
        intent: 'selection',
        analysis_state: 'ran',
        readiness: {
          level: 'ready',
          headline: 'V1 Headline',
          factors: [],
        },
        blocks: [],
      }

      render(
        <DecisionReviewPanel
          status="ready"
          review={legacyReview}
          reviewV1={v1Review}
        />
      )

      // Should show V1 headline, not legacy
      expect(screen.getByTestId('readiness-header')).toHaveTextContent('V1 Headline')
      expect(screen.queryByText('Legacy Headline')).not.toBeInTheDocument()
    })
  })
})
