import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runLayoutWithProgress } from '../runLayoutWithProgress'
import { useLayoutProgressStore } from '../../layoutProgressStore'

const applyLayoutMock = vi.fn<[], Promise<void>>()

vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: () => ({ applyLayout: applyLayoutMock }),
  },
}))

function resetProgressStore() {
  useLayoutProgressStore.setState({
    status: 'idle',
    message: null,
    canRetry: false,
    retry: null,
  })
}

describe('runLayoutWithProgress', () => {
  beforeEach(() => {
    resetProgressStore()
    applyLayoutMock.mockReset()
  })

  it('returns true and clears progress on success', async () => {
    applyLayoutMock.mockResolvedValueOnce()

    const result = await runLayoutWithProgress()

    expect(result).toBe(true)
    expect(applyLayoutMock).toHaveBeenCalledTimes(1)

    const state = useLayoutProgressStore.getState()
    expect(state.status).toBe('idle')
    expect(state.message).toBeNull()
    expect(state.canRetry).toBe(false)
    expect(state.retry).toBeNull()
  })

  it('sets error state and retry on failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    applyLayoutMock.mockRejectedValueOnce(new Error('boom'))

    const result = await runLayoutWithProgress()

    expect(result).toBe(false)
    expect(applyLayoutMock).toHaveBeenCalledTimes(1)

    const failed = useLayoutProgressStore.getState()
    expect(failed.status).toBe('error')
    expect(failed.message).toContain('Layout failed')
    expect(failed.canRetry).toBe(true)
    expect(typeof failed.retry).toBe('function')

    applyLayoutMock.mockResolvedValueOnce()
    await failed.retry?.()
    expect(applyLayoutMock).toHaveBeenCalledTimes(2)

    consoleErrorSpy.mockRestore()
  })
})
