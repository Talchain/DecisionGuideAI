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

  it('⛔ NEVER renders the raw payload — an unrecognised shape gets an honest state', async () => {
    // ⚠⚠ THIS TEST WAS `renders raw JSON fallback when no known fields` AND IT
    // PINNED THE DEFECT AS BEHAVIOUR. This page is the ONLY surface a person
    // outside the team sees, reached anonymously by slug, and its fallback for an
    // unrecognised payload printed `JSON.stringify(brief, null, 2)` at the reader.
    //
    // ⚠ AND THAT BRANCH IS THE UNWITNESSED ONE. Swept at 6497a251: there is NO
    // captured `shared_briefs` row anywhere in this repo — every fixture proving
    // this page is hand-written, in this very file. Contrast control from the same
    // sweep: 91 captured JSON fixtures exist under src/, including live staging
    // captures, so the repo captures payloads readily and has never captured one
    // of these. The tenancy spec records the table at 0 rows and the live
    // `create_shared_brief` as "the CEE variant". Nobody knows what this page
    // receives, and the branch taken when it does not recognise the shape was the
    // one that dumped the record.
    //
    // Privacy, not tidiness: the design record for this table specifies
    // "allowlist, no ids/PII" for the public brief. A verbatim dump renders
    // whatever the row holds, at an anonymous URL.
    mockGetSharedBriefBySlug.mockResolvedValue({
      brief: { custom_field: 'custom value', internal_node_id: 'fac_abc123' },
      graph_hash: 'abc123def456',
      seed_used: 42,
      response_hash: 'resp123hash456',
      created_at: '2026-01-15T12:00:00Z',
      expires_at: null,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('shared-brief-unrenderable')).toBeInTheDocument()
    })
    // The reader is told what happened and what to do.
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument()
    expect(screen.getByText(/ask the person who shared it/i)).toBeInTheDocument()
    // ⛔ And NOTHING from the payload reaches the page. Bound to the values by
    // identity, not to the absence of a <pre> tag, which a restyle could satisfy
    // while still rendering the record.
    expect(document.body.textContent).not.toContain('custom value')
    expect(document.body.textContent).not.toContain('internal_node_id')
    expect(document.body.textContent).not.toContain('fac_abc123')
  })

  it('a non-string recommendation is withheld, not dumped inline', async () => {
    // The same defect one field narrower: a non-string value used to render its
    // raw JSON inside a sentence. Withholding the field is honest; dumping is not.
    mockGetSharedBriefBySlug.mockResolvedValue({
      brief: { title: 'A real brief', recommendation: { option_id: 'opt_secret', p: 0.63 } },
      graph_hash: 'abc123def456',
      seed_used: 42,
      response_hash: 'resp123hash456',
      created_at: '2026-01-15T12:00:00Z',
      expires_at: null,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('A real brief')).toBeInTheDocument()
    })
    expect(document.body.textContent).not.toContain('opt_secret')
    expect(document.body.textContent).not.toContain('0.63')
    // NON-VACUITY: the section still appears and says something.
    expect(screen.getByText(/not in a format this page can show/i)).toBeInTheDocument()
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
