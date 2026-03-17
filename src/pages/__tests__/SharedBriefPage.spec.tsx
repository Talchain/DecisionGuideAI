/**
 * SharedBriefPage tests — C.1b Task 7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSharedBriefBySlug = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  getSharedBriefBySlug: (...args: unknown[]) => mockGetSharedBriefBySlug(...args),
}))

import SharedBriefPage from '../SharedBriefPage'

function renderPage(slug = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/brief/${slug}`]}>
      <Routes>
        <Route path="/brief/:slug" element={<SharedBriefPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SharedBriefPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches brief by slug on mount', async () => {
    mockGetSharedBriefBySlug.mockResolvedValue({
      brief: { title: 'Test brief', summary: 'A test summary' },
      graph_hash: 'abc123def456',
      seed_used: 42,
      response_hash: 'resp123hash456',
      created_at: '2026-01-15T12:00:00Z',
      expires_at: null,
    })

    renderPage('abc123')

    await waitFor(() => {
      expect(mockGetSharedBriefBySlug).toHaveBeenCalledWith('abc123')
    })

    expect(screen.getByText('Test brief')).toBeTruthy()
    expect(screen.getByText('A test summary')).toBeTruthy()
  })

  it('shows 404 when slug not found', async () => {
    mockGetSharedBriefBySlug.mockResolvedValue(null)

    renderPage('nonexistent')

    await waitFor(() => {
      expect(screen.getByText('Brief not found')).toBeTruthy()
    })

    expect(screen.getByText(/doesn't exist or has expired/)).toBeTruthy()
  })

  it('shows error state on fetch failure', async () => {
    mockGetSharedBriefBySlug.mockRejectedValue(new Error('Network error'))

    renderPage('broken')

    await waitFor(() => {
      expect(screen.getByText('Failed to load brief')).toBeTruthy()
    })
  })

  it('renders provenance footer with graph hash and seed', async () => {
    mockGetSharedBriefBySlug.mockResolvedValue({
      brief: { title: 'My brief' },
      graph_hash: 'abc123def456789',
      seed_used: 1337,
      response_hash: 'resp123hash456789',
      created_at: '2026-01-15T12:00:00Z',
      expires_at: null,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('My brief')).toBeTruthy()
    })

    // Provenance shows truncated hashes
    expect(screen.getByText(/abc123def456/)).toBeTruthy()
    expect(screen.getByText(/1337/)).toBeTruthy()
  })

  it('renders raw JSON fallback when no known fields', async () => {
    mockGetSharedBriefBySlug.mockResolvedValue({
      brief: { custom_field: 'custom value' },
      graph_hash: 'abc',
      seed_used: 1,
      response_hash: 'resp',
      created_at: '2026-01-15T12:00:00Z',
      expires_at: null,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/custom_field/)).toBeTruthy()
    })
  })

  it('works without authentication (anon access)', async () => {
    // No auth mock needed — SharedBriefPage doesn't use auth
    mockGetSharedBriefBySlug.mockResolvedValue({
      brief: { title: 'Public brief' },
      graph_hash: 'abc',
      seed_used: 1,
      response_hash: 'resp',
      created_at: '2026-01-15T12:00:00Z',
      expires_at: null,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Public brief')).toBeTruthy()
    })
  })
})
