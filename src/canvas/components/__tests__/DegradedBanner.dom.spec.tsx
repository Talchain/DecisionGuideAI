/**
 * S8: DegradedBanner DOM tests
 *
 * Visibility-only tests for the degraded-mode banner stub.
 *
 * - status: 'degraded' → banner visible with degraded copy
 * - status: 'down'     → banner visible with down copy
 * - status: 'ok' or error → banner not rendered
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../lib/health', () => ({
  fetchHealth: vi.fn(),
}))

import { DegradedBanner } from '../DegradedBanner'
import { fetchHealth } from '../../../lib/health'

const mockFetchHealth = vi.mocked(fetchHealth)

describe('DegradedBanner (S8 degraded stub)', () => {
  beforeEach(() => {
    // Ensure window.fetch exists so the effect runs
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: window.fetch || vi.fn(),
    })
    mockFetchHealth.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows banner when health status is degraded', async () => {
    mockFetchHealth.mockResolvedValueOnce({ status: 'degraded', p95_ms: 123 })

    render(<DegradedBanner />)

    // Heading text for degraded mode
    const heading = await screen.findByText('Engine running in degraded mode; performance reduced.')
    expect(heading).toBeInTheDocument()

    // Body copy should also be present
    expect(
      await screen.findByText('Some runs may be slower or limited while the engine is in degraded mode.'),
    ).toBeInTheDocument()
  })

  it('shows banner when health status is down', async () => {
    mockFetchHealth.mockResolvedValueOnce({ status: 'down', p95_ms: 123 })

    render(<DegradedBanner />)

    const heading = await screen.findByText('Engine currently unavailable; try again shortly.')
    expect(heading).toBeInTheDocument()
  })

  it('does not render banner when health status is ok', () => {
    mockFetchHealth.mockResolvedValueOnce({ status: 'ok', p95_ms: 123 })

    render(<DegradedBanner />)

    expect(screen.queryByText('Engine currently unavailable; try again shortly.')).not.toBeInTheDocument()
    expect(screen.queryByText('Engine running in degraded mode; performance reduced.')).not.toBeInTheDocument()
  })

  it('does not render banner when fetchHealth rejects', async () => {
    mockFetchHealth.mockRejectedValueOnce(new Error('network error'))

    render(<DegradedBanner />)

    await waitFor(() => {
      expect(screen.queryByText('Engine currently unavailable; try again shortly.')).not.toBeInTheDocument()
      expect(screen.queryByText('Engine running in degraded mode; performance reduced.')).not.toBeInTheDocument()
    })
  })
})
