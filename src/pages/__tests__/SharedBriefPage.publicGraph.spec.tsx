/**
 * The public graph a share link carries (`publicGraphOf`, DL 30 Oct): only what this page draws. Fixture: a served staging
 * program graph, every UUID replaced by a synthetic UUID-shaped value, one factor given a panel stamp.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import served from '../../services/__tests__/fixtures/served-program-graph.json'
import run from './fixtures/served-program-run-view.json'

const mockGetSharedSnapshotBySlug = vi.fn()
vi.mock('../../services/scenarioService', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSharedSnapshotBySlug: (...args: unknown[]) => mockGetSharedSnapshotBySlug(...args),
}))
import SharedBriefPage from '../SharedBriefPage'
import { publicGraphOf } from '../../services/scenarioService'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const snapshot = (graph: unknown, analysis: unknown = null) => ({ graph, analysis, brief_text: 'Brief.', graph_hash: null, seed: null, created_at: '2026-10-30T03:00:00+00:00', expires_at: null })
const pageText = async (graph: unknown, analysis: unknown = null) => {
  cleanup()
  mockGetSharedSnapshotBySlug.mockResolvedValue(snapshot(graph, analysis))
  render(<MemoryRouter initialEntries={['/brief/s']}><Routes><Route path="/brief/:slug" element={<SharedBriefPage />} /></Routes></MemoryRouter>)
  await screen.findByText('Brief.')
  return document.body.textContent ?? ''
}

describe('publicGraphOf: the model a share link carries', () => {
  beforeEach(() => mockGetSharedSnapshotBySlug.mockReset())

  it('carries no UUID-shaped value anywhere (the served graph holds them under approvers and authors)', () => {
    expect(JSON.stringify(served.graph)).toMatch(UUID)
    expect(JSON.stringify(publicGraphOf(served.graph))).not.toMatch(UUID)
  })

  it('carries no record of the person\'s words, no Runs, no seed and no approver', () => {
    const lm = publicGraphOf(served.graph).living_model as Record<string, unknown>
    expect(Object.keys(lm).sort()).toEqual(['canonical', 'model_program'])
    expect(JSON.stringify(lm)).not.toMatch(/person_words|approved_by|author_id|"runs"|"seed"/)
  })

  it('keeps the panel mark, never the ids of who answered', () => {
    const node = (publicGraphOf(served.graph).nodes as Array<Record<string, unknown>>).find(n => (n.observed_state as { source?: string } | undefined)?.source === 'panel_elicited')
    expect(node?.observed_state).toEqual({ source: 'panel_elicited' })
  })

  it('CONTRAST: the page says exactly the same from the projection as from the whole saved graph', async () => {
    const whole = await pageText(served.graph)
    const projected = await pageText(publicGraphOf(served.graph))
    expect(projected).toBe(whole)
    expect(whole).toContain('From the team')
  })

  it('a program link stays a program link: the Run block, each option named by its card', async () => {
    const graph = publicGraphOf({ nodes: run.nodes, edges: [], living_model: { model_program: 'v1', person_words: ['x'], runs: [] } })
    expect((graph.living_model as Record<string, unknown>).model_program).toBe('v1')
    const text = await pageText(graph, { public_run_view: run.canonical_analysis_view })
    expect(screen.getByTestId('shared-snapshot-run')).toBeTruthy()
    expect(screen.queryByTestId('shared-snapshot-analysis')).toBeNull()
    for (const o of run.canonical_analysis_view.options) expect(text).toContain(o.cell.face)
  })
})
