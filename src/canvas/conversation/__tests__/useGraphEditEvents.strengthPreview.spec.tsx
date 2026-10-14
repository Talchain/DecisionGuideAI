import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { isAiPanelV2Enabled, isOrchestratorV2Enabled } from '../../../flags'
import { InspectorRouter } from '../../ui/inspector-v2/InspectorRouter'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { __resetPendingEdgeEditsForTest } from '../pendingEdgeEdit'
import { useGraphEditEvents } from '../useGraphEditEvents'
import type { WireSystemEvent } from '../types'

const { sendSystemEvent } = vi.hoisted(() => ({
  sendSystemEvent: vi.fn<[WireSystemEvent, unknown?], Promise<unknown>>(),
}))

vi.mock('../ConversationContext', async importOriginal => ({
  ...await importOriginal<typeof import('../ConversationContext')>(),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('../../../flags', async importOriginal => ({
  ...await importOriginal<typeof import('../../../flags')>(),
  isJourneyTabEnabled: () => false,
}))
vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

function LegacySubscriber() {
  useGraphEditEvents(sendSystemEvent)
  return null
}

// Mount the actual fallback subscriber beside the actual strength control.
// The flags retain their real localStorage precedence, as on staging.
function FallbackHarness() {
  return <>
    {!isAiPanelV2Enabled() && <LegacySubscriber />}
    <InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />
  </>
}

beforeEach(() => {
  vi.useFakeTimers()
  sendSystemEvent.mockReset()
  sendSystemEvent.mockImplementation(() => new Promise(() => {}))
  localStorage.setItem('feature.aiPanelV2', 'false')
  localStorage.setItem('feature.orchestratorV2', 'true')
  __resetPendingEdgeEditsForTest()
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  useCanvasStore.setState({
    currentScenarioId: 'fallback-strength-scenario',
    nodes: [
      { id: '2891dabb', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing' } },
      { id: 'c12af5de', type: 'goal', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [{ id: 'e1', source: '2891dabb', target: 'c12af5de', data: {
      weight: 0.5, direction: 'positive', weightSource: 'cee', directionSource: 'cee',
      strength_mean: 0.5, effect_direction: 'positive',
    } }],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    analysisFreshness: { freshness: 'stale', computedAt: 1 },
    confirmedNodeIds: new Set(),
    goalThreshold: null,
    _internal: {},
    _externalMutationActive: 0,
    lastServerGraphHash: 'server-fallback-strength',
    pendingStructuralAdds: [],
    pendingStructuralDeletes: [],
    history: { past: [], future: [] },
  } as never)
})

afterEach(() => {
  cleanup()
  __resetPendingEdgeEditsForTest()
  localStorage.removeItem('feature.aiPanelV2')
  localStorage.removeItem('feature.orchestratorV2')
  vi.useRealTimers()
})

function mountSlider() {
  expect(isAiPanelV2Enabled(), 'real localStorage override must select the legacy host').toBe(false)
  expect(isOrchestratorV2Enabled(), 'legacy graph edit emitter must be enabled').toBe(true)
  const view = render(<FallbackHarness />)
  const slider = view.container.querySelector<HTMLInputElement>('input[aria-label="Effect on target"]')
  expect(slider, 'the real InspectorRouter strength slider must mount').not.toBeNull()
  expect(slider).not.toBeDisabled()
  slider!.closest('details')!.open = true
  return { ...view, slider: slider! }
}

function preview(slider: HTMLInputElement) {
  fireEvent.change(slider, { target: { value: '-0.75' } })
  act(() => { vi.advanceTimersByTime(120) })
  expect(useCanvasStore.getState().edges[0]!.data).toMatchObject({
    weight: 0.75, direction: 'negative', weightSource: 'user', directionSource: 'user',
  })
}

function callsOf(type: WireSystemEvent['type']) {
  return sendSystemEvent.mock.calls.filter(([event]) => event.type === type)
}

describe('legacy graph edits during a strength preview', () => {
  it('aiPanelV2=false: holding a changed slider over 1.5 s emits no direct_graph_edit; release sends exactly one strength commit', () => {
    const { slider } = mountSlider()
    preview(slider)
    act(() => { vi.advanceTimersByTime(1800) })
    expect(callsOf('direct_graph_edit'), 'an unsent preview must not reach the legacy fallback wire').toHaveLength(0)
    expect(sendSystemEvent, 'holding the preview must send no turn of any kind').not.toHaveBeenCalled()

    fireEvent.mouseUp(slider)
    expect(callsOf('edge_strength_edit')).toHaveLength(1)
    expect(callsOf('edge_strength_edit')[0]![0]).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: '2891dabb', to: 'c12af5de', magnitude: 0.75, direction_intent: 'negative',
        expected: { mean: 0.5, effect_direction: 'positive' }, intent: 'set',
      },
    })
    fireEvent.blur(slider)
    act(() => { vi.advanceTimersByTime(1800) })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(callsOf('direct_graph_edit')).toHaveLength(0)
  })

  it('contrast: an ordinary non-preview strength graph edit still sends through the fallback', () => {
    mountSlider()
    act(() => {
      const edge = useCanvasStore.getState().edges[0]!
      useCanvasStore.getState().updateEdge('e1', { data: { ...edge.data!, weight: 0.8, weightSource: 'user' } })
      vi.advanceTimersByTime(1600)
    })
    expect(callsOf('direct_graph_edit')).toHaveLength(1)
    expect(callsOf('edge_strength_edit')).toHaveLength(0)
    expect(callsOf('direct_graph_edit')[0]![0]).toMatchObject({
      payload: { changed_node_ids: [], changed_edge_ids: ['e1'], operations: ['update'],
        fields_changed: { e1: ['weight', 'weightSource'] } },
    })
  })

  it('contrast: an ordinary different-field edit on the same preview edge is still reported', () => {
    const { slider } = mountSlider()
    preview(slider)
    act(() => {
      const edge = useCanvasStore.getState().edges[0]!
      useCanvasStore.getState().updateEdge('e1', { data: { ...edge.data!, confidence: 0.8 } })
      vi.advanceTimersByTime(1600)
    })
    expect(callsOf('direct_graph_edit')).toHaveLength(1)
    expect(callsOf('edge_strength_edit')).toHaveLength(0)
    expect(callsOf('direct_graph_edit')[0]![0]).toMatchObject({
      payload: { changed_edge_ids: ['e1'], operations: ['update'], fields_changed: { e1: ['confidence'] } },
    })
    fireEvent.mouseUp(slider)
    act(() => { vi.advanceTimersByTime(1600) })
    expect(callsOf('edge_strength_edit')).toHaveLength(1)
    expect(callsOf('direct_graph_edit')).toHaveLength(1)
  })
})
