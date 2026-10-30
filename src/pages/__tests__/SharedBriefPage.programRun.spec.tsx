/**
 * SM4 (30 Oct): a link to a MODEL PROGRAM scenario carries its Run. The snapshot's `analysis.canonical_analysis_view` is the
 * view CEE served on the scenario read when the link was made (fixture: a served staging read, verbatim); the page says it
 * with the canvas's own block (`ViewOnlyRunChancesBlock`), so the recipient reads the words the owner's board shows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import served from './fixtures/served-program-run-view.json'

const mockGetSharedSnapshotBySlug = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  getSharedSnapshotBySlug: (...args: unknown[]) => mockGetSharedSnapshotBySlug(...args),
}))

import SharedBriefPage from '../SharedBriefPage'

const view = served.canonical_analysis_view
const snapshot = (analysis: unknown) => ({
  graph: { nodes: served.nodes, edges: [] }, analysis, brief_text: 'Should we add a support specialist?',
  graph_hash: 'f7e50e5fa84c', seed: null, created_at: '2026-10-29T23:40:00+00:00', expires_at: null,
})
const renderPage = () => render(
  <MemoryRouter initialEntries={['/brief/abc123']}><Routes><Route path="/brief/:slug" element={<SharedBriefPage />} /></Routes></MemoryRouter>,
)

describe('SharedBriefPage: a program scenario\'s Run', () => {
  beforeEach(() => mockGetSharedSnapshotBySlug.mockReset())

  it('says each option\'s chance, its driver reason and CEE\'s most-likely words, verbatim from the served view', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue(snapshot({ canonical_analysis_view: view }))
    renderPage()
    const run = await screen.findByTestId('shared-snapshot-run')
    for (const o of view.options) expect(run.textContent).toContain(o.cell.face)
    expect(run.textContent).toContain(view.options[0].main_driver.kind === 'none_licensed' ? (view.options[0].main_driver as { reason: string }).reason : '')
    expect(screen.getByTestId('analysis-view-only-most-likely').textContent).toBe(view.leader.words)
  })

  it('a Run that is no longer current says CEE\'s not-current line first, never as a current result', async () => {
    const stale = { ...view, staleness: { ...view.staleness, stale: true }, face_when_stale: 'This result is from before the model changed. Run again to see the current result.' }
    mockGetSharedSnapshotBySlug.mockResolvedValue(snapshot({ canonical_analysis_view: stale }))
    renderPage()
    const run = await screen.findByTestId('shared-snapshot-run')
    expect(run.textContent?.startsWith('What the model says' + stale.face_when_stale)).toBe(true)
    expect(screen.queryByTestId('analysis-view-only-most-likely')).toBeNull()
  })

  it('shows no "Model hash" line', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue(snapshot({ canonical_analysis_view: view }))
    renderPage()
    await screen.findByTestId('shared-snapshot-run')
    expect(document.body.textContent).not.toContain('Model hash')
  })

  it('NEGATIVE: a link with no view shows no Run section (the share as before)', async () => {
    mockGetSharedSnapshotBySlug.mockResolvedValue(snapshot(null))
    renderPage()
    await screen.findByText('Should we add a support specialist?')
    expect(screen.queryByTestId('shared-snapshot-run')).toBeNull()
  })
})
