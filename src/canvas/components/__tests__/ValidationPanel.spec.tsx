/**
 * ValidationPanel DOM tests
 *
 * Tests for the critique display panel with auto-fix functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ValidationPanel, type CritiqueItem } from '../ValidationPanel'

describe('ValidationPanel', () => {

  describe('rendering', () => {
    it('renders nothing when critique list is empty', () => {
      const { container } = render(<ValidationPanel critique={[]} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders blocker section with critical issues', () => {
      const critique: CritiqueItem[] = [
        { level: 'blocker', message: 'Cycle detected in graph', code: 'CYCLE' },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.getByText('Critical Issues')).toBeInTheDocument()
      expect(screen.getByText('Cycle detected in graph')).toBeInTheDocument()
    })

    it('renders warning section with recommended fixes', () => {
      const critique: CritiqueItem[] = [
        { level: 'warning', message: 'Missing evidence on edge', code: 'NO_EVIDENCE' },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.getByText('Warnings')).toBeInTheDocument()
      expect(screen.getByText('Missing evidence on edge')).toBeInTheDocument()
    })

    it('renders info section', () => {
      const critique: CritiqueItem[] = [
        { level: 'info', message: 'Consider adding more factors', code: 'SUGGESTION' },
      ]

      render(<ValidationPanel critique={critique} />)

      // Info section starts collapsed by default, click to expand
      fireEvent.click(screen.getByText('Information'))
      expect(screen.getByText('Consider adding more factors')).toBeInTheDocument()
    })

    it('shows suggested fix text when provided', () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          suggested_fix: 'Normalize probabilities to sum to 100%',
        },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.getByText('Normalize probabilities to sum to 100%')).toBeInTheDocument()
    })
  })

  describe('auto-fix button', () => {
    it('shows "Fix automatically" button when item is auto_fixable and onAutoFix is provided', () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      const mockAutoFix = vi.fn().mockResolvedValue(true)
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Fix automatically')
    })

    it('does NOT show auto-fix button when auto_fixable is false', () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Some non-fixable issue',
          code: 'UNKNOWN_ISSUE',
          auto_fixable: false,
        },
      ]

      const mockAutoFix = vi.fn().mockResolvedValue(true)
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      expect(screen.queryByTestId('auto-fix-btn-UNKNOWN_ISSUE')).not.toBeInTheDocument()
    })

    it('does NOT show auto-fix button when onAutoFix is not provided', () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.queryByTestId('auto-fix-btn-PROBABILITY_SUM')).not.toBeInTheDocument()
    })

    it('calls onAutoFix when button is clicked', async () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      const mockAutoFix = vi.fn().mockResolvedValue(true)
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')
      await act(async () => {
        fireEvent.click(button)
      })

      expect(mockAutoFix).toHaveBeenCalledWith(critique[0])
    })

    it('shows "Fixing..." state with spinner while fix is in progress', async () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      // Create a promise that we control
      let resolveAutoFix!: (value: boolean) => void
      const mockAutoFix = vi.fn().mockImplementation(() => {
        return new Promise<boolean>(resolve => {
          resolveAutoFix = resolve
        })
      })

      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')

      // Click in act() but don't await the full resolution
      act(() => {
        fireEvent.click(button)
      })

      // Check fixing state immediately
      expect(button).toHaveTextContent('Fixing...')
      expect(button).toHaveAttribute('aria-busy', 'true')

      // Complete the fix
      await act(async () => {
        resolveAutoFix(true)
      })
    })

    it('shows "Fixed!" success state after successful fix', async () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      const mockAutoFix = vi.fn().mockResolvedValue(true)
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')

      await act(async () => {
        fireEvent.click(button)
        // Allow promise to resolve
        await Promise.resolve()
      })

      expect(button).toHaveTextContent('Fixed!')
    })

    it('shows "Retry fix" state after failed fix', async () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      const mockAutoFix = vi.fn().mockResolvedValue(false)
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')

      await act(async () => {
        fireEvent.click(button)
        await Promise.resolve()
      })

      expect(button).toHaveTextContent('Retry fix')
      // Error message should appear
      expect(screen.getByText(/Fix failed/)).toBeInTheDocument()
    })

    it('shows "Retry fix" state when onAutoFix throws an error', async () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      const mockAutoFix = vi.fn().mockRejectedValue(new Error('Network error'))
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')

      await act(async () => {
        fireEvent.click(button)
        // Allow rejection to be caught
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(button).toHaveTextContent('Retry fix')
    })

    it('disables auto-fix button while fixing', async () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      let resolveAutoFix!: (value: boolean) => void
      const mockAutoFix = vi.fn().mockImplementation(() => {
        return new Promise<boolean>(resolve => {
          resolveAutoFix = resolve
        })
      })

      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')

      act(() => {
        fireEvent.click(button)
      })

      // Check disabled state immediately
      expect(button).toBeDisabled()

      // Complete the fix
      await act(async () => {
        resolveAutoFix(true)
      })
    })

    it('auto-dismisses the item after 1.5s on successful fix', async () => {
      vi.useFakeTimers()

      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Probabilities do not sum to 100%',
          code: 'PROBABILITY_SUM',
          auto_fixable: true,
        },
      ]

      const mockAutoFix = vi.fn().mockResolvedValue(true)
      render(<ValidationPanel critique={critique} onAutoFix={mockAutoFix} />)

      const button = screen.getByTestId('auto-fix-btn-PROBABILITY_SUM')

      // Click and resolve
      await act(async () => {
        fireEvent.click(button)
        await Promise.resolve()
      })

      // Wait for success state
      expect(button).toHaveTextContent('Fixed!')

      // The item should still be visible
      expect(screen.getByText('Probabilities do not sum to 100%')).toBeInTheDocument()

      // Advance time by 1.5 seconds
      await act(async () => {
        vi.advanceTimersByTime(1500)
      })

      // Item should now be dismissed
      expect(screen.queryByText('Probabilities do not sum to 100%')).not.toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  describe('dismiss button', () => {
    it('shows dismiss button for warnings (not blockers)', () => {
      const critique: CritiqueItem[] = [
        { level: 'warning', message: 'Orphan node detected', code: 'ORPHAN' },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.getByText('Dismiss')).toBeInTheDocument()
    })

    it('does NOT show dismiss button for blockers', () => {
      const critique: CritiqueItem[] = [
        { level: 'blocker', message: 'Critical error', code: 'CRITICAL' },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()
    })

    it('removes item when dismiss is clicked', () => {
      const critique: CritiqueItem[] = [
        { level: 'warning', message: 'Orphan node detected', code: 'ORPHAN' },
      ]

      render(<ValidationPanel critique={critique} />)

      fireEvent.click(screen.getByText('Dismiss'))

      expect(screen.queryByText('Orphan node detected')).not.toBeInTheDocument()
    })

    it('calls onDismiss callback when provided', () => {
      const critique: CritiqueItem[] = [
        { level: 'warning', message: 'Orphan node detected', code: 'ORPHAN' },
      ]

      const mockDismiss = vi.fn()
      render(<ValidationPanel critique={critique} onDismiss={mockDismiss} />)

      fireEvent.click(screen.getByText('Dismiss'))

      expect(mockDismiss).toHaveBeenCalledWith(critique[0])
    })
  })

  describe('collapsible sections', () => {
    it('expands blocker section by default when blockers exist', () => {
      const critique: CritiqueItem[] = [
        { level: 'blocker', message: 'Critical error', code: 'CRITICAL' },
      ]

      render(<ValidationPanel critique={critique} />)

      // Content should be visible without clicking
      expect(screen.getByText('Critical error')).toBeInTheDocument()
    })

    it('collapses section when header is clicked', () => {
      const critique: CritiqueItem[] = [
        { level: 'blocker', message: 'Critical error', code: 'CRITICAL' },
      ]

      render(<ValidationPanel critique={critique} />)

      // Click header to collapse
      fireEvent.click(screen.getByText('Critical Issues'))

      // Content should be hidden
      expect(screen.queryByText('Critical error')).not.toBeInTheDocument()
    })

    it('expands section when header is clicked again', () => {
      const critique: CritiqueItem[] = [
        { level: 'blocker', message: 'Critical error', code: 'CRITICAL' },
      ]

      render(<ValidationPanel critique={critique} />)

      // Collapse and then expand
      fireEvent.click(screen.getByText('Critical Issues'))
      fireEvent.click(screen.getByText('Critical Issues'))

      // Content should be visible again
      expect(screen.getByText('Critical error')).toBeInTheDocument()
    })
  })

  describe('node/edge references', () => {
    it('shows "View on canvas" link when node_id is provided', () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Node has invalid state',
          code: 'INVALID_NODE',
          node_id: 'node-123',
        },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.getByText('View on canvas')).toBeInTheDocument()
    })

    it('shows "View on canvas" link when edge_id is provided', () => {
      const critique: CritiqueItem[] = [
        {
          level: 'blocker',
          message: 'Edge has invalid weight',
          code: 'INVALID_EDGE',
          edge_id: 'edge-456',
        },
      ]

      render(<ValidationPanel critique={critique} />)

      expect(screen.getByText('View on canvas')).toBeInTheDocument()
    })
  })
})
