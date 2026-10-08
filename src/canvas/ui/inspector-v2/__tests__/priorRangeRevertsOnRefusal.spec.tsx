import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, screen } from '@testing-library/react'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useNodeMutations } from '../useInspectorMutations'
import { SEND_BLOCKED, SEND_DEFERRED, SystemEventSendError } from '../../../conversation/useConversation'

const sendSystemEvent = vi.fn()
let context: { sendSystemEvent: typeof sendSystemEvent } | null = { sendSystemEvent }
vi.mock('../../../conversation/ConversationContext', () => ({ useOptionalConversationContext: () => context }))

const updateNode = useCanvasStore.getState().updateNode
const before = { distribution: 'beta', range_min: 0.1, range_max: 0.9 }
const range = () => useCanvasStore.getState().nodes[0]?.data.prior
function edit() {
  const hook = renderHook(() => useNodeMutations('factor-1'), { wrapper: ToastProvider })
  act(() => hook.result.current.setPriorRange(0.2, 0.6))
  return hook
}
beforeEach(() => {
  sendSystemEvent.mockReset().mockResolvedValue(undefined)
  context = { sendSystemEvent }
  useCanvasStore.setState({ nodes: [{ id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: { prior: { ...before } } }], edges: [], updateNode })
})
afterEach(cleanup)

describe('prior_range_edit rollback', () => {
  it('restores the captured range and discloses a proven refusal', async () => {
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('server', { reason: 'system_event_refused_no_write' }))
    edit()
    await act(async () => {})
    expect(range()).toEqual(before)
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved')
    expect(screen.getByRole('alert')).toHaveTextContent('previous range is back')
  })
  it('keeps the new range when accepted', async () => {
    edit()
    await act(async () => {})
    expect(range()).toEqual({ ...before, range_min: 0.2, range_max: 0.6 })
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('restores a not-sent range', async () => {
    sendSystemEvent.mockResolvedValue(SEND_BLOCKED)
    edit()
    await act(async () => {})
    expect(range()).toEqual(before)
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved')
  })
  it('refuses without a sender and leaves the range unchanged', () => {
    context = null
    edit()
    expect(range()).toEqual(before)
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved')
  })
  it('also restores a deferred send refused when it leaves the queue', async () => {
    sendSystemEvent.mockResolvedValue(SEND_DEFERRED)
    edit()
    await act(async () => {})
    expect(range()).toEqual({ ...before, range_min: 0.2, range_max: 0.6 })
    const options = sendSystemEvent.mock.calls[0][1]
    await act(async () => {
      options.onDeferredSettled(Promise.reject(new SystemEventSendError('server', { reason: 'system_event_refused_no_write' })))
    })
    expect(range()).toEqual(before)
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved')
  })
  it('does not overwrite a newer range when an earlier send is refused', async () => {
    let reject!: (reason: unknown) => void
    sendSystemEvent.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
    edit()
    act(() => updateNode('factor-1', { data: { prior: { ...before, range_min: 0.3, range_max: 0.7 } } }))
    await act(async () => { reject(new SystemEventSendError('server', { reason: 'system_event_refused_no_write' })) })
    expect(range()).toEqual({ ...before, range_min: 0.3, range_max: 0.7 })
    expect(screen.getByRole('alert')).not.toHaveTextContent('previous range is back')
  })
})
