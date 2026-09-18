/**
 * SharedBriefPage tests.
 *
 * Re-pointed 18 Sep 2026 from `shared_briefs` to `shared_snapshots`. The old
 * mechanism could never deliver content — 0 rows, because its writer gates on
 * two columns the product stopped writing — and carried no graph even in
 * principle, so a recipient saw an empty canvas. Evidence:
 * output/accelerate-20260918/SHARE-GATING-ITEM-SETTLED.md.
 *
 * The privacy assertions below are kept and strengthened. The worst defect this
 * page has ever had was a `JSON.stringify` fallback that printed the raw stored
 * record at an anonymous reader; the guard against it must survive the change
 * of mechanism, so it is tested against the NEW payload shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

const mockGetSharedSnapshotBySlug = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  getSharedSnapshotBySlug: (...args: unknown[]) => mockGetSharedSnapshotBySlug(...args),
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

const SNAPSHOT = {
  graph: {
    nodes: [
      { id: 'd1', type: 'decision', label: 'Open a second site' },
      { id: 'g1', type: 'goal', label: 'Revenue', display_value: '£2.4m by Q4' },
      { id: 'o1', type: 'option', label: 'Lease in Leeds', value: 480000, unit: 'GBP' },
      { id: 'o2', type: 'option', label: 'Stay put' },
      { id: 'f1', type: 'factor', label: 'Local demand', description: 'Measured from Q2 pipeline' },
    ],
    edges: [{ from: 'f1', to: 'g1' }, { from: 'o1', to: 'g1' }],
  },
  analysis: null,
  brief_text: 'We need to decide whether to open a second site.',
  graph_hash: '1b30f286be0a9c',
  seed: null,
  created_at: '2026-01-15T12:00:00Z',
  expires_at: null,
}

describe('SharedBriefPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSharedSnapshotBySlug.mockResolvedValue(SNAPSHOT)
  })

  it('reads the SNAPSHOT by slug, not the brief', async () => {
    renderPage('abc123')
    await waitFor(() => {
      expect(mockGetSharedSnapshotBySlug).toHaveBeenCalledWith('abc123')
    })
  })

  it('shows the sender’s brief text', async () => {
    renderPage()
    expect(
      await screen.findByText('We need to decide whether to open a second site.'),
    ).toBeInTheDocument()
  })

  it('shows the model — the whole reason the link is worth opening', async () => {
    renderPage()
    // Bound by exact label, never by a value predicate another node could satisfy.
    expect(await screen.findByText('Open a second site')).toBeInTheDocument()
    expect(screen.getByText('Lease in Leeds')).toBeInTheDocument()
    expect(screen.getByText('Stay put')).toBeInTheDocument()
    expect(screen.getByText('Local demand')).toBeInTheDocument()
    expect(screen.getByText('Options on the table')).toBeInTheDocument()
  })

  it('prefers display_value over re-deriving a number, so sender and recipient see one figure', async () => {
    renderPage()
    expect(await screen.findByText('£2.4m by Q4')).toBeInTheDocument()
  })

  it('formats a bare value with its unit rather than dropping the unit', async () => {
    renderPage()
    expect(await screen.findByText('480000 GBP')).toBeInTheDocument()
  })

  it('counts elements and links in the footer', async () => {
    renderPage()
    expect(await screen.findByText(/5 elements · 2 links/)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Privacy — the guard that must survive the change of mechanism
  // -------------------------------------------------------------------------

  it('never renders an unrecognised field at the anonymous reader', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: {
        nodes: [
          {
            id: 'secret-node-id',
            type: 'option',
            label: 'Lease in Leeds',
            internal_owner_email: 'someone@example.com',
            provenance: { author_id: 'user-123' },
          },
        ],
        edges: [],
      },
    })
    renderPage()

    expect(await screen.findByText('Lease in Leeds')).toBeInTheDocument()
    // The allowlist holds: nothing outside it reaches the DOM.
    expect(screen.queryByText(/someone@example\.com/)).not.toBeInTheDocument()
    expect(screen.queryByText(/user-123/)).not.toBeInTheDocument()
    expect(screen.queryByText(/secret-node-id/)).not.toBeInTheDocument()
  })

  it('says so honestly when the model carries no nameable element', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'x', type: 'option' }], edges: [] },
    })
    renderPage()

    expect(
      await screen.findByTestId('shared-snapshot-unrenderable'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('shared-snapshot-model')).not.toBeInTheDocument()
  })

  it('handles a graph that is not an object without throwing', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({ ...SNAPSHOT, graph: null })
    renderPage()
    expect(
      await screen.findByTestId('shared-snapshot-unrenderable'),
    ).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // States
  // -------------------------------------------------------------------------

  it('shows a not-found state for an unknown or expired slug', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('Decision not found')).toBeInTheDocument()
  })

  it('shows an error state when the read fails', async () => {
    mockGetSharedSnapshotBySlug.mockRejectedValue(new Error('network down'))
    renderPage()
    expect(await screen.findByText('Failed to load this decision')).toBeInTheDocument()
    expect(screen.getByText('network down')).toBeInTheDocument()
  })
})
