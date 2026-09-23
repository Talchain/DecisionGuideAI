/**
 * ⭐ `openOptionValueInput(optionId)` — ONE navigation action from anywhere on
 * the canvas to the Model tab, at that option's detail, with its first empty
 * effect-value input focused.
 *
 * The node-card lane calls it from the canvas "Not in this analysis" pill. It
 * rides the EXISTING tab/section mechanism (`setActiveOutputTab('diagnostics')`
 * + `requestModelTabSection('options')`, consumed by this host) and adds only
 * the row-level half: which option to select and which input to focus. No new
 * panel system.
 *
 * Driven through the REAL `ModelTabBody` and the REAL `ModelTabV2Panel`, so the
 * store request → host → panel → detail region → focused input chain is
 * witnessed end to end rather than asserted in halves (the seam the panel's own
 * `interventionEdit` forwarding once dropped between two green specs).
 *
 * CLAIM SCOPE: jsdom proves which element holds focus — never scroll position.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
  focusModelTarget: vi.fn(),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: 'scn_1',
    lastServerGraphHash: '9f2c1b0ae4d37c5a',
    currentStage: null,
    graphEditedSinceLastRun: false,
    goalThreshold: null,
    goalThresholdRepresentation: null,
  }
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (state: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ModelTabBody } from '../ModelTabBody'
import { useUIStore } from '../../../stores/uiStore'
import { openOptionValueInput } from '../../utils/openOptionValueInput'

const OPTION = 'opt_reduce_scope'
const UNLINKED = 'opt_outsource'
const F_A = 'fac_team_capacity'
const F_B = 'fac_delivery_cost'

const NODES: Node[] = [
  { id: F_A, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team capacity' } },
  { id: F_B, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Delivery cost' } },
  { id: OPTION, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Reduce Feature Scope' } },
  { id: UNLINKED, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Outsource it' } },
] as Node[]
const EDGES: Edge[] = [
  { id: 'e1', source: OPTION, target: F_A, data: {} },
  { id: 'e2', source: OPTION, target: F_B, data: {} },
] as Edge[]

const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

function renderTab() {
  return render(<ModelTabBody {...DEFAULT_PROPS} nodes={NODES} edges={EDGES} />)
}

let originalScrollIntoView: unknown
beforeEach(() => {
  mockGraph.nodes = NODES
  mockGraph.edges = EDGES
  originalScrollIntoView = (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = () => {}
  useUIStore.setState({ pendingModelTabSection: null, activeOutputTab: 'results' } as never)
  useUIStore.getState().requestOptionValueInput(null)
})
afterEach(() => {
  cleanup()
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = originalScrollIntoView
  useUIStore.setState({ pendingModelTabSection: null } as never)
  useUIStore.getState().requestOptionValueInput(null)
})

describe('⭐ openOptionValueInput lands on the option’s first empty input', () => {
  it('asks for the Model tab and its options section through the EXISTING mechanism', () => {
    openOptionValueInput(OPTION)
    const ui = useUIStore.getState()
    // `diagnostics` is the Model tab's code id (CLAUDE.md §3).
    expect(ui.activeOutputTab).toBe('diagnostics')
    expect(ui.pendingModelTabSection).toBe('options')
    expect(ui.pendingOptionValueInput).toBe(OPTION)
  })

  it('⭐ opens THAT option’s detail and focuses its FIRST empty input', async () => {
    openOptionValueInput(OPTION)
    renderTab()

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByTestId(`model-detail-v2-intervention-${F_A}-input`),
      ),
    )
    expect(screen.getByTestId('model-detail-v2').getAttribute('data-row-id')).toBe(OPTION)
    // Bound by identity: the SECOND input exists and is NOT the one focused.
    expect(document.activeElement).not.toBe(
      screen.getByTestId(`model-detail-v2-intervention-${F_B}-input`),
    )
    // The host consumed the request, so a later render cannot replay it.
    expect(useUIStore.getState().pendingOptionValueInput).toBeNull()
  })

  it('CONTRAST — an option linked to nothing opens its detail with nothing to focus', async () => {
    openOptionValueInput(UNLINKED)
    renderTab()
    await waitFor(() =>
      expect(screen.getByTestId('model-detail-v2').getAttribute('data-row-id')).toBe(UNLINKED),
    )
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })

  it('CONTRAST — without a request, no option is selected and nothing is focused', () => {
    renderTab()
    expect(screen.queryByTestId('model-detail-v2')).toBeNull()
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })
})
