import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { InspectorRouter } from '../InspectorRouter'
import { useEdgeMutations, useEdgeStrengthPreview } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { ToastProvider } from '../../../ToastContext'
import { __resetPendingEdgeEditsForTest, pendingStrengthEditOf } from '../../../conversation/pendingEdgeEdit'
import { SystemEventSendError, type SendTurnOutcome } from '../../../conversation/useConversation'

const { sendSystemEvent } = vi.hoisted(() => ({ sendSystemEvent: vi.fn() }))
vi.mock('../../../conversation/ConversationContext', async importOriginal => ({
  ...await importOriginal<typeof import('../../../conversation/ConversationContext')>(),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
const A = { weight: 0.5, direction: 'positive', weightSource: 'cee', directionSource: 'cee', strength_mean: 0.5, effect_direction: 'positive' }
const B = { weight: 0.3, direction: 'negative', weightSource: 'server-B', directionSource: 'server-B', strength_mean: -0.3, effect_direction: 'negative' }
const nodes = [
  { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing' } },
  { id: 'g1', type: 'goal', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
  { id: 'f2', type: 'factor', position: { x: 0, y: 100 }, data: { label: 'Budget' } },
]
const edge = (data = B, source = 'f1') => ({ id: 'e1', source, target: 'g1', data: { ...data } })
beforeEach(() => {
  vi.useFakeTimers()
  sendSystemEvent.mockReset()
  sendSystemEvent.mockImplementation(() => new Promise<SendTurnOutcome>(() => {}))
  __resetPendingEdgeEditsForTest()
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  useCanvasStore.setState({ nodes, edges: [edge(A)], results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    analysisFreshness: { freshness: 'stale', computedAt: 1 }, confirmedNodeIds: new Set(), goalThreshold: null,
    _internal: {}, currentScenarioId: 'A', lastServerGraphHash: 'server-A' } as never)
})
afterEach(() => { cleanup(); __resetPendingEdgeEditsForTest(); vi.useRealTimers() })
function mount() {
  const view = render(<ToastProvider><InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} /></ToastProvider>)
  const slider = view.getByLabelText('Effect on target') as HTMLInputElement
  slider.closest('details')!.open = true
  return { ...view, slider }
}
function preview(slider: HTMLInputElement, value = -0.75) {
  fireEvent.change(slider, { target: { value: String(value) } })
  act(() => { vi.advanceTimersByTime(120) })
}
function replace(scenarioId = 'B', source = 'f1') {
  useCanvasStore.setState({ currentScenarioId: scenarioId, edges: [edge(B, source)] } as never)
}
function expectB() { expect(useCanvasStore.getState().edges[0].data).toEqual(B) }
function expectDropped(view: ReturnType<typeof mount>) {
  expect(sendSystemEvent).not.toHaveBeenCalled()
  expect(pendingStrengthEditOf('e1')).toBeUndefined()
  expect(view.getByRole('alert')).toHaveTextContent('Not saved')
}

describe('strength capture stays in its scenario and endpoints', () => {
  it('mounted A→B shared-e1 replacement drops a preview, release sends zero and leaves B untouched', () => {
    const view = mount()
    preview(view.slider)
    expect(pendingStrengthEditOf('e1')?.identity).toEqual({ scenarioId: 'A', from: 'f1', to: 'g1' })
    act(() => { replace() })
    fireEvent.mouseUp(view.slider)
    fireEvent.blur(view.slider)
    act(() => { vi.advanceTimersByTime(120) })
    expectB()
    expectDropped(view)
    expect(view.getByLabelText('Effect on target')).not.toBeDisabled()
  })

  it('the mounted strength writer rejects an A→B same-ID capture even without a panel subscription', () => {
    const view = renderHook(() => ({ preview: useEdgeStrengthPreview('e1'), writer: useEdgeMutations('e1') }),
      { wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider> })
    act(() => { view.result.current.preview.previewStrength(-0.75) })
    act(() => { replace() })
    let outcome: unknown
    act(() => { outcome = view.result.current.writer.setStrength(-0.75, { onSendSettled: vi.fn() }) })
    expect(outcome).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expectB()
    expect(pendingStrengthEditOf('e1')).toBeUndefined()
    })

  it('the hydrateGraphSlice seam drops before replacing the scenario and says Not saved', () => {
    const view = mount()
    preview(view.slider)
    act(() => { useCanvasStore.getState().hydrateGraphSlice({ currentScenarioId: 'B', nodes, edges: [edge()] } as never) })
    fireEvent.mouseUp(view.slider)
    fireEvent.blur(view.slider)
    expectB()
    expectDropped(view)
  })

  it('a same-scenario full graph replacement also drops the departing preview', () => {
    const view = mount()
    preview(view.slider)
    act(() => { useCanvasStore.getState().hydrateGraphSlice({ currentScenarioId: 'A', nodes, edges: [edge()] } as never) })
    fireEvent.mouseUp(view.slider)
    expectB()
    expectDropped(view)
  })

  it.each(['store', 'hydrate'])('a %s replacement before the first debounced preview tick sends zero and says Not saved', mode => {
    const view = mount()
    fireEvent.change(view.slider, { target: { value: '-0.85' } })
    expect(pendingStrengthEditOf('e1')).toBeUndefined()
    act(() => {
      if (mode === 'store') replace()
      else useCanvasStore.getState().hydrateGraphSlice({ currentScenarioId: 'B', nodes, edges: [edge()] } as never)
    })
    fireEvent.mouseUp(view.slider)
    fireEvent.blur(view.slider)
    act(() => { vi.advanceTimersByTime(200) })
    expectB()
    expectDropped(view)
  })

  it('same-ID endpoints replaced mid-gesture send zero and never restore the old link', () => {
    const view = mount()
    preview(view.slider)
    act(() => { replace('A', 'f2') })
    fireEvent.mouseUp(view.slider)
    expect(useCanvasStore.getState().edges[0].source).toBe('f2')
    expectB()
    expectDropped(view)
  })

  it('an edge removed mid-gesture sends zero and surfaces Not saved', () => {
    const view = mount()
    preview(view.slider)
    act(() => { useCanvasStore.setState({ edges: [] }) })
    fireEvent.mouseUp(view.slider)
    fireEvent.blur(view.slider)
    expect(useCanvasStore.getState().edges).toEqual([])
    expectDropped(view)
  })

  it('the writer also discloses an edge vanished at commit without a panel subscription', () => {
    const view = renderHook(() => useEdgeMutations('e1'), { wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider> })
    act(() => { useCanvasStore.setState({ edges: [] }) })
    let outcome: unknown
    act(() => { outcome = view.result.current.setStrength(-0.75, { onSendSettled: vi.fn() }) })
    expect(outcome).toBe('not_encodable')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]')).toHaveTextContent('Not saved')
  })

  it('a refusal arriving after replacement leaves B untouched and its new gesture owns B data', async () => {
    let refuse!: (error: unknown) => void
    sendSystemEvent.mockImplementationOnce(() => new Promise((_resolve, reject) => { refuse = reject }))
    const view = mount()
    preview(view.slider)
    fireEvent.mouseUp(view.slider)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    act(() => { replace() })
    expectB()
    const bSlider = view.getByLabelText('Effect on target') as HTMLInputElement
    expect(bSlider).not.toBeDisabled()
    preview(bSlider, -0.6)
    const bCapture = pendingStrengthEditOf('e1')
    expect(bCapture?.before).toEqual(B)
    await act(async () => { refuse(new SystemEventSendError('server', { reason: 'system_event_refused_no_write' })) })
    expect(useCanvasStore.getState().edges[0].data).toMatchObject({ ...B, weight: 0.6, weightSource: 'user', directionSource: 'user' })
    expect(pendingStrengthEditOf('e1')?.before).toBe(bCapture?.before)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it.each(['scenario', 'endpoints'])('a late refusal through the mounted writer cannot rollback changed %s', async kind => {
    let refuse!: (error: unknown) => void
    sendSystemEvent.mockImplementationOnce(() => new Promise((_resolve, reject) => { refuse = reject }))
    const view = renderHook(() => ({ preview: useEdgeStrengthPreview('e1'), writer: useEdgeMutations('e1') }))
    act(() => { view.result.current.preview.previewStrength(-0.75); view.result.current.writer.setStrength(-0.75, { onSendSettled: vi.fn() }) })
    const replacement = { ...B, weight: 0.75 }
    act(() => { useCanvasStore.setState({ currentScenarioId: kind === 'scenario' ? 'B' : 'A', edges: [edge(replacement, kind === 'endpoints' ? 'f2' : 'f1')] } as never) })
    await act(async () => { refuse(new SystemEventSendError('server', { reason: 'system_event_refused_no_write' })) })
    expect(useCanvasStore.getState().edges[0].data).toEqual(replacement)
    expect(pendingStrengthEditOf('e1')).toBeUndefined()
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })
})
