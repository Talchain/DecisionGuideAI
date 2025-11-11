/**
 * StatusChips component tests (Priority 1C)
 *
 * Tests:
 * - Live state: renders nodes/edges/p95 chips with correct values
 * - Fallback state: yellow "Fallback" chip with tooltip and retry
 * - Error state: red "Limits Unavailable" chip with retry
 * - Loading state: renders nothing
 * - Color coding: gray/warning/danger based on usage %
 * - Tooltips: show source + timestamp
 * - Retry clicks: calls retry() function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusChips } from '../StatusChips'
import * as useEngineLimitsModule from '../../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../../hooks/useEngineLimits'

// Mock the useEngineLimits hook
vi.mock('../../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseEngineLimits = vi.mocked(useEngineLimitsModule.useEngineLimits)

const createMockReturn = (overrides?: Partial<UseEngineLimitsReturn>): UseEngineLimitsReturn => ({
  limits: {
    nodes: { max: 200 },
    edges: { max: 500 },
    engine_p95_ms_budget: 30000,
  },
  source: 'live',
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  retry: vi.fn(),
  ...overrides,
})

describe('StatusChips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Live state (normal operation)', () => {
    it('renders nodes and edges chips with live data', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      render(<StatusChips currentNodes={50} currentEdges={100} />)

      expect(screen.getByText('50 / 200')).toBeInTheDocument()
      expect(screen.getByText('100 / 500')).toBeInTheDocument()
    })

    it('renders p95 budget chip when available', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      render(<StatusChips />)

      expect(screen.getByText('30000ms')).toBeInTheDocument()
    })

    it('does not render p95 budget chip when undefined', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          limits: {
            nodes: { max: 200 },
            edges: { max: 500 },
            // engine_p95_ms_budget undefined
          },
        })
      )

      render(<StatusChips />)

      expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
    })

    it('does NOT render fallback indicator in live mode', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn({ source: 'live' }))

      render(<StatusChips />)

      expect(screen.queryByText('Fallback')).not.toBeInTheDocument()
    })

    it('includes source and timestamp in tooltip', () => {
      const fetchedAt = Date.now()
      mockUseEngineLimits.mockReturnValue(createMockReturn({ fetchedAt }))

      const { container } = render(<StatusChips currentNodes={50} currentEdges={100} />)

      // Find nodes chip
      const nodesChip = container.querySelector('[title*="50 / 200 nodes"]')
      expect(nodesChip).toBeInTheDocument()
      expect(nodesChip?.getAttribute('title')).toContain('Source: live')
      expect(nodesChip?.getAttribute('title')).toContain('Last fetched:')
    })
  })

  describe('Fallback state', () => {
    it('renders yellow Fallback chip when source is "fallback"', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn({ source: 'fallback' }))

      render(<StatusChips />)

      const fallbackChip = screen.getByText('Fallback')
      expect(fallbackChip).toBeInTheDocument()
      expect(fallbackChip.closest('div')).toHaveClass('text-warning-700')
    })

    it('shows fallback tooltip with timestamp', () => {
      const fetchedAt = Date.now()
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          source: 'fallback',
          fetchedAt,
        })
      )

      const { container } = render(<StatusChips />)

      const fallbackChip = container.querySelector('[title*="Using fallback limits"]')
      expect(fallbackChip).toBeInTheDocument()
      expect(fallbackChip?.getAttribute('title')).toContain('Last fetched:')
      expect(fallbackChip?.getAttribute('title')).toContain('Click to retry')
    })

    it('calls retry() when fallback chip clicked', () => {
      const retry = vi.fn()
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          source: 'fallback',
          retry,
        })
      )

      render(<StatusChips />)

      const fallbackChip = screen.getByText('Fallback')
      fireEvent.click(fallbackChip)

      expect(retry).toHaveBeenCalledTimes(1)
    })

    it('calls retry() when Enter key pressed on fallback chip', () => {
      const retry = vi.fn()
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          source: 'fallback',
          retry,
        })
      )

      render(<StatusChips />)

      const fallbackChip = screen.getByText('Fallback').closest('div')
      fireEvent.keyDown(fallbackChip!, { key: 'Enter' })

      expect(retry).toHaveBeenCalledTimes(1)
    })

    it('calls retry() when Space key pressed on fallback chip', () => {
      const retry = vi.fn()
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          source: 'fallback',
          retry,
        })
      )

      render(<StatusChips />)

      const fallbackChip = screen.getByText('Fallback').closest('div')
      fireEvent.keyDown(fallbackChip!, { key: ' ' })

      expect(retry).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error state', () => {
    it('renders red "Limits Unavailable" button when error exists', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          error: new Error('Network failure'),
          limits: null,
          source: null,
        })
      )

      render(<StatusChips />)

      const errorButton = screen.getByText('Limits Unavailable')
      expect(errorButton).toBeInTheDocument()
      expect(errorButton.closest('button')).toHaveClass('text-danger-700')
    })

    it('shows error message in tooltip', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          error: new Error('Connection timeout'),
          limits: null,
          source: null,
        })
      )

      render(<StatusChips />)

      const errorButton = screen.getByText('Limits Unavailable')
      expect(errorButton.closest('button')?.getAttribute('title')).toContain('Connection timeout')
      expect(errorButton.closest('button')?.getAttribute('title')).toContain('Click to retry')
    })

    it('calls retry() when error button clicked', () => {
      const retry = vi.fn()
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          error: new Error('Network failure'),
          limits: null,
          source: null,
          retry,
        })
      )

      render(<StatusChips />)

      const errorButton = screen.getByText('Limits Unavailable')
      fireEvent.click(errorButton)

      expect(retry).toHaveBeenCalledTimes(1)
    })

    it('does NOT render normal chips when error exists', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          error: new Error('Network failure'),
          limits: null,
          source: null,
        })
      )

      render(<StatusChips currentNodes={50} currentEdges={100} />)

      expect(screen.queryByText(/\/ 200/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument()
    })

    it('has role="alert" and aria-label for accessibility', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          error: new Error('Network failure'),
          limits: null,
          source: null,
        })
      )

      const { container } = render(<StatusChips />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toBeInTheDocument()
      expect(alert?.getAttribute('aria-label')).toBe('Limits unavailable')
    })
  })

  describe('Loading state', () => {
    it('renders nothing when loading=true', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          loading: true,
          limits: null,
        })
      )

      const { container } = render(<StatusChips />)

      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when limits is null (not loaded yet)', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          loading: false,
          limits: null,
          error: null,
        })
      )

      const { container } = render(<StatusChips />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Usage color coding', () => {
    it('shows gray color when usage < 70%', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      const { container } = render(<StatusChips currentNodes={50} currentEdges={100} />)

      // 50/200 = 25%, 100/500 = 20% → both gray
      const chips = container.querySelectorAll('.text-gray-700')
      expect(chips.length).toBeGreaterThanOrEqual(2)
    })

    it('shows warning color when usage >= 70% and < 90%', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      const { container } = render(<StatusChips currentNodes={150} currentEdges={380} />)

      // 150/200 = 75%, 380/500 = 76% → both warning
      const chips = container.querySelectorAll('.text-warning-700')
      expect(chips.length).toBeGreaterThanOrEqual(2)
    })

    it('shows danger color when usage >= 90%', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      const { container } = render(<StatusChips currentNodes={190} currentEdges={480} />)

      // 190/200 = 95%, 480/500 = 96% → both danger
      const chips = container.querySelectorAll('.text-danger-700')
      expect(chips.length).toBeGreaterThanOrEqual(2)
    })

    it('shows mixed colors based on individual usage', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      const { container } = render(<StatusChips currentNodes={50} currentEdges={480} />)

      // 50/200 = 25% (gray), 480/500 = 96% (danger)
      expect(container.querySelectorAll('.text-gray-700').length).toBeGreaterThanOrEqual(1)
      expect(container.querySelectorAll('.text-danger-700').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Timestamp formatting', () => {
    it('formats timestamp as locale time', () => {
      const fetchedAt = new Date('2025-11-07T18:30:00').getTime()
      mockUseEngineLimits.mockReturnValue(createMockReturn({ fetchedAt }))

      const { container } = render(<StatusChips />)

      const chip = container.querySelector('[title*="Last fetched:"]')
      const titleAttr = chip?.getAttribute('title')

      // Should contain time (exact format varies by locale)
      expect(titleAttr).toContain('Last fetched:')
      expect(titleAttr).toMatch(/\d+:\d+/) // HH:MM format
    })

    it('shows "Unknown" when fetchedAt is null', () => {
      mockUseEngineLimits.mockReturnValue(
        createMockReturn({
          fetchedAt: null,
        })
      )

      const { container } = render(<StatusChips />)

      const chip = container.querySelector('[title*="nodes"]')
      expect(chip?.getAttribute('title')).toContain('Unknown')
    })
  })

  describe('Accessibility', () => {
    it('has role="status" for normal state', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      const { container } = render(<StatusChips />)

      const statusContainer = container.querySelector('[role="status"]')
      expect(statusContainer).toBeInTheDocument()
      expect(statusContainer?.getAttribute('aria-label')).toBe('Engine limits and budget')
    })

    it('icons have aria-hidden="true"', () => {
      mockUseEngineLimits.mockReturnValue(createMockReturn())

      const { container } = render(<StatusChips />)

      const icons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })
})
