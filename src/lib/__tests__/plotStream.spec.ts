/**
 * PlotStreamClient tests — P1-5 reconnect counter fix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

class MockEventSource {
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  url: string

  constructor(url: string) {
    this.url = url
    // Store the latest instance for test access
    mockEventSourceInstances.push(this)
  }

  simulateOpen() { this.onopen?.() }
  simulateMessage(data: string, lastEventId = '') {
    this.onmessage?.(new MessageEvent('message', { data, lastEventId }))
  }
  simulateError() { this.onerror?.() }
}

let mockEventSourceInstances: MockEventSource[] = []

beforeEach(() => {
  mockEventSourceInstances = []
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Dynamic import after mocks
async function getPlotStreamClient() {
  const mod = await import('../plotStream')
  return mod.PlotStreamClient
}

describe('PlotStreamClient', () => {
  it('resets reconnectAttempts on successful connection (onopen)', async () => {
    const PlotStreamClient = await getPlotStreamClient()
    const onEvent = vi.fn()
    const onError = vi.fn()
    const client = new PlotStreamClient('test-token', onEvent, onError)

    client.connect()
    const es1 = mockEventSourceInstances.at(-1)!

    // Simulate 2 errors + reconnects
    es1.simulateError()
    vi.advanceTimersByTime(1500)
    const es2 = mockEventSourceInstances.at(-1)!
    es2.simulateError()
    vi.advanceTimersByTime(1500)
    const es3 = mockEventSourceInstances.at(-1)!

    // Simulate successful connection on third attempt
    es3.simulateOpen()

    // Now trigger error again — counter was reset, should still reconnect
    es3.simulateError()
    vi.advanceTimersByTime(1500)

    // A new EventSource should have been created (reconnect happened)
    expect(mockEventSourceInstances.length).toBeGreaterThanOrEqual(4)
    expect(onError).not.toHaveBeenCalled()
  })

  it('stops reconnecting after 5 consecutive failures', async () => {
    const PlotStreamClient = await getPlotStreamClient()
    const onEvent = vi.fn()
    const onError = vi.fn()
    const client = new PlotStreamClient('test-token', onEvent, onError)

    client.connect()

    // Simulate 5 consecutive failures
    for (let i = 0; i < 5; i++) {
      const es = mockEventSourceInstances.at(-1)!
      es.simulateError()
      vi.advanceTimersByTime(1500)
    }

    // 6th error should trigger max-retries
    const esFinal = mockEventSourceInstances.at(-1)!
    esFinal.simulateError()

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Max reconnect attempts reached' }),
    )
  })

  it('success after failures then more failures gets full 5 retries again', async () => {
    const PlotStreamClient = await getPlotStreamClient()
    const onEvent = vi.fn()
    const onError = vi.fn()
    const client = new PlotStreamClient('test-token', onEvent, onError)

    client.connect()

    // 3 failures
    for (let i = 0; i < 3; i++) {
      mockEventSourceInstances.at(-1)!.simulateError()
      vi.advanceTimersByTime(1500)
    }

    // Successful reconnect — reset counter
    mockEventSourceInstances.at(-1)!.simulateOpen()

    // 4 more failures — should all reconnect (counter was reset)
    for (let i = 0; i < 4; i++) {
      mockEventSourceInstances.at(-1)!.simulateError()
      vi.advanceTimersByTime(1500)
    }

    // Should NOT have hit max retries yet
    expect(onError).not.toHaveBeenCalled()
  })
})
