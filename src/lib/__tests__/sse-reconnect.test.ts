import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { openStream } from '../../lib/sseClient'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static install() {
    ;(globalThis as any)._RealEventSource = (globalThis as any).EventSource
    ;(globalThis as any).EventSource = FakeEventSource as any
  }
  static uninstall() {
    ;(globalThis as any).EventSource = (globalThis as any)._RealEventSource
  }

  url: string
  closed = false
  onopen: ((this: FakeEventSource, ev: any) => any) | null = null
  onmessage: ((this: FakeEventSource, ev: any) => any) | null = null
  onerror: ((this: FakeEventSource, ev: any) => any) | null = null
  private listeners = new Map<string, Set<(ev: any) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (ev: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(cb)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data?: string, id?: string) {
    if (this.closed) return
    if (type === 'open') {
      this.onopen?.({})
      return
    }
    if (type === 'error') {
      this.onerror?.({})
      return
    }
    const ev: any = { data, lastEventId: id }
    if (type === 'message') {
      this.onmessage?.(ev)
    }
    const set = this.listeners.get(type)
    if (set) set.forEach((cb) => cb(ev))
  }
}

describe('sseClient reconnect and dedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('reconnects once with resume and dedupes by lastEventId', async () => {
    const tokens: string[] = []
    const errors: any[] = []
    const dones: number[] = []

    openStream({
      route: 'critique',
      sessionId: 's1',
      org: 'o1',
      onToken: (t) => tokens.push(t),
      onError: (e) => errors.push(e),
      onDone: () => dones.push(Date.now()),
    })

    // First connection
    expect(FakeEventSource.instances.length).toBe(1)
    const first = FakeEventSource.instances[0]
    first.emit('open')
    first.emit('token', 'A', '1')

    // Transient error triggers single retry with willRetry
    first.emit('error')
    expect(errors.length).toBe(1)
    expect(errors[0]?.willRetry).toBe(true)

    // Advance time to allow reconnect
    await vi.advanceTimersByTimeAsync(60)
    expect(FakeEventSource.instances.length).toBe(2)
    const second = FakeEventSource.instances[1]

    // Reconnect URL should carry lastEventId=1
    expect(second.url).toContain('lastEventId=1')

    // Duplicate of id=1 must be ignored
    second.emit('token', 'A_DUP', '1')
    // New tokens
    second.emit('token', 'B', '2')
    // Duplicate id=2 must be ignored
    second.emit('token', 'B_DUP', '2')
    second.emit('token', 'C', '3')
    second.emit('done')

    expect(tokens.join('')).toBe('ABC')
    expect(dones.length).toBe(1)
  })
})
