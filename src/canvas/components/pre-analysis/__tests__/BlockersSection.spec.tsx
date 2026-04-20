/**
 * BlockersSection tests — card styling, retryable flag, edit brief action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockersSection } from '../BlockersSection'
import type { EnrichedBlocker } from '../blockerEnrichment'
import type { ValidationBlocker } from '@talchain/schemas'

function makeBlocker(
  code: string,
  severity: 'critical' | 'warning' = 'warning',
  supportsRetry = false,
): EnrichedBlocker {
  return {
    blocker: { code, message: `${code} message` } as ValidationBlocker,
    display: {
      title: `${code} title`,
      description: `${code} description`,
      severity,
      supportsRetry,
    },
    sortOrder: 10,
  }
}

describe('BlockersSection', () => {
  const mockRetry = vi.fn()
  const mockEditBrief = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Fix 1: Card styling ──────────────────────────────────────────

  describe('Card styling (full semantic border)', () => {
    it('renders critical blocker with left danger border and neutral bg', () => {
      const blockers = [makeBlocker('MISSING_GOAL_NODE', 'critical')]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      const card = screen.getByTestId('blocker-card-MISSING_GOAL_NODE')
      expect(card.className).toContain('bg-panel')
      expect(card.className).toContain('border-danger/30')
      expect(card.className).not.toContain('bg-danger-light')
      expect(card.className).not.toContain('bg-warning-light')
    })

    it('renders warning blocker with left warning border and neutral bg', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      const card = screen.getByTestId('blocker-card-ANALYSIS_NOT_READY')
      expect(card.className).toContain('bg-panel')
      expect(card.className).toContain('border-warning/30')
      expect(card.className).not.toContain('bg-danger-light')
      expect(card.className).not.toContain('bg-warning-light')
    })

    it('does not use filled/tinted backgrounds on any card', () => {
      const blockers = [
        makeBlocker('MISSING_GOAL_NODE', 'critical'),
        makeBlocker('ANALYSIS_NOT_READY', 'warning', true),
      ]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      const cards = screen.getAllByTestId(/^blocker-card-/)
      for (const card of cards) {
        expect(card.className).not.toContain('bg-danger-light')
        expect(card.className).not.toContain('bg-warning-light')
      }
    })
  })

  // ── Fix 2: Retryable flag / Edit brief ───────────────────────────

  describe('Retry vs Edit brief', () => {
    it('shows "Retry Draft" button when retryable is not false', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.getByTestId('blocker-retry-ANALYSIS_NOT_READY')).toBeInTheDocument()
      expect(screen.queryByTestId('blocker-edit-brief-ANALYSIS_NOT_READY')).not.toBeInTheDocument()
    })

    it('shows "Edit brief" button when lastDraftRetryable is false', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          lastDraftRetryable={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.getByTestId('blocker-edit-brief-ANALYSIS_NOT_READY')).toBeInTheDocument()
      expect(screen.queryByTestId('blocker-retry-ANALYSIS_NOT_READY')).not.toBeInTheDocument()
    })

    it('shows helper text when lastDraftRetryable is false', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          lastDraftRetryable={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.getByText(/Try rephrasing your decision brief/)).toBeInTheDocument()
    })

    it('does not show helper text when retryable is true', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          lastDraftRetryable={true}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.queryByText(/Try rephrasing your decision brief/)).not.toBeInTheDocument()
    })

    it('calls onEditBrief when "Edit brief" button is clicked', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          lastDraftRetryable={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      fireEvent.click(screen.getByTestId('blocker-edit-brief-ANALYSIS_NOT_READY'))
      expect(mockEditBrief).toHaveBeenCalledTimes(1)
      expect(mockRetry).not.toHaveBeenCalled()
    })

    it('calls onRetryDraft when "Retry Draft" button is clicked', () => {
      const blockers = [makeBlocker('ANALYSIS_NOT_READY', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      fireEvent.click(screen.getByTestId('blocker-retry-ANALYSIS_NOT_READY'))
      expect(mockRetry).toHaveBeenCalledTimes(1)
      expect(mockEditBrief).not.toHaveBeenCalled()
    })

    it('shows "Retry Draft" when lastDraftRetryable is undefined (default)', () => {
      const blockers = [makeBlocker('EMPTY_INTERVENTIONS', 'warning', true)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          lastDraftRetryable={undefined}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.getByTestId('blocker-retry-EMPTY_INTERVENTIONS')).toBeInTheDocument()
      expect(screen.queryByTestId('blocker-edit-brief-EMPTY_INTERVENTIONS')).not.toBeInTheDocument()
    })

    it('does not show retry or edit brief for non-retry blockers', () => {
      const blockers = [makeBlocker('NO_OPTIONS', 'critical', false)]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={true}
          isRetrying={false}
          lastDraftRetryable={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.queryByTestId('blocker-retry-NO_OPTIONS')).not.toBeInTheDocument()
      expect(screen.queryByTestId('blocker-edit-brief-NO_OPTIONS')).not.toBeInTheDocument()
    })
  })

  // ── Brief 5.3 close-out: class token regression (P0 fix) ─────────
  // The P0 bug produced "py-2.5border-danger/30" (missing space between
  // padding and border class). Guard by asserting each class token is
  // discrete — no token should contain two class names merged together.

  describe('Card class token regression (Brief 5.3 P0)', () => {
    it('critical blocker card: py-2.5 and border-danger/30 are discrete tokens', () => {
      render(
        <BlockersSection
          blockers={[makeBlocker('MISSING_GOAL_NODE', 'critical')]}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )
      const card = screen.getByTestId('blocker-card-MISSING_GOAL_NODE')
      const tokens = card.className.split(/\s+/)
      expect(tokens).toContain('py-2.5')
      expect(tokens).toContain('border-danger/30')
      // No token should look like two classes jammed together (e.g. "py-2.5border-...")
      for (const tok of tokens) {
        expect(tok).not.toMatch(/py-2\.5[a-z]/)
      }
    })

    it('warning blocker card: py-2.5 and border-warning/30 are discrete tokens', () => {
      render(
        <BlockersSection
          blockers={[makeBlocker('ANALYSIS_NOT_READY', 'warning')]}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )
      const card = screen.getByTestId('blocker-card-ANALYSIS_NOT_READY')
      const tokens = card.className.split(/\s+/)
      expect(tokens).toContain('py-2.5')
      expect(tokens).toContain('border-warning/30')
      for (const tok of tokens) {
        expect(tok).not.toMatch(/py-2\.5[a-z]/)
      }
    })
  })

  // ── Rendering basics ─────────────────────────────────────────────

  describe('Rendering', () => {
    it('returns null when blockers array is empty', () => {
      const { container } = render(
        <BlockersSection
          blockers={[]}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )
      expect(container.innerHTML).toBe('')
    })

    it('shows correct count badge', () => {
      const blockers = [
        makeBlocker('A', 'critical'),
        makeBlocker('B', 'warning'),
        makeBlocker('C', 'warning'),
      ]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders title and description from enrichment', () => {
      const blockers = [makeBlocker('MISSING_GOAL_NODE', 'critical')]
      render(
        <BlockersSection
          blockers={blockers}
          canRetryDraft={false}
          isRetrying={false}
          onRetryDraft={mockRetry}
          onEditBrief={mockEditBrief}
        />,
      )

      expect(screen.getByText('MISSING_GOAL_NODE title')).toBeInTheDocument()
      expect(screen.getByText('MISSING_GOAL_NODE description')).toBeInTheDocument()
    })
  })
})
