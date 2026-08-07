/**
 * TemplatesPanel merge — BEHAVIOURAL freshness-dirty proof.
 *
 * Complements the source-scan routing guard (TemplatesPanel.mergeFreshness.spec.ts)
 * and the shared-helper behaviour test (mutations/commitGraphMutation.spec.ts) by
 * driving the real "Merge into Current" handler end-to-end and asserting it marks
 * the analysis-freshness overlay dirty via the shared graph-commit path — i.e. a
 * merge after a fresh analysis cannot leave a retained 'fresh' verdict intact.
 *
 * The store is mocked (rendering with the real store pulls scenarios/Supabase) but,
 * unlike the handoff spec, getState exposes pushHistory + markAnalysisFreshnessDirty
 * + createNodeId/createEdgeId so commitGraphMutation runs for real against the spy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TemplatesPanel } from '../TemplatesPanel'
import * as plotAdapter from '../../../adapters/plot'

// vi.hoisted so the vi.mock factory (hoisted above these) can reference the spies
// eagerly — setState is read as a property at factory-eval time, not lazily.
const { markAnalysisFreshnessDirty, pushHistory, setState } = vi.hoisted(() => ({
  markAnalysisFreshnessDirty: vi.fn(),
  pushHistory: vi.fn(),
  setState: vi.fn(),
}))
let createSeq = 0

vi.mock('../../../adapters/plot', () => ({
  plot: { templates: vi.fn(), template: vi.fn() },
  adapterName: 'httpv1',
}))

vi.mock('../../hooks/useTemplatesRun', () => ({
  useTemplatesRun: () => ({
    loading: false, progress: 0, canCancel: false, result: null, error: null,
    run: vi.fn().mockResolvedValue(undefined), cancel: vi.fn(), clearError: vi.fn(),
  }),
}))

vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: vi.fn(() => ({
      isDirty: false,
      nodes: [],
      edges: [],
      setShowResultsPanel: vi.fn(),
      pushHistory,
      markAnalysisFreshnessDirty,
      createNodeId: vi.fn(() => `n-${++createSeq}`),
      createEdgeId: vi.fn(() => `e-${++createSeq}`),
    })),
    setState,
  },
}))

describe('TemplatesPanel — "Merge into Current" dirties the freshness overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSeq = 0
    vi.mocked(plotAdapter.plot.templates).mockResolvedValue({
      schema: 'templates.v1',
      items: [{ id: 'template-1', name: 'Test Template', description: 'desc', version: '1.0' }],
    } as never)
    vi.mocked(plotAdapter.plot.template).mockResolvedValue({
      schema: 'template.v1', id: 'template-1', name: 'Test Template', description: 'desc',
      version: '1.0', default_seed: 1337,
      graph: { nodes: [{ id: 'n1', label: 'Node 1', kind: 'goal' }], edges: [] },
    } as never)
  })

  it('marks dirty through the shared commit when merging a template into the current canvas', async () => {
    render(<TemplatesPanel isOpen onClose={vi.fn()} onInsertBlueprint={vi.fn()} />)

    // Select a template so the footer (with "Merge into Current") renders.
    await waitFor(() => expect(screen.getByText('Test Template')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /insert .*template/i }))

    const mergeBtn = await screen.findByRole('button', { name: /merge into current/i })
    expect(markAnalysisFreshnessDirty).not.toHaveBeenCalled() // not until the merge fires
    fireEvent.click(mergeBtn)

    // commitGraphMutation: pushHistory + setState + markAnalysisFreshnessDirty.
    await waitFor(() => expect(markAnalysisFreshnessDirty).toHaveBeenCalled())
    expect(pushHistory).toHaveBeenCalled()

    // Prove the merge COMMITS the expected graph mutation, not just that it
    // dirties: setState receives a functional updater that, run against a current
    // graph, APPENDS the template's nodes/edges (preserving the existing ones).
    const updater = setState.mock.calls.at(-1)?.[0]
    expect(typeof updater).toBe('function')
    const existing = { id: 'existing-node', type: 'goal', position: { x: 0, y: 0 }, data: {} }
    const next = updater({ nodes: [existing], edges: [] })
    expect(next.nodes.map((n: { id: string }) => n.id)).toEqual(['existing-node', 'n-1'])
    expect(next.edges).toEqual([]) // template had no edges; existing edges preserved
  })
})
