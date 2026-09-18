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

/**
 * ⭐ THIS FIXTURE'S SHAPE IS DERIVED FROM THE PRODUCER, NOT INVENTED.
 *
 * Census of every graph written in the 7 days to 18 Sep 2026 (45,876 nodes):
 * the taxonomy key is `kind`, present on 45,876; `type` occurs ZERO times.
 * `source_quote` 9,756 · `display_value` 4,695 · `description` 118 ·
 * `value`/`unit` 0. Kinds: factor 15,449 · option 12,020 · risk 6,698 ·
 * outcome 5,341 · decision 3,184 · goal 3,184.
 *
 * The envelope below is the exact shape `get_shared_snapshot_by_slug` returned
 * over HTTP to an anonymous caller, including the `+00:00` timestamp offset and
 * the explicit nulls the read deliberately does not strip.
 */
const SNAPSHOT = {
  graph: {
    nodes: [
      { id: 'd1', kind: 'decision', label: 'Open a second site' },
      { id: 'g1', kind: 'goal', label: 'Revenue', source_quote: 'we need to hit £2.4m by Q4' },
      { id: 'o1', kind: 'option', label: 'Lease in Leeds', source_quote: 'the Leeds unit is available' },
      { id: 'o2', kind: 'option', label: 'Stay put' },
      { id: 'f1', kind: 'factor', label: 'Local demand', display_value: '+12% YoY' },
      { id: 'r1', kind: 'risk', label: 'Demand does not materialise' },
    ],
    edges: [
      { from: 'f1', to: 'g1', strength: 0.6, effect_direction: 'increases', exists_probability: 0.9 },
      { from: 'o1', to: 'g1', strength: 0.4, effect_direction: 'increases', exists_probability: 0.8 },
    ],
  },
  analysis: null,
  brief_text: 'We need to decide whether to open a second site.',
  graph_hash: '1b30f286be0a9c',
  seed: null,
  created_at: '2026-09-18T00:29:15.899114+00:00',
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

  it('groups by the producer’s `kind`, which is the key real graphs actually carry', async () => {
    renderPage()
    // All six headings must appear. If this grouped by `type` instead, every
    // node would fall into "Also in the model" — 45,876 of them, in a week.
    expect(await screen.findByText('The decision')).toBeInTheDocument()
    expect(screen.getByText('What it is for')).toBeInTheDocument()
    expect(screen.getByText('Options on the table')).toBeInTheDocument()
    expect(screen.getByText('What it depends on')).toBeInTheDocument()
    expect(screen.getByText('What could go wrong')).toBeInTheDocument()
    expect(screen.queryByText('Also in the model')).not.toBeInTheDocument()
  })

  it('renders `risk` — 6,698 nodes a week that the first draft of this page had no group for', async () => {
    renderPage()
    expect(await screen.findByText('Demand does not materialise')).toBeInTheDocument()
  })

  it('still groups a LEGACY graph that carries `type` instead of `kind`', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'o9', type: 'option', label: 'Legacy option' }], edges: [] },
    })
    renderPage()
    expect(await screen.findByText('Options on the table')).toBeInTheDocument()
    expect(screen.getByText('Legacy option')).toBeInTheDocument()
  })

  it('shows the sender’s own words per element — the attribution, not just the label', async () => {
    renderPage()
    expect(await screen.findByText(/we need to hit £2\.4m by Q4/)).toBeInTheDocument()
    expect(screen.getByText(/the Leeds unit is available/)).toBeInTheDocument()
  })

  it('prefers display_value over re-deriving a number, so sender and recipient see one figure', async () => {
    renderPage()
    expect(await screen.findByText('+12% YoY')).toBeInTheDocument()
  })

  it('formats a bare value with its unit rather than dropping the unit', async () => {
    // `value`/`unit` occur ZERO times in current data; this path exists only for
    // older graphs, and is tested so it cannot rot unnoticed.
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'o1', kind: 'option', label: 'Lease', value: 480000, unit: 'GBP' }], edges: [] },
    })
    renderPage()
    expect(await screen.findByText('480000 GBP')).toBeInTheDocument()
  })

  it('counts elements and links in the footer', async () => {
    renderPage()
    expect(await screen.findByText(/6 elements · 2 links/)).toBeInTheDocument()
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
            kind: 'option',
            label: 'Lease in Leeds',
            internal_owner_email: 'someone@example.com',
            // `provenance` is on 45,856 of 45,876 real nodes, so this is the
            // realistic carrier of internal detail, not an invented one.
            provenance: { author_id: 'user-123' },
            starterId: 'starter-abc',
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
    expect(screen.queryByText(/starter-abc/)).not.toBeInTheDocument()
  })

  it('says so honestly when the model carries no nameable element', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue({
      ...SNAPSHOT,
      graph: { nodes: [{ id: 'x', kind: 'option' }], edges: [] },
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
