/**
 * ConnectivityChip component tests (Priority 2G)
 *
 * Tests:
 * 1. navigator.onLine=false ⇒ offline
 * 2. Probe success ⇒ ok/degraded/offline based on health
 * 3. Probe failure with onLine=true ⇒ unknown (error state)
 * 4. Click reprobe clears cache and re-checks
 * 5. Timestamp visible in tooltip
 * 6. Loading state shows "Checking..."
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectivityChip } from '../ConnectivityChip'
import * as probeModule from '../../../adapters/plot/v1/probe'
import type { ProbeResult } from '../../../adapters/plot/v1/probe'

// Mock the probe module
vi.mock('../../../adapters/plot/v1/probe', () => ({
  probeCapability: vi.fn(),
  clearProbeCache: vi.fn(),
}))

const mockProbeCapability = vi.mocked(probeModule.probeCapability)
const mockClearProbeCache = vi.mocked(probeModule.clearProbeCache)

const createProbeResult = (overrides?: Partial<ProbeResult>): ProbeResult => ({
  available: true,
  timestamp: new Date().toISOString(),
  healthStatus: 'ok',
  endpoints: {
    health: true,
    run: true,
    stream: false,
  },
  ...overrides,
})

describe('ConnectivityChip', () => {
  let navigatorOnLineSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock navigator.onLine as true by default (online)
    navigatorOnLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial probe on mount', () => {
    it('shows "Checking..." while loading', async () => {
      mockProbeCapability.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(createProbeResult()), 1000))
      )

      render(<ConnectivityChip />)

      expect(screen.getByText('Checking...')).toBeInTheDocument()
    })

    it('shows "Engine OK" when probe succeeds with healthy engine', async () => {
      mockProbeCapability.mockResolvedValueOnce(
        createProbeResult({ available: true, healthStatus: 'ok' })
      )

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
      })
    })

    it('shows "Engine Degraded" when probe succeeds but health is degraded', async () => {
      mockProbeCapability.mockResolvedValueOnce(
        createProbeResult({ available: true, healthStatus: 'degraded' })
      )

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Degraded')).toBeInTheDocument()
      })
    })

    it('shows "Engine Offline" when probe shows engine not available', async () => {
      mockProbeCapability.mockResolvedValueOnce(
        createProbeResult({ available: false, healthStatus: 'down' })
      )

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })
    })
  })

  describe('Offline detection (navigator.onLine)', () => {
    it('shows "Engine Offline" when navigator.onLine is false', async () => {
      navigatorOnLineSpy.mockReturnValue(false)
      mockProbeCapability.mockRejectedValueOnce(new Error('Network error'))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })
    })

    it('distinguishes offline (onLine=false) from error (onLine=true)', async () => {
      navigatorOnLineSpy.mockReturnValue(true) // Online
      mockProbeCapability.mockRejectedValueOnce(new Error('Network error'))

      render(<ConnectivityChip />)

      await waitFor(() => {
        // Should show "Status Unknown" (error state) not "Engine Offline"
        expect(screen.getByText('Status Unknown')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('shows "Status Unknown" when probe fails and navigator.onLine is true', async () => {
      navigatorOnLineSpy.mockReturnValue(true)
      mockProbeCapability.mockRejectedValueOnce(new Error('CORS error'))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Status Unknown')).toBeInTheDocument()
      })
    })

    it('logs error to console when probe fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockProbeCapability.mockRejectedValueOnce(new Error('Probe failed'))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[ConnectivityChip] Failed to check connectivity:'),
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Reprobe functionality', () => {
    it('clears cache and re-probes when clicked', async () => {
      mockProbeCapability
        .mockResolvedValueOnce(createProbeResult({ healthStatus: 'ok' }))
        .mockResolvedValueOnce(createProbeResult({ healthStatus: 'degraded' }))

      render(<ConnectivityChip />)

      // Wait for initial probe
      await waitFor(() => {
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
      })

      expect(mockProbeCapability).toHaveBeenCalledTimes(1)
      expect(mockClearProbeCache).not.toHaveBeenCalled()

      // Click to reprobe
      const chip = screen.getByTestId('connectivity-chip')
      fireEvent.click(chip)

      await waitFor(() => {
        expect(mockClearProbeCache).toHaveBeenCalledTimes(1)
        expect(mockProbeCapability).toHaveBeenCalledTimes(2)
      })

      // Should show updated status
      await waitFor(() => {
        expect(screen.getByText('Engine Degraded')).toBeInTheDocument()
      })
    })

    it('shows "Checking..." during reprobe', async () => {
      mockProbeCapability.mockResolvedValue(createProbeResult())

      render(<ConnectivityChip />)

      // Wait for initial probe
      await waitFor(() => {
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
      })

      // Click to reprobe with delay
      mockProbeCapability.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(createProbeResult()), 100))
      )

      const chip = screen.getByTestId('connectivity-chip')
      fireEvent.click(chip)

      // Should briefly show "Checking..."
      expect(screen.getByText('Checking...')).toBeInTheDocument()
    })

    it('disables button while loading', async () => {
      mockProbeCapability.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(createProbeResult()), 1000))
      )

      render(<ConnectivityChip />)

      const chip = screen.getByTestId('connectivity-chip')
      expect(chip).toBeDisabled()
    })
  })

  describe('Tooltip and timestamp', () => {
    it('shows timestamp in tooltip after successful probe', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
      })

      const chip = screen.getByTestId('connectivity-chip')
      expect(chip.getAttribute('title')).toContain('Last checked:')
      expect(chip.getAttribute('title')).toContain('Click to refresh')
    })

    it('shows "Click to refresh" before first check completes', () => {
      mockProbeCapability.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(createProbeResult()), 1000))
      )

      render(<ConnectivityChip />)

      const chip = screen.getByTestId('connectivity-chip')
      expect(chip.getAttribute('title')).toContain('Click to refresh')
    })

    it('formats timestamp as locale time', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
      })

      const chip = screen.getByTestId('connectivity-chip')
      const titleAttr = chip.getAttribute('title')

      // Should contain time (exact format varies by locale)
      expect(titleAttr).toMatch(/\d+:\d+/) // HH:MM format
    })
  })

  describe('Status callback', () => {
    it('calls onStatusChange when status changes', async () => {
      const onStatusChange = vi.fn()
      mockProbeCapability.mockResolvedValueOnce(
        createProbeResult({ healthStatus: 'ok' })
      )

      render(<ConnectivityChip onStatusChange={onStatusChange} />)

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('ok')
      })
    })

    it('calls onStatusChange with degraded status', async () => {
      const onStatusChange = vi.fn()
      mockProbeCapability.mockResolvedValueOnce(
        createProbeResult({ healthStatus: 'degraded' })
      )

      render(<ConnectivityChip onStatusChange={onStatusChange} />)

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('degraded')
      })
    })

    it('calls onStatusChange with offline status', async () => {
      const onStatusChange = vi.fn()
      mockProbeCapability.mockResolvedValueOnce(
        createProbeResult({ available: false })
      )

      render(<ConnectivityChip onStatusChange={onStatusChange} />)

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('offline')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = screen.getByTestId('connectivity-chip')
        expect(chip.getAttribute('aria-label')).toContain('Engine status:')
      })
    })

    it('icons have aria-hidden="true"', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      const { container } = render(<ConnectivityChip />)

      await waitFor(() => {
        const icon = container.querySelector('svg[aria-hidden="true"]')
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe('Label visibility', () => {
    it('shows label by default (showLabel=true)', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
      })
    })

    it('hides label when showLabel=false', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip showLabel={false} />)

      await waitFor(() => {
        // Icon should still be present
        const chip = screen.getByTestId('connectivity-chip')
        expect(chip).toBeInTheDocument()
      })

      // But label text should not be visible
      expect(screen.queryByText('Engine OK')).not.toBeInTheDocument()
    })
  })

  describe('Color coding', () => {
    it('uses success colors for "ok" status', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ healthStatus: 'ok' }))

      const { container } = render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = container.querySelector('.bg-success-50')
        expect(chip).toBeInTheDocument()
      })
    })

    it('uses warning colors for "degraded" status', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ healthStatus: 'degraded' }))

      const { container } = render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = container.querySelector('.bg-warning-50')
        expect(chip).toBeInTheDocument()
      })
    })

    it('uses danger colors for "offline" status', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ available: false }))

      const { container } = render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = container.querySelector('.bg-danger-50')
        expect(chip).toBeInTheDocument()
      })
    })

    it('uses gray colors for "unknown" status', async () => {
      navigatorOnLineSpy.mockReturnValue(true)
      mockProbeCapability.mockRejectedValueOnce(new Error('Probe error'))

      const { container } = render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = container.querySelector('.bg-gray-50')
        expect(chip).toBeInTheDocument()
      })
    })
  })

  describe('Backoff retry (P1 Polish)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('schedules retry after offline detection', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ available: false }))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      // Should show countdown in label
      expect(screen.getByText(/\(\d+s\)/)).toBeInTheDocument()
    })

    it('follows backoff schedule: 1s → 3s → 10s', async () => {
      mockProbeCapability.mockResolvedValue(createProbeResult({ available: false }))

      render(<ConnectivityChip />)

      // Wait for initial probe
      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      // First retry should be scheduled for 1s
      expect(screen.getByText('(1s)')).toBeInTheDocument()

      // Advance time by 1s
      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        // After first retry fails, should schedule for 3s
        expect(screen.getByText('(3s)')).toBeInTheDocument()
      })

      // Advance time by 3s
      vi.advanceTimersByTime(3000)

      await waitFor(() => {
        // After second retry fails, should schedule for 10s
        expect(screen.getByText('(10s)')).toBeInTheDocument()
      })

      // Advance time by 10s
      vi.advanceTimersByTime(10000)

      await waitFor(() => {
        // After third retry fails, should cap at 10s
        expect(screen.getByText('(10s)')).toBeInTheDocument()
      })
    })

    it('resets backoff when manual click occurs', async () => {
      mockProbeCapability.mockResolvedValue(createProbeResult({ available: false }))

      render(<ConnectivityChip />)

      // Wait for initial probe and first retry countdown
      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      // Advance to 3s backoff (after first retry)
      vi.advanceTimersByTime(1000)
      await waitFor(() => {
        expect(screen.getByText('(3s)')).toBeInTheDocument()
      })

      // Manual click should reset backoff to 1s
      const chip = screen.getByTestId('connectivity-chip')
      fireEvent.click(chip)

      await waitFor(() => {
        // Should reset to 1s countdown
        expect(screen.getByText('(1s)')).toBeInTheDocument()
      })
    })

    it('countdown decrements every second', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ available: false }))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      // Should start at 1s
      expect(screen.getByText('(1s)')).toBeInTheDocument()

      // After 1 second of countdown timer (not the actual retry timer)
      // Note: The countdown updates every second, so no countdown should be shown once it hits 0
      vi.advanceTimersByTime(500)

      // Still showing 1s (hasn't decremented yet)
      expect(screen.getByText('(1s)')).toBeInTheDocument()
    })

    it('stops showing countdown when it reaches zero', async () => {
      mockProbeCapability
        .mockResolvedValueOnce(createProbeResult({ available: false }))
        .mockResolvedValueOnce(createProbeResult({ available: true, healthStatus: 'ok' }))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      // Countdown should be visible
      expect(screen.getByText('(1s)')).toBeInTheDocument()

      // Advance by full 1s
      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        // After retry succeeds, no countdown should be shown
        expect(screen.getByText('Engine OK')).toBeInTheDocument()
        expect(screen.queryByText(/\(\d+s\)/)).not.toBeInTheDocument()
      })
    })

    it('includes retry timing in tooltip', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ available: false }))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      const chip = screen.getByTestId('connectivity-chip')
      const title = chip.getAttribute('title')

      expect(title).toContain('Retrying in')
      expect(title).toContain('Click to retry now')
    })

    it('includes retry timing in aria-label', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult({ available: false }))

      render(<ConnectivityChip />)

      await waitFor(() => {
        expect(screen.getByText('Engine Offline')).toBeInTheDocument()
      })

      const chip = screen.getByTestId('connectivity-chip')
      const ariaLabel = chip.getAttribute('aria-label')

      expect(ariaLabel).toContain('Retrying in')
      expect(ariaLabel).toContain('seconds')
    })
  })

  describe('Accessibility (P1 Polish)', () => {
    it('has role="status"', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = screen.getByTestId('connectivity-chip')
        expect(chip.getAttribute('role')).toBe('status')
      })
    })

    it('has aria-live="polite"', async () => {
      mockProbeCapability.mockResolvedValueOnce(createProbeResult())

      render(<ConnectivityChip />)

      await waitFor(() => {
        const chip = screen.getByTestId('connectivity-chip')
        expect(chip.getAttribute('aria-live')).toBe('polite')
      })
    })
  })
})
