/**
 * RT-12: the mounted link inspector reads Science 5993266380's example figures.
 * Every example edge and node goes through the real draft mapper. The served
 * Olumi control proves the estimate/confirmation row still renders elsewhere.
 * Rendered text proves the reader wiring; jsdom makes no layout claim.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

import example from '../../../domain/__tests__/fixtures/d1.patched.rt12.json'
import served from '../../../domain/__tests__/fixtures/servedLinkSizing.20261005.json'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../../utils/applyDraftResult'
import { InspectorRouter } from '../InspectorRouter'

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const LINKS = [
  { id: 'e-12', from: 'sprint_capacity_for_ai_reporting', to: 'ai_reporting_module_availability' },
  { id: 'e-13', from: 'ai_reporting_module_availability', to: 'enterprise_prospect_signing_likelihood' },
  { id: 'e-14', from: 'enterprise_prospect_signing_likelihood', to: 'quarterly_revenue' },
  { id: 'e-15', from: 'sprint_capacity_for_integration_fix', to: 'integration_step_bug_resolution' },
  { id: 'e-16', from: 'integration_step_bug_resolution', to: 'trial_profile_abandonment_rate' },
  { id: 'e-17', from: 'trial_profile_abandonment_rate', to: 'revenue_lost_to_trial_abandonment' },
  { id: 'e-18', from: 'revenue_lost_to_trial_abandonment', to: 'quarterly_revenue' },
] as const
const EXAMPLE_COPY =
  'Example figure. The example decision comes with this strength so you can see a Run; change it to see how much it matters.'
const EXAMPLE_WHY =
  'This is an example figure, not a figure about your situation. Change it to see how much it matters.'
const WRONG_AUTHOR = /Olumi[’']s estimate|from your brief|your figure|Confirmed by you/

function seed(edges: Edge[], edgeId: string) {
  useCanvasStore.setState({
    nodes: example.nodes.map(mapDraftNodeToCanvas) as Node[],
    edges,
    results: { status: 'none', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set([edgeId]) },
    confirmedNodeIds: new Set(),
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
  } as never)
}

function seedExample(link: typeof LINKS[number], changedByUser = false) {
  const edges = example.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)) as Edge[]
  const edge = edges.find(e => e.id === link.id)
  expect(edge, `${link.id}: fixture identity`).toBeDefined()
  expect(edge!.source).toBe(link.from)
  expect(edge!.target).toBe(link.to)
  if (changedByUser) {
    const data = edge!.data as Record<string, unknown>
    edge!.data = { ...data, weightSource: 'user', weight: (data.weight as number) + 0.1 }
  }
  seed(edges, link.id)
}

function open(edgeId: string) {
  const rendered = render(<InspectorRouter nodeId={null} edgeId={edgeId} onClose={vi.fn()} />)
  fireEvent.click(screen.getByTestId('inspector-more-toggle'))
  return rendered
}

beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.setState({
    guidanceItems: [],
    _prefillChat: vi.fn(),
    _sendMessage: null,
    _dispatchAction: null,
    _sendChip: null,
  } as never)
})
afterEach(cleanup)

describe('RT-12 · mounted InspectorRouter → EdgePanel and ExamineLink', () => {
  it.each(LINKS)('$id: says example figure and offers no estimate confirmation', link => {
    seedExample(link)
    const { container } = open(link.id)
    const provenance = screen.getByTestId('edge-values-provenance').textContent ?? ''
    expect(provenance).toContain(EXAMPLE_COPY)
    expect(provenance).not.toContain('Olumi estimated this strength')
    expect(screen.queryByTestId('edge-confirm-current-strength')).toBeNull()
    expect(container.textContent).not.toMatch(/current estimate is|Confirm this estimate/)
    expect(container.textContent).not.toMatch(WRONG_AUTHOR)
    const examine = screen.getByTestId('inspector-examine-link-why')
    expect(examine.getAttribute('data-basis')).toBe('example')
    expect(screen.getByTestId('inspector-examine-link-why').textContent).toBe(EXAMPLE_WHY)
  })

  it('e-13: the spread sentence also names the example figure', () => {
    seedExample(LINKS[1])
    open('e-13')
    const spread = screen.getByTestId('edge-strength-spans-bands').textContent ?? ''
    expect(spread).toContain('fits this example figure')
    expect(spread).not.toContain('fits this estimate')
  })

  it('CONTROL: the served Olumi figure keeps its estimate sentence and confirmation', () => {
    const edge = mapDraftEdgeToCanvas(served.olumi, 0) as Edge
    seed([edge], edge.id)
    const { container } = open(edge.id)
    expect(screen.getByTestId('edge-values-provenance').textContent).toContain('Olumi estimated this strength')
    expect(screen.getByTestId('edge-confirm-current-strength')).toBeTruthy()
    expect(screen.getByTestId('edge-strength-spread').textContent).toContain('Strong')
    expect(container.textContent).not.toMatch(/current estimate is/)
    expect(screen.getByTestId('inspector-examine-link-why').getAttribute('data-basis')).toBe('olumi_estimate')
    expect(screen.getByTestId('edge-strength-spans-bands').textContent).toContain('fits this estimate')
    expect(container.textContent).not.toContain(EXAMPLE_COPY)
  })

  it.each(LINKS)('$id: a changed user strength retires the example attribution', link => {
    seedExample(link, true)
    const { container } = open(link.id)
    expect(screen.getByTestId('edge-values-provenance').textContent).toContain('You set this strength.')
    expect(container.textContent).not.toContain(EXAMPLE_COPY)
    expect(screen.queryByTestId('inspector-examine-link-why')).toBeNull()
  })
})
