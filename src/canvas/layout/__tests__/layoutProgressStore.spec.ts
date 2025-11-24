import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutProgressStore } from '../../layoutProgressStore'

function resetStore() {
  useLayoutProgressStore.setState({
    status: 'idle',
    message: null,
    canRetry: false,
    retry: null,
  })
}

describe('layoutProgressStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('initialises in idle state', () => {
    const state = useLayoutProgressStore.getState()
    expect(state.status).toBe('idle')
    expect(state.message).toBeNull()
    expect(state.canRetry).toBe(false)
    expect(state.retry).toBeNull()
  })

  it('start sets loading state with optional retry', () => {
    const retryFn = () => {}
    const { start } = useLayoutProgressStore.getState()

    start('Loading…')
    let state = useLayoutProgressStore.getState()
    expect(state.status).toBe('loading')
    expect(state.message).toBe('Loading…')
    expect(state.canRetry).toBe(false)
    expect(state.retry).toBeNull()

    start('Loading with retry', retryFn)
    state = useLayoutProgressStore.getState()
    expect(state.status).toBe('loading')
    expect(state.message).toBe('Loading with retry')
    expect(state.canRetry).toBe(true)
    expect(state.retry).toBe(retryFn)
  })

  it('succeed resets to idle', () => {
    const { start, succeed } = useLayoutProgressStore.getState()
    start('Loading…')

    succeed()
    const state = useLayoutProgressStore.getState()
    expect(state.status).toBe('idle')
    expect(state.message).toBeNull()
    expect(state.canRetry).toBe(false)
    expect(state.retry).toBeNull()
  })

  it('fail sets error state and optional retry', () => {
    const retryFn = () => {}
    const { fail } = useLayoutProgressStore.getState()

    fail('Something went wrong')
    let state = useLayoutProgressStore.getState()
    expect(state.status).toBe('error')
    expect(state.message).toBe('Something went wrong')
    expect(state.canRetry).toBe(false)
    expect(state.retry).toBeNull()

    fail('Can retry', retryFn)
    state = useLayoutProgressStore.getState()
    expect(state.status).toBe('error')
    expect(state.message).toBe('Can retry')
    expect(state.canRetry).toBe(true)
    expect(state.retry).toBe(retryFn)
  })

  it('cancel resets to idle', () => {
    const { start, cancel } = useLayoutProgressStore.getState()
    start('Loading…', () => {})

    cancel()
    const state = useLayoutProgressStore.getState()
    expect(state.status).toBe('idle')
    expect(state.message).toBeNull()
    expect(state.canRetry).toBe(false)
    expect(state.retry).toBeNull()
  })
})
