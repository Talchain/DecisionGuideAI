import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { InspectorRouter } from '../InspectorRouter'
import { ACTION_LABELS, INLINE_LABELS } from '../inspectorStrings'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { __resetPendingEdgeEditsForTest, pendingStrengthEditOf } from '../../../conversation/pendingEdgeEdit'
import { SEND_BLOCKED, SEND_DEFERRED, SystemEventSendError, type SendTurnOpts, type SendTurnOutcome } from '../../../conversation/useConversation'
import { editDeliveryHold } from '../../../registration/editDeliveryHold'
import type { WireSystemEvent } from '../../../conversation/types'

type StrengthSetter = ReturnType<typeof import('../useInspectorMutations').useEdgeMutations>['setStrength']
const { setStrength, sendSystemEvent } = vi.hoisted(() => ({
  setStrength: vi.fn<Parameters<StrengthSetter>, void>(),
  sendSystemEvent: vi.fn<[WireSystemEvent, unknown?], Promise<SendTurnOutcome>>(),
}))

let providerMounted = true

vi.mock('../../../conversation/ConversationContext', async importOriginal => ({
  ...await importOriginal<typeof import('../../../conversation/ConversationContext')>(),
  useOptionalConversationContext: () => providerMounted ? { sendSystemEvent } : null,
}))

vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

// Spy at the required module boundary while retaining the REAL strength hook:
// sends, pendingEdgeEdit capture and refusal rollback all execute in this spec.
vi.mock('../useInspectorMutations', async importOriginal => {
  const actual = await importOriginal<typeof import('../useInspectorMutations')>()
  return {
    ...actual,
    useEdgeMutations: (edgeId: string) => {
      const real = actual.useEdgeMutations(edgeId)
      return {
        ...real,
        setStrength: (...args: Parameters<StrengthSetter>) => {
          setStrength(...args)
          return real.setStrength(...args)
        },
      }
    },
  }
})

const EDGE = 'e1'
const ORIGINAL_DATA = {
  weight: 0.5, direction: 'positive', weightSource: 'cee', directionSource: 'cee',
  strength_mean: 0.5, effect_direction: 'positive',
}

