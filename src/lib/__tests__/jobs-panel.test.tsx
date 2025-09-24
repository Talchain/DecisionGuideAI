import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../flags', () => ({
  isJobsProgressEnabled: () => true,
}))

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

describe('JobsProgressPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('advances progress and cancels cleanly', async () => {
    const { default: JobsProgressPanel } = await import('../../components/JobsProgressPanel')
    render(<JobsProgressPanel />)

    const start = screen.getByTestId('jobs-start-btn')
    const cancel = screen.getByTestId('jobs-cancel-btn')

    fireEvent.click(start)

    expect(FakeEventSource.instances.length).toBe(1)
    const first = FakeEventSource.instances[0]

    act(() => {
      first.emit('open')
      first.emit('progress', '10', '1')
      first.emit('progress', '40', '2')
      first.emit('progress', '90', '3')
    })

    const bar = screen.getByTestId('jobs-progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('90')

    // Cancel ends the stream, future updates ignored
    fireEvent.click(cancel)
    act(() => {
      first.emit('progress', '100', '4')
    })
    expect(bar.getAttribute('aria-valuenow')).toBe('90')
  })
})
