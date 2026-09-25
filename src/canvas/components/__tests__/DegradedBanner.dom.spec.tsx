/**
 * S8: DegradedBanner DOM tests
 *
 * Visibility-only tests for the degraded-mode banner stub.
 *
 * - status: 'degraded'     → banner visible with degraded copy
 * - status: 'down'         → banner visible with down copy
 * - status: 'unreachable'  → banner visible with "could not reach" copy (A16)
 * - status: 'ok'           → banner not rendered
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

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

  // A16 AUDIT — a rejected fetch used to read as `setHealth(null)`, so the
  // banner said nothing at all: the reader had no idea the engine's health
  // could not even be checked. It now shows the honest, distinct copy for a
  // fetch that never got an answer — never the "degraded" sentence, which
  // claims the engine DID answer and said it was degraded.
  it('shows "could not reach" copy when fetchHealth rejects — never silence, never "degraded"', async () => {
    mockFetchHealth.mockRejectedValueOnce(new Error('network error'))

    render(<DegradedBanner />)

    const heading = await screen.findByText('Could not reach the analysis engine.')
    expect(heading).toBeInTheDocument()
    expect(screen.queryByText('Engine currently unavailable; try again shortly.')).not.toBeInTheDocument()
    expect(screen.queryByText('Engine running in degraded mode; performance reduced.')).not.toBeInTheDocument()
  })

  // The producer-real path: `fetchHealth` itself never throws (its own catch
  // returns `{status:'unreachable'}`), so this is what the banner actually
  // sees in production on a network failure.
  it('shows "could not reach" copy when fetchHealth resolves unreachable (the real failure path)', async () => {
    mockFetchHealth.mockResolvedValueOnce({ status: 'unreachable', p95_ms: 0 })

    render(<DegradedBanner />)

    const heading = await screen.findByText('Could not reach the analysis engine.')
    expect(heading).toBeInTheDocument()
  })
})