beforeEach(() => {
  vi.useFakeTimers()
  setStrength.mockClear()
  sendSystemEvent.mockReset()
  // Keep a dispatched turn unanswered unless the row supplies an outcome.
  sendSystemEvent.mockImplementation(() => new Promise<SendTurnOutcome>(() => {}))
  providerMounted = true
  __resetPendingEdgeEditsForTest()
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  useCanvasStore.setState({
    nodes: [
      { id: '2891dabb', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing' } },
      { id: 'c12af5de', type: 'goal', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [{
      id: EDGE, source: '2891dabb', target: 'c12af5de',
      data: { ...ORIGINAL_DATA },
    }],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    analysisFreshness: { freshness: 'stale', computedAt: 1 },
    confirmedNodeIds: new Set(),
    goalThreshold: null,
    _internal: {},
    currentScenarioId: 'strength-gesture-scenario',
    lastServerGraphHash: 'server-strength-gesture',
  } as never)
})

afterEach(() => {
  cleanup()
  __resetPendingEdgeEditsForTest()
  vi.useRealTimers()
})

function mountSlider({ sending = false } = {}) {
  const view = render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
  const slider = view.container.querySelector<HTMLInputElement>('input[aria-label="Effect on target"]')
  expect(slider, 'the real strength slider must mount through InspectorRouter').not.toBeNull()
  if (sending) {
    expect(slider).toBeDisabled()
  } else {
    expect(slider).not.toBeDisabled()
    expect(slider!.closest('fieldset[disabled]')).toBeNull()
  }
  slider!.closest('details')!.open = true
  return { ...view, slider: slider! }
}

function revealStrengthInputs(view: ReturnType<typeof mountSlider>) {
  const technicalToggle = view.container.querySelector<HTMLButtonElement>('[data-testid="inspector-tech-toggle"]')
  expect(technicalToggle, 'the real Router technical toggle must be present').not.toBeNull()
  fireEvent.click(technicalToggle!)
  const moreToggle = view.getByTestId('inspector-more-toggle')
  if (moreToggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(moreToggle)
  const beta = view.container.querySelector<HTMLInputElement>('[data-testid="edge-strength-more-controls"] input[type="number"]')
  expect(beta, 'the Advanced β field must render through InspectorRouter').not.toBeNull()
  fireEvent.click(view.getByRole('button', { name: INLINE_LABELS.modelDetail }))
  const advancedBeta = view.getByLabelText('Effect coefficient (β)')
  return [beta!, advancedBeta]
}

function change(slider: HTMLInputElement, value: number) {
  fireEvent.change(slider, { target: { value: String(value) } })
  act(() => { vi.advanceTimersByTime(120) })
}

function storedData() {
  const edge = useCanvasStore.getState().edges.find(edge => edge.id === EDGE)
  expect(edge, 'store assertion binds to the inspected edge').toBeDefined()
  return edge!.data
}

function dispatchedEvent(index = 0) {
  const call = sendSystemEvent.mock.calls[index]
  expect(call, `expected a dispatched event at call index ${index}`).toBeDefined()
  return call[0]
}

function expectNoConfirmation(container: HTMLElement) {
  expect(container.textContent).not.toContain('Updated')
}

function expectFinalSend(mean: number) {
  expect(setStrength).toHaveBeenCalledTimes(1)
  expect(setStrength).toHaveBeenLastCalledWith(mean, expect.objectContaining({
    onSendSettled: expect.any(Function),
  }))
  expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  expect(dispatchedEvent()).toEqual({
    type: 'edge_strength_edit',
    payload: {
      from: '2891dabb', to: 'c12af5de',
      magnitude: Math.abs(mean),
      direction_intent: mean < 0 ? 'negative' : 'positive',
      expected: { mean: 0.5, effect_direction: 'positive' },
      intent: 'set',
    },
  })
}

describe('EdgePanel — one strength commit per gesture', () => {
  it.each(['pointerup', 'touchend', 'touchcancel'] as const)(
    'window %s commits the final pending tick once, even after blur and unmount', event => {
      const view = mountSlider()
      change(view.slider, 0.6)
      // The last value is still inside the debounce when the pointer leaves.
      fireEvent.change(view.slider, { target: { value: '-0.75' } })
      expect(sendSystemEvent).not.toHaveBeenCalled()
      fireEvent(window, new Event(event))
      expectFinalSend(-0.75)
      expect(storedData()).toMatchObject({ weight: 0.75, direction: 'negative' })
      fireEvent.blur(view.slider)
      fireEvent.mouseUp(view.slider)
      fireEvent.keyDown(view.slider, { key: 'Enter' })
      fireEvent(window, new Event(event))
      view.unmount()
      expect(setStrength).toHaveBeenCalledTimes(1)
      expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    },
  )

  it('visibility hidden commits the final pending tick once and removes gesture listeners', () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const view = mountSlider()
    change(view.slider, 0.6)
    fireEvent.change(view.slider, { target: { value: '-0.75' } })
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(sendSystemEvent).not.toHaveBeenCalled()
    visibility.mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expectFinalSend(-0.75)
    for (const event of ['pointerup', 'touchend', 'touchcancel']) {
      expect(removeWindow).toHaveBeenCalledWith(event, expect.any(Function))
    }
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    fireEvent.blur(view.slider)
    view.unmount()
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    visibility.mockRestore()
    removeWindow.mockRestore()
    removeDocument.mockRestore()
  })

  it('previews six debounced changes, then sends the last value exactly once on release', () => {
    const { slider } = mountSlider()
    for (const value of [0.55, 0.6, 0.65, 0.7, -0.7, -0.75]) {
      change(slider, value)
      expect(storedData()).toMatchObject({
        weight: Math.abs(value), direction: value < 0 ? 'negative' : 'positive',
      })
      expect(setStrength, 'each drag tick must only preview').toHaveBeenCalledTimes(0)
      expect(sendSystemEvent, 'each local preview tick must emit no strength turn').toHaveBeenCalledTimes(0)
    }

    expect(setStrength, 'dragging must only preview; no strength send before release').toHaveBeenCalledTimes(0)
    expect(sendSystemEvent, 'local canvas preview must not emit a strength turn').toHaveBeenCalledTimes(0)
    fireEvent.mouseUp(slider)
    expectFinalSend(-0.75)
    // All release carriers, even repeated, still describe the same gesture.
    fireEvent.touchEnd(slider)
    fireEvent.blur(slider)
    fireEvent.mouseUp(slider)
    act(() => { vi.advanceTimersByTime(120) })
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('a refused final value restores the pre-gesture sign and provenance, not an intermediate tick', async () => {
    sendSystemEvent.mockRejectedValueOnce(new SystemEventSendError('server', { reason: 'system_event_refused_no_write' }))
    const { slider, container } = mountSlider()
    change(slider, 0.6)
    change(slider, -0.7)
    change(slider, -0.75)
    expect(storedData()).toMatchObject({ weight: 0.75, direction: 'negative', weightSource: 'user', directionSource: 'user' })
    expect(sendSystemEvent).not.toHaveBeenCalled()

    await act(async () => { fireEvent.mouseUp(slider) })

    expectFinalSend(-0.75)
    expect(storedData()).toEqual(ORIGINAL_DATA)
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.getAttribute('data-settlement')).toBe('refused')
    expectNoConfirmation(container)
  })

  it('a not-sent final value restores the pre-gesture data', async () => {
    sendSystemEvent.mockResolvedValueOnce(SEND_BLOCKED)
    const { slider, container } = mountSlider()
    change(slider, 0.6)
    change(slider, -0.75)

    await act(async () => { fireEvent.mouseUp(slider) })

    expectFinalSend(-0.75)
    expect(storedData()).toEqual(ORIGINAL_DATA)
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.getAttribute('data-settlement')).toBe('blocked')
    expectNoConfirmation(container)
  })

  it('with no conversation carrier release restores the pre-gesture data and sends nothing', () => {
    providerMounted = false
    const { slider, container } = mountSlider()
    change(slider, 0.6)
    change(slider, -0.75)
    expect(storedData()).toMatchObject({ weight: 0.75, direction: 'negative' })
    fireEvent.mouseUp(slider)

    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(storedData()).toEqual(ORIGINAL_DATA)
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.getAttribute('data-settlement')).toBe('not_sent')
    expectNoConfirmation(container)
  })

  it('sends nothing and shows no Updated confirmation after dragging away and back', () => {
    const { slider, container } = mountSlider()
    change(slider, 0.75)
    change(slider, 0.5)
    fireEvent.mouseUp(slider)
    fireEvent.blur(slider)

    expect(setStrength).toHaveBeenCalledTimes(0)
    expect(sendSystemEvent).toHaveBeenCalledTimes(0)
    expect(storedData()).toEqual(ORIGINAL_DATA)
    expectNoConfirmation(container)
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')).toBeNull()
  })

  it('an unanswered released strength send disables the slider, Advanced β and presets until sent settlement', async () => {
    let settleSend: (outcome: SendTurnOutcome) => void = () => { throw new Error('send must start before settlement') }
    sendSystemEvent.mockImplementationOnce(() => new Promise<SendTurnOutcome>(resolve => { settleSend = resolve }))
    const view = mountSlider()
    const { slider, container } = view
    const betaInputs = revealStrengthInputs(view)
    const presets = [...container.querySelectorAll<HTMLButtonElement>('[data-testid^="strength-band-"]')]
    expect(presets.length, 'strength presets must render').toBeGreaterThan(0)

    change(slider, 0.6)
    expect(pendingStrengthEditOf(EDGE), 'a preview is captured before any send').toBeDefined()
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(slider, 'an unsent preview must remain editable').not.toBeDisabled()
    for (const beta of betaInputs) expect(beta).not.toBeDisabled()
    for (const preset of presets) expect(preset).not.toBeDisabled()

    fireEvent.mouseUp(slider)

    expectFinalSend(0.6)
    expect(pendingStrengthEditOf(EDGE), 'the unanswered send remains in the module registry').toBeDefined()
    expect(slider, 'the next gesture must wait for the strength send to settle').toBeDisabled()
    for (const beta of betaInputs) expect(beta).toBeDisabled()
    for (const preset of presets) expect(preset).toBeDisabled()
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.textContent).toContain(ACTION_LABELS.strengthEditSending)

    await act(async () => {
      // A sent settlement follows the reply's server-stated tuple application.
      // The staging resolver deliberately leaves an unverified tuple pending.
      const replyEdge = useCanvasStore.getState().edges.find(edge => edge.id === EDGE)
      if (!replyEdge?.data) throw new Error('the inspected edge must retain its data for the reply')
      const replyBefore = replyEdge.data
      useCanvasStore.setState(state => ({
        edges: state.edges.map(edge => edge.id === EDGE
          ? { ...edge, data: { ...replyBefore, strength_mean: 0.6, effect_direction: 'positive' as const } }
          : edge),
      }))
      settleSend(undefined)
    })

    expect(pendingStrengthEditOf(EDGE)).toBeUndefined()
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.getAttribute('data-settlement')).toBe('sent')
    expect(slider).not.toBeDisabled()
    for (const beta of betaInputs) expect(beta).not.toBeDisabled()
    for (const preset of presets) expect(preset).not.toBeDisabled()

    // The model-detail editor sends through its own complete-edit carrier.
    // Its new unanswered send must replace the earlier Sent feedback.
    fireEvent.change(betaInputs[1], { target: { value: '0.7' } })
    fireEvent.blur(betaInputs[1])

    expect(setStrength).toHaveBeenCalledTimes(2)
    expect(setStrength).toHaveBeenLastCalledWith(0.7, expect.objectContaining({
      onSendSettled: expect.any(Function),
    }))
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    expect(dispatchedEvent(1)).toMatchObject({
      type: 'edge_strength_edit',
      payload: { magnitude: 0.7, direction_intent: 'positive', expected: { mean: 0.6, effect_direction: 'positive' } },
    })
    expect(slider).toBeDisabled()
    for (const beta of betaInputs) expect(beta).toBeDisabled()
    for (const preset of presets) expect(preset).toBeDisabled()
    const secondFeedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(secondFeedback?.getAttribute('data-settlement')).toBe('pending')
    expect(secondFeedback?.textContent).toContain(ACTION_LABELS.strengthEditSending)
  })

  it('closing and reopening the inspector keeps an unanswered strength send disabled', () => {
    const first = mountSlider()
    change(first.slider, 0.6)
    fireEvent.mouseUp(first.slider)
    expectFinalSend(0.6)
    expect(first.slider).toBeDisabled()
    const pending = pendingStrengthEditOf(EDGE)
    expect(pending, 'the strength send is deliberately unanswered').toBeDefined()

    first.unmount()
    const reopened = mountSlider({ sending: true })
    for (const beta of revealStrengthInputs(reopened)) expect(beta).toBeDisabled()
    const presets = [...reopened.container.querySelectorAll<HTMLButtonElement>('[data-testid^="strength-band-"]')]
    expect(presets.length, 'strength presets must render after reopening').toBeGreaterThan(0)
    for (const preset of presets) expect(preset).toBeDisabled()
    expect(reopened.container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.textContent).toContain(ACTION_LABELS.strengthEditSending)
    expect(pendingStrengthEditOf(EDGE), 'closing the inspector cannot discard the unanswered send').toBe(pending)
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['unverified', undefined, ACTION_LABELS.strengthEditUnverified],
    ['queued', SEND_DEFERRED, ACTION_LABELS.strengthEditQueued],
  ] as const)('%s answer re-enables every strength control, retains its hold and permits one fresh gesture', async (settlement, outcome, feedbackLabel) => {
    let settleSend: (outcome: SendTurnOutcome) => void = () => { throw new Error('send must start before settlement') }
    let settleSecondSend: (outcome: SendTurnOutcome) => void = () => { throw new Error('second send must start before settlement') }
    sendSystemEvent
      .mockImplementationOnce(() => new Promise<SendTurnOutcome>(resolve => { settleSend = resolve }))
      .mockImplementationOnce(() => new Promise<SendTurnOutcome>(resolve => { settleSecondSend = resolve }))
    const view = mountSlider()
    const { slider, container } = view
    const betaInputs = revealStrengthInputs(view)
    const presets = [...container.querySelectorAll<HTMLButtonElement>('[data-testid^="strength-band-"]')]
    expect(presets.length, 'strength presets must render').toBeGreaterThan(0)

    change(slider, 0.6)
    fireEvent.mouseUp(slider)
    expectFinalSend(0.6)
    const unanswered = pendingStrengthEditOf(EDGE)
    expect(unanswered, 'the first capture waits for its own answer').toBeDefined()
    expect(slider).toBeDisabled()
    for (const beta of betaInputs) expect(beta).toBeDisabled()
    for (const preset of presets) expect(preset).toBeDisabled()

    // No server tuple confirming 0.6 is supplied: the reply only answers the
    // send. The staging resolver therefore keeps the same unconfirmed entry.
    await act(async () => { settleSend(outcome) })

    expect(pendingStrengthEditOf(EDGE), 'an answer does not establish a model confirmation').toBe(unanswered)
    expect(storedData()).toMatchObject({ weight: 0.6, strength_mean: 0.5, weightSource: 'user' })
    expect(editDeliveryHold({ nodes: [], edges: useCanvasStore.getState().edges })).toBe('unconfirmed_edge_on_canvas')
    const feedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(feedback?.getAttribute('data-settlement')).toBe(settlement)
    expect(feedback?.textContent).toContain(feedbackLabel)
    expectNoConfirmation(container)
    expect(slider, 'an answered send must allow a new gesture even without confirmation').not.toBeDisabled()
    for (const beta of betaInputs) expect(beta).not.toBeDisabled()
    for (const preset of presets) expect(preset).not.toBeDisabled()

    const currentData = { ...storedData() }
    change(slider, 0.7)
    const fresh = pendingStrengthEditOf(EDGE)
    expect(fresh, 'the next gesture must replace the answered entry').toBeDefined()
    expect(fresh).not.toBe(unanswered)
    expect(fresh?.before, 'the new capture owns a fresh snapshot').not.toBe(unanswered?.before)
    expect(fresh?.before, 'the new gesture starts from the current visible data, including its provenance').toEqual(currentData)
    expect(fresh?.before).toMatchObject({ weight: 0.6, direction: 'positive', weightSource: 'user', directionSource: 'user' })
    expect(storedData()).toMatchObject({ weight: 0.7, direction: 'positive' })
    expect(slider, 'a new unsent preview remains editable').not.toBeDisabled()
    for (const beta of betaInputs) expect(beta).not.toBeDisabled()
    for (const preset of presets) expect(preset).not.toBeDisabled()
    change(slider, -0.8)
    expect(pendingStrengthEditOf(EDGE)?.before).toBe(fresh?.before)
    expect(storedData()).toMatchObject({ weight: 0.8, direction: 'negative' })
    expect(setStrength, 'the second gesture only previews before release').toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)

    fireEvent.mouseUp(slider)

    expect(setStrength).toHaveBeenCalledTimes(2)
    expect(setStrength).toHaveBeenLastCalledWith(-0.8, expect.objectContaining({ onSendSettled: expect.any(Function) }))
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    expect(dispatchedEvent(1)).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: '2891dabb', to: 'c12af5de', magnitude: 0.8,
        direction_intent: 'negative', expected: { mean: 0.5, effect_direction: 'positive' }, intent: 'set',
      },
    })
    expect(slider, 'the fresh unanswered capture waits for its own answer').toBeDisabled()
    for (const beta of betaInputs) expect(beta).toBeDisabled()
    for (const preset of presets) expect(preset).toBeDisabled()
    const secondFeedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(secondFeedback?.getAttribute('data-settlement')).toBe('pending')
    expect(secondFeedback?.textContent).toContain(ACTION_LABELS.strengthEditSending)
    fireEvent.touchEnd(slider)
    fireEvent.blur(slider)
    act(() => { vi.advanceTimersByTime(120) })
    expect(setStrength).toHaveBeenCalledTimes(2)
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)

    if (settlement === 'queued') {
      const firstOpts = sendSystemEvent.mock.calls[0]?.[1] as Pick<SendTurnOpts, 'onDeferredSettled'> | undefined
      expect(firstOpts?.onDeferredSettled, 'the queued send retains its own later callback').toBeTypeOf('function')
      await act(async () => {
        firstOpts!.onDeferredSettled!(Promise.reject(new SystemEventSendError('server')))
      })
      expect(pendingStrengthEditOf(EDGE)?.before, 'the older queued reply cannot replace the new capture').toBe(fresh?.before)
      expect(slider, 'the older queued reply must not answer the fresh send').toBeDisabled()
      for (const beta of betaInputs) expect(beta).toBeDisabled()
      for (const preset of presets) expect(preset).toBeDisabled()
      expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.getAttribute('data-settlement')).toBe('pending')
      expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    }

    await act(async () => { settleSecondSend(undefined) })

    const answeredSecond = pendingStrengthEditOf(EDGE)
    expect(answeredSecond?.before).toBe(fresh?.before)
    expect(editDeliveryHold({ nodes: [], edges: useCanvasStore.getState().edges })).toBe('unconfirmed_edge_on_canvas')
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.getAttribute('data-settlement')).toBe('unverified')
    expect(container.querySelector('[data-testid="edge-strength-edit-feedback"]')?.textContent).toContain(ACTION_LABELS.strengthEditUnverified)
    expect(slider).not.toBeDisabled()
    for (const beta of betaInputs) expect(beta).not.toBeDisabled()
    for (const preset of presets) expect(preset).not.toBeDisabled()

    const completeEditBefore = { ...storedData() }
    if (settlement === 'unverified') {
      const preset = container.querySelector<HTMLButtonElement>('[data-testid="strength-band-moderate"]')
      expect(preset).not.toBeNull()
      fireEvent.click(preset!)
      expect(setStrength).toHaveBeenLastCalledWith(-0.3, expect.objectContaining({
        preserveDirection: true, onSendSettled: expect.any(Function),
      }))
    } else {
      fireEvent.change(betaInputs[1], { target: { value: '0.9' } })
      fireEvent.blur(betaInputs[1])
      expect(setStrength).toHaveBeenLastCalledWith(0.9, expect.objectContaining({ onSendSettled: expect.any(Function) }))
    }

    const completeEdit = pendingStrengthEditOf(EDGE)
    expect(completeEdit?.before, 'a complete edit after an answer owns a fresh capture').not.toBe(answeredSecond?.before)
    expect(completeEdit?.before, 'presets and model-detail β capture the current data before their write').toEqual(completeEditBefore)
    expect(completeEdit?.before).toMatchObject({ weight: 0.8, direction: 'negative', weightSource: 'user', directionSource: 'user' })
    expect(setStrength).toHaveBeenCalledTimes(3)
    expect(sendSystemEvent).toHaveBeenCalledTimes(3)
    expect(dispatchedEvent(2)).toMatchObject({
      type: 'edge_strength_edit',
      payload: {
        magnitude: settlement === 'unverified' ? 0.3 : 0.9,
        direction_intent: settlement === 'unverified' ? 'preserve' : 'positive',
        expected: { mean: 0.5, effect_direction: 'positive' },
      },
    })
    expect(slider, 'a complete edit must wait for its own answer').toBeDisabled()
    for (const beta of betaInputs) expect(beta).toBeDisabled()
    for (const preset of presets) expect(preset).toBeDisabled()
    const completeFeedback = container.querySelector('[data-testid="edge-strength-edit-feedback"]')
    expect(completeFeedback?.getAttribute('data-settlement')).toBe('pending')
    expect(completeFeedback?.textContent).toContain(ACTION_LABELS.strengthEditSending)
    view.unmount()
    act(() => { vi.advanceTimersByTime(120) })
    expect(setStrength).toHaveBeenCalledTimes(3)
    expect(sendSystemEvent).toHaveBeenCalledTimes(3)
  })

  it('unmount mid-gesture commits the latest preview exactly once', () => {
    const { slider, unmount } = mountSlider()
    change(slider, 0.6)
    change(slider, -0.75)
    expect(setStrength).not.toHaveBeenCalled()
    expect(sendSystemEvent).not.toHaveBeenCalled()

    unmount()

    expectFinalSend(-0.75)
    act(() => { vi.advanceTimersByTime(120) })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('unmount flushes the final tick still within the 120 ms debounce before committing', () => {
    const { slider, unmount } = mountSlider()
    change(slider, 0.6)
    fireEvent.change(slider, { target: { value: '-0.85' } })
    act(() => { vi.advanceTimersByTime(60) })
    expect(storedData()).toMatchObject({ weight: 0.6, direction: 'positive' })
    expect(sendSystemEvent).not.toHaveBeenCalled()

    unmount()

    expectFinalSend(-0.85)
    expect(storedData()).toMatchObject({ weight: 0.85, direction: 'negative' })
    act(() => { vi.advanceTimersByTime(120) })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('release before the debounce expires flushes the final tick into the only send', () => {
    const { slider } = mountSlider()
    change(slider, 0.6)
    fireEvent.change(slider, { target: { value: '-0.85' } })
    act(() => { vi.advanceTimersByTime(60) })
    expect(sendSystemEvent).not.toHaveBeenCalled()

    fireEvent.touchEnd(slider)

    expectFinalSend(-0.85)
    expect(storedData()).toMatchObject({ weight: 0.85, direction: 'negative' })
    fireEvent.mouseUp(slider)
    fireEvent.blur(slider)
    act(() => { vi.advanceTimersByTime(120) })
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('keyboard range changes commit on blur, including the pending final tick', () => {
    const { slider } = mountSlider()
    fireEvent.focus(slider)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    // jsdom does not implement the native range input's key-driven increment.
    fireEvent.change(slider, { target: { value: '0.51' } })
    act(() => { vi.advanceTimersByTime(120) })
    expect(storedData()).toMatchObject({ weight: 0.51 })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.change(slider, { target: { value: '0.52' } })
    expect(setStrength).not.toHaveBeenCalled()
    expect(sendSystemEvent).not.toHaveBeenCalled()

    fireEvent.blur(slider)

    expectFinalSend(0.52)
    act(() => { vi.advanceTimersByTime(120) })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('Enter flushes and commits the pending final tick once, then blur and unmount cannot repeat it', () => {
    const { slider, unmount } = mountSlider()
    change(slider, 0.6)
    fireEvent.change(slider, { target: { value: '-0.85' } })
    act(() => { vi.advanceTimersByTime(60) })
    expect(setStrength).not.toHaveBeenCalled()
    expect(sendSystemEvent).not.toHaveBeenCalled()

    fireEvent.keyDown(slider, { key: 'Enter' })

    expectFinalSend(-0.85)
    expect(storedData()).toMatchObject({ weight: 0.85, direction: 'negative' })
    fireEvent.blur(slider)
    unmount()
    act(() => { vi.advanceTimersByTime(120) })
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('the Advanced β input remains a complete edit that sends once on change', () => {
    const { container, unmount } = mountSlider()
    const technicalToggle = container.querySelector<HTMLButtonElement>('[data-testid="inspector-tech-toggle"]')
    expect(technicalToggle, 'the real Router technical toggle must be present').not.toBeNull()
    fireEvent.click(technicalToggle!)
    const strengthFieldset = container.querySelector('[data-testid="edge-strength-more-controls"]')
    expect(strengthFieldset?.textContent).toContain('β =')
    const beta = strengthFieldset?.querySelector<HTMLInputElement>('input[type="number"]')
    expect(beta, 'the Advanced field must render through InspectorRouter').not.toBeNull()
    expect(beta).not.toBeDisabled()
    expect(beta!.closest('fieldset[disabled]')).toBeNull()

    fireEvent.change(beta!, { target: { value: '-0.8' } })

    expectFinalSend(-0.8)
    expect(storedData()).toMatchObject({ weight: 0.8, direction: 'negative', weightSource: 'user', directionSource: 'user' })
    fireEvent.blur(beta!)
    unmount()
    act(() => { vi.advanceTimersByTime(120) })
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('CONTRAST: a preset click sends exactly once', () => {
    const { container } = mountSlider()
    const preset = container.querySelector<HTMLButtonElement>('[data-testid="strength-band-moderate"]')
    expect(preset).not.toBeNull()
    expect(preset).not.toBeDisabled()
    fireEvent.click(preset!)

    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(setStrength).toHaveBeenCalledWith(0.3, expect.objectContaining({
      preserveDirection: true,
      onSendSettled: expect.any(Function),
    }))
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(dispatchedEvent()).toMatchObject({ type: 'edge_strength_edit', payload: { magnitude: 0.3, direction_intent: 'preserve' } })
  })
})
