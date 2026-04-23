import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLayoutProgressStore } from '../../layoutProgressStore'
import { handleLayoutWithRecovery } from '../handleLayoutWithRecovery'

function resetStore() {
  useLayoutProgressStore.setState({
    status: 'idle',
    message: null,
    canRetry: false,
    retry: null,
  })
}

describe('handleLayoutWithRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('calls succeed and onSuccess when layout resolves', async () => {
    const layoutFn = vi.fn(() => Promise.resolve())
    const onSuccess = vi.fn()

    handleLayoutWithRecovery(layoutFn, { onSuccess })

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(useLayoutProgressStore.getState().status).toBe('idle')
  })

  it('does not call start on first attempt (no showLoading)', async () => {
    const layoutFn = vi.fn(() => Promise.resolve())
    const startSpy = vi.spyOn(useLayoutProgressStore.getState(), 'start')

    handleLayoutWithRecovery(layoutFn)

    await vi.waitFor(() => {
      expect(layoutFn).toHaveBeenCalledTimes(1)
    })
    expect(startSpy).not.toHaveBeenCalled()
    startSpy.mockRestore()
  })

  it('calls fail with retry on layout rejection, does not call onSuccess', async () => {
    const layoutFn = vi.fn(() => Promise.reject(new Error('boom')))
    const onSuccess = vi.fn()

    handleLayoutWithRecovery(layoutFn, { onSuccess })

    await vi.waitFor(() => {
      expect(useLayoutProgressStore.getState().status).toBe('error')
    })

    const state = useLayoutProgressStore.getState()
    expect(state.message).toBe('Layout failed. Try again.')
    expect(state.canRetry).toBe(true)
    expect(typeof state.retry).toBe('function')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('retry calls start (showLoading) then succeed on success', async () => {
    const layoutFn = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('fail')))
      .mockImplementationOnce(() => Promise.resolve())

    handleLayoutWithRecovery(layoutFn)

    await vi.waitFor(() => {
      expect(useLayoutProgressStore.getState().status).toBe('error')
    })

    const statusHistory: string[] = []
    const unsub = useLayoutProgressStore.subscribe((s) => {
      statusHistory.push(s.status)
    })

    useLayoutProgressStore.getState().retry!()

    await vi.waitFor(() => {
      expect(useLayoutProgressStore.getState().status).toBe('idle')
    })

    expect(statusHistory).toContain('loading')
    expect(layoutFn).toHaveBeenCalledTimes(2)
    unsub()
  })
})
